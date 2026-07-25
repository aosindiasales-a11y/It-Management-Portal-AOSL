"use client";

import * as React from "react";

/**
 * Autosaves form values to localStorage while typing, and restores them if
 * the admin navigates away mid-edit. Keyed by module + record id ("new"
 * for a fresh record), so an abandoned "new employee" draft doesn't leak
 * into a different record's form.
 */
export function useDraft<T extends Record<string, unknown>>(key: string) {
  const storageKey = `itmp:draft:${key}`;

  const readDraft = React.useCallback((): T | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const saveDraft = React.useCallback(
    (values: T) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(values));
      } catch {
        // localStorage full or unavailable — autosave is a nicety, not critical.
      }
    },
    [storageKey]
  );

  const clearDraft = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { readDraft, saveDraft, clearDraft };
}

/** Debounces a save function — used to autosave drafts without writing on every keystroke. */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number
) {
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  return React.useCallback(
    (...args: Args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => fn(...args), delayMs);
    },
    [fn, delayMs]
  );
}
