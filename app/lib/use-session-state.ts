import { useEffect, useState } from "react";

/**
 * Persist React state in sessionStorage for the lifetime of the tab.
 * - SSR-safe: initial render uses the provided initial value, hydration reads sessionStorage on mount.
 * - Values are JSON-serialized → supports strings, numbers, booleans, objects.
 * - sessionStorage scope is per-tab and cleared automatically when the tab is closed.
 */
export function useSessionState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(key);
    if (stored !== null) {
      try {
        setValue(JSON.parse(stored));
      } catch {
        // ignore corrupted value
      }
    }
  }, [key]);

  const update = (v: T) => {
    setValue(v);
    try {
      window.sessionStorage.setItem(key, JSON.stringify(v));
    } catch {
      // quota exceeded or private browsing — ignore
    }
  };

  return [value, update];
}