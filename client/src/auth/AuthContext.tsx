import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, authApi, clearTokens, setTokens } from "../api/client";
import type { AuthResponse, MeDto, RegisterResponse, Role } from "../types/api";

interface AuthState {
  user: MeDto | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (usernameOrEmail: string, password: string) => Promise<AuthResponse>;
  register: (data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refetchMe: () => Promise<void>;
  hasRole: (role: Role) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      navigate("/login", { replace: true });
    };
    window.addEventListener("aegi:logout", onLogout);
    return () => window.removeEventListener("aegi:logout", onLogout);
  }, [navigate]);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    const res = await authApi.login({ usernameOrEmail, password });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return res;
  }, []);

  const register = useCallback(
    async (data: { username: string; email: string; password: string; displayName: string }) => {
      return await authApi.register(data);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearTokens();
      setUser(null);
      // clear any cached api modules
      void api.get("/auth/me").catch(() => {});
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const refetchMe = useCallback(async () => {
    setLoading(true);
    await loadMe();
  }, [loadMe]);

  const hasRole = useCallback(
    (role: Role) => {
      return user?.roles.includes(role) ?? false;
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refetchMe,
      hasRole,
    }),
    [user, loading, login, register, logout, refetchMe, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}

export function useAuthGuard(redirectTo = "/login") {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, navigate, redirectTo]);

  return { user, loading };
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner spinner--lg" />
        <span>Cargando sesión</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

export function RequireLicense({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.license.status !== "Active" && !user.roles.includes("Admin")) {
      navigate("/pending", { replace: true });
    }
  }, [user, navigate]);

  return <>{children}</>;
}

export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !user.onboardingCompleted && user.license.status === "Active") {
      navigate("/onboarding", { replace: true });
    }
  }, [user, navigate]);

  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !user.roles.includes("Admin")) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || !user?.roles.includes("Admin")) {
    return null;
  }

  return <>{children}</>;
}
