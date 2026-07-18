import { createContext, useContext } from "react";
import type { ToastType } from "./useToast";

interface ToastContextValue {
  toasts: { id: string; type: string; message: string }[];
  add: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  add: () => {},
  remove: () => {},
});

export function useToastCtx() {
  return useContext(ToastContext);
}
