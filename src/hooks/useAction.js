import { useRef, useState, useCallback } from "react";

/**
 * Prevents concurrent duplicate executions of an async function.
 * Returns [guardedFn, isLoading].
 * While a call is in flight, subsequent calls are no-ops.
 * After the call resolves or rejects, the guard is released automatically.
 */
export function useAction(fn) {
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      return await fnRef.current(...args);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  return [run, loading];
}

/**
 * Like useAction but tracks multiple concurrent actions keyed by an identifier
 * (e.g. per-row actions in a table).
 *
 * Usage:
 *   const { run, isLoading } = useActionMap();
 *   run(`${id}_pdf`, () => downloadPDF(id));
 *   disabled={isLoading(`${id}_pdf`)}
 */
export function useActionMap() {
  const [loading, setLoading] = useState(() => new Set());
  const inFlight = useRef(new Set());

  const run = useCallback(async (key, fn) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setLoading((prev) => new Set(prev).add(key));
    try {
      return await fn();
    } finally {
      inFlight.current.delete(key);
      setLoading((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const isLoading = useCallback((key) => loading.has(key), [loading]);

  return { run, isLoading };
}
