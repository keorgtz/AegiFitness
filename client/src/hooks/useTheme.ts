import { useSyncExternalStore } from "react";
import { getTheme, subscribeTheme } from "../utils/theme";

export function useTheme() {
  return useSyncExternalStore(subscribeTheme, getTheme, () => "light" as const);
}
