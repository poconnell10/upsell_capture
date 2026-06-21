import { useState, useCallback } from 'react';

// Persisted state hook — mirrors the localStorage juggling the prototypes did by hand.
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch (e) {
      return initial;
    }
  });

  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch (e) {
          /* ignore quota / private-mode errors */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}
