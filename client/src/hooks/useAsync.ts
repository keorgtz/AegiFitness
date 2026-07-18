import { useCallback, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const run = useCallback(async (promise: Promise<T>): Promise<T | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await promise;
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Ha ocurrido un error";
      setState({ data: null, loading: false, error: message });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, run, reset, setData: (data: T) => setState({ data, loading: false, error: null }) };
}

export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setErrors({});
  }, []);

  return { errors, setError, clearError, clearAll };
}
