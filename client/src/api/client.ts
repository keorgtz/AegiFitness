import type { ApiError, AuthResponse, MeDto, RefreshRequest, RegisterResponse } from "../types/api";

const API_BASE = "/api";

const ACCESS_KEY = "aegi_access_token";
const REFRESH_KEY = "aegi_refresh_token";

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function getHeaders(contentType = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (contentType) {
    h["Content-Type"] = "application/json";
  }
  const token = getAccessToken();
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
  }
  return h;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { message?: string; errors?: Record<string, string[]> };
    return {
      message: body.message ?? `Error ${res.status}`,
      errors: body.errors,
    };
  } catch {
    return { message: `Error ${res.status}: ${res.statusText}` };
  }
}

interface RequestOptions {
  method: string;
  body?: unknown;
  contentType?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken } satisfies RefreshRequest),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = (await res.json()) as AuthResponse;
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

async function refreshTokenOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(path: string, opts: RequestOptions): Promise<T> {
  const url = `${API_BASE}${path}`;
  const init: RequestInit = {
    method: opts.method,
    headers: getHeaders(opts.contentType ?? true),
  };
  if (opts.body !== undefined) {
    init.body = opts.contentType === false ? (opts.body as BodyInit) : JSON.stringify(opts.body);
  }

  let res = await fetch(url, init);

  if (res.status === 401) {
    const hadSession = getAccessToken() !== null;
    const newToken = await refreshTokenOnce();
    if (newToken) {
      init.headers = getHeaders(opts.contentType ?? true);
      res = await fetch(url, init);
    } else {
      clearTokens();
      if (hadSession) {
        window.dispatchEvent(new Event("aegi:logout"));
      }
    }
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const authApi = {
  login: (req: { usernameOrEmail: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", req),
  register: (req: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }) => api.post<RegisterResponse>("/auth/register", req),
  refresh: (req: RefreshRequest) => api.post<AuthResponse>("/auth/refresh", req),
  logout: () => api.post("/auth/logout", { refreshToken: getRefreshToken() ?? "" }),
  me: () => api.get<MeDto>("/auth/me"),
};

export { getAccessToken, getRefreshToken, setTokens, clearTokens };
