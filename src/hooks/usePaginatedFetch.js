import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest, safeParseJson } from "../api/client";

/**
 * Backend-backed list hook with pagination, search, filters and sorting.
 * Handles aborting stale requests and prevents duplicate fetches.
 *
 * @param {string} endpoint - e.g. "/api/user/admin/all"
 * @param {object} options
 *   - initialLimit: page size
 *   - initialPage: starting page (1)
 *   - initialSearch: initial search string
 *   - initialFilters: object with extra query params (status, category, etc.)
 *   - initialSort: { sortBy, sortOrder }
 *   - dataKey: key in response that holds the array (auto-detected if null)
 */
export function usePaginatedFetch(endpoint, options = {}) {
  const {
    initialLimit = 20,
    initialPage = 1,
    initialSearch = "",
    initialFilters = {},
    initialSort = {},
    dataKey = null,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState({
    sortBy: initialSort.sortBy || undefined,
    sortOrder: initialSort.sortOrder || undefined,
  });

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search && String(search).trim()) params.set("search", String(search).trim());
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "" && v !== "all") params.set(k, String(v));
    });
    if (sort.sortBy) params.set("sortBy", sort.sortBy);
    if (sort.sortOrder) params.set("sortOrder", sort.sortOrder);
    return params.toString();
  }, [page, limit, search, filters, sort]);

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const reqId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery();
      const url = `${endpoint}?${qs}`;
      const res = await apiRequest(url, { signal: controller.signal });
      if (!res.ok) {
        const payload = await safeParseJson(res);
        throw new Error(payload?.message || `Request failed (${res.status})`);
      }
      const payload = await res.json();
      if (reqId !== requestIdRef.current) return; // stale response

      // Detect array key if not provided
      let items = [];
      if (dataKey && payload[dataKey] !== undefined) {
        items = payload[dataKey];
      } else {
        const candidates = ["users","orders","subscriptions","products","suppliers","agents","expenses","complaints","messages","returns","areas","invoices","deliveries","customers","entries","payments","collections","manifests"];
        for (const k of candidates) {
          if (Array.isArray(payload[k])) { items = payload[k]; break; }
        }
        if (!items.length && Array.isArray(payload.data)) items = payload.data;
        if (!items.length && Array.isArray(payload)) items = payload;
      }
      const respTotal = payload.total ?? payload.count ?? items.length;
      const respTotalPages = payload.totalPages ?? Math.max(1, Math.ceil(respTotal / limit));
      const respPage = payload.page ?? page;
      // If requested page is beyond totalPages, clamp
      if (respTotalPages > 0 && respPage > respTotalPages && respTotal > 0) {
        setPage(respTotalPages);
      }
      setData(items);
      setTotal(respTotal);
      setTotalPages(respTotalPages);
    } catch (err) {
      if (err.name === "AbortError") return;
      if (reqId !== requestIdRef.current) return;
      setError(err.message || "Failed to fetch");
      setData([]);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, [endpoint, buildQuery, dataKey, limit, page]);

  // Fetch on mount and whenever dependencies change
  useEffect(() => {
    fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  // When search / filters / sort change, reset to page 1 (avoid showing empty page)
  const updateSearch = useCallback((val) => {
    setSearch(val);
    setPage(1);
  }, []);
  const updateFilters = useCallback((next) => {
    setFilters((prev) => {
      const merged = typeof next === "function" ? next(prev) : { ...prev, ...next };
      return merged;
    });
    setPage(1);
  }, []);
  const setFilterValue = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);
  const updateSort = useCallback((sortBy, sortOrder) => {
    setSort({ sortBy, sortOrder });
    setPage(1);
  }, []);
  const handlePageChange = useCallback((newPage) => {
    setPage(newPage);
  }, []);
  const handleLimitChange = useCallback((newLimit) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const refetch = useCallback(() => fetchData(), [fetchData]);

  // Clear filters helper
  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setSearch("");
    setSort({ sortBy: initialSort.sortBy, sortOrder: initialSort.sortOrder });
    setPage(1);
  }, [initialFilters, initialSort]);

  return {
    data,
    loading,
    error,
    pagination: { total, page, limit, totalPages },
    page,
    limit,
    total,
    totalPages,
    search,
    filters,
    sort,
    setPage: handlePageChange,
    setLimit: handleLimitChange,
    setSearch: updateSearch,
    setFilters: updateFilters,
    setFilterValue,
    setSort: updateSort,
    refetch,
    resetFilters,
    // raw setters for advanced use
    _setPageRaw: setPage,
    _setFiltersRaw: setFilters,
  };
}
