import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest, safeParseJson } from "../api/client";

const apiCache = new Map();

export function clearApiCache() {
  apiCache.clear();
}

export function useApiData(fetchFn, immediate = true, cacheKey = null) {
  const [data, setData] = useState(cacheKey ? apiCache.get(cacheKey) : null);
  const [loading, setLoading] = useState(immediate && (!cacheKey || !apiCache.has(cacheKey)));
  const [error, setError] = useState(null);
  const fetchFnRef = useRef(fetchFn);
  const lastArgsRef = useRef([]);
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const execute = useCallback(async (...args) => {
    hasExecutedRef.current = true;
    lastArgsRef.current = args;
    if (!cacheKey || !apiCache.has(cacheKey)) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetchFnRef.current(...args);
      setData(result);
      if (cacheKey) {
        apiCache.set(cacheKey, result);
      }
      setError(null);
      return result;
    } catch (err) {
      console.error("useApiData execution error:", err);
      setError(err.message || "An error occurred");
      setData(null);
      return err;
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  // Re-run with the last used args when a forced portal refresh is triggered.
  // Only fires if this hook has already fetched at least once (avoids spurious
  // fetches for hooks that are lazy / not yet called).
  useEffect(() => {
    function onPortalRefresh() {
      if (hasExecutedRef.current) {
        execute(...lastArgsRef.current);
      }
    }
    window.addEventListener("portal:refresh", onPortalRefresh);
    return () => window.removeEventListener("portal:refresh", onPortalRefresh);
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

export function createApiFetch(path, options = {}) {
  return async (params = {}) => {
    let url;
    try {
      url = new URL(path);
    } catch {
      url = new URL(path, window.location.origin);
    }

    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });

    const finalPath = path.startsWith("http") ? url.toString() : url.pathname + url.search;
    const response = await apiRequest(finalPath, options);

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      throw new Error("Session expired. Please sign in again.");
    }

    if (!response.ok) {
      const payload = await safeParseJson(response);
      throw new Error(payload?.message || `Request failed with status ${response.status}`);
    }

    return response.json();
  };
}
