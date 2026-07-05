import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { RefreshCw, CheckCheck, AlertTriangle, Download } from "lucide-react";
import { apiRequest } from "../api/client";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useDebounce } from "../hooks/useDebounce";
import PageHeader from "../components/ui/PageHeader";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import QuickChips from "../components/ui/QuickChips";
import SearchInput from "../components/ui/SearchInput";
import StickyActionBar from "../components/ui/StickyActionBar";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import toast from "react-hot-toast";

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatCurrency(val) {
  return `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Was this confirmed entry later edited? (updatedAt more than 60s after confirmedAt)
function wasEdited(c) {
  if (c.status !== "confirmed" || !c.confirmedAt || !c.updatedAt) return false;
  return new Date(c.updatedAt).getTime() - new Date(c.confirmedAt).getTime() > 60_000;
}

// Derive summary stats from collections array
function buildSummary(collections) {
  const confirmed = collections.filter((c) => c.status === "confirmed");
  return {
    total: collections.length,
    pending: collections.filter((c) => c.status === "pending").length,
    confirmed: confirmed.length,
    totalLiters: confirmed.reduce((s, c) => s + (c.actualQty || 0), 0),
    totalAmount: confirmed.reduce((s, c) => s + (c.totalAmount || 0), 0),
  };
}

// Draft persistence helpers
function saveDraft(date, edits) {
  try {
    sessionStorage.setItem(`mc-drafts-${date}`, JSON.stringify(edits));
  } catch (_) {}
}

function loadDraft(date) {
  try {
    const raw = sessionStorage.getItem(`mc-drafts-${date}`);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function clearDraft(date) {
  try { sessionStorage.removeItem(`mc-drafts-${date}`); } catch (_) {}
}

// Build CSV from history array
function downloadCSV(rows) {
  const headers = ["Date", "Farmer", "Session", "Qty (L)", "Fat %", "SNF %", "Rate/L", "Amount", "Payment"];
  const lines = [
    headers.join(","),
    ...rows.map((c) => [
      formatDate(c.date),
      `"${c.supplierId?.name || ""}"`,
      c.session,
      c.actualQty ?? "",
      c.fatContent ?? "",
      c.snf ?? "",
      Number(c.ratePerLiter || 0).toFixed(2),
      Number(c.totalAmount || 0).toFixed(2),
      c.paymentId ? "paid" : "unpaid",
    ].join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `milk-collections-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const SESSION_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Morning", value: "morning" },
  { label: "Evening", value: "evening" },
];

const fetchSuppliersList = createApiFetch("/api/suppliers");

// ─── Component ────────────────────────────────────────────────────────────────

export default function MilkCollectionsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [view, setView] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 250);

  // Per-row edit state: { [id]: { actualQty, ratePerLiter, fatContent, snf } }
  const [edits, setEdits] = useState({});
  const [confirmingId, setConfirmingId] = useState(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  // Track initial edit values for dirty detection
  const initialEditsRef = useRef({});

  // Input refs for keyboard navigation (actualQty inputs keyed by collection id)
  const inputRefs = useRef({});

  // Missing entries
  const [missing, setMissing] = useState([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [fixingDate, setFixingDate] = useState(null);

  // Suppliers for history dropdown
  const { data: suppliersData } = useApiData(fetchSuppliersList);
  const suppliersList = suppliersData?.suppliers ?? [];

  // History
  const [historyFilters, setHistoryFilters] = useState({ supplierId: "", from: "", to: "", session: "" });
  const [history, setHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ─── Derived data ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = collections;
    if (sessionFilter !== "all") result = result.filter((c) => c.session === sessionFilter);
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter((c) => c.supplierId?.name?.toLowerCase().includes(term));
    }
    return result;
  }, [collections, sessionFilter, debouncedSearch]);

  const summary = useMemo(() => buildSummary(filtered), [filtered]);
  const progressPct = summary.total > 0 ? Math.round((summary.confirmed / summary.total) * 100) : 0;

  // Total pending across ALL sessions/search — bulk confirm always confirms the full day
  const totalPendingCount = useMemo(
    () => collections.filter((c) => c.status === "pending").length,
    [collections]
  );

  const isToday = selectedDate === todayStr();

  // ─── Daily fetch ───────────────────────────────────────────────────────────

  const fetchDaily = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/milk-collections/daily?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      const cols = data.collections || [];
      setCollections(cols);

      // Build initial edits for pending entries, restoring saved drafts
      const draft = loadDraft(date);
      const initEdits = {};
      cols.forEach((c) => {
        if (c.status === "pending") {
          const saved = draft?.[c._id];
          initEdits[c._id] = saved ?? {
            actualQty: c.expectedQty?.toString() ?? "",
            ratePerLiter: c.ratePerLiter?.toString() ?? "",
            fatContent: "",
            snf: "",
          };
        }
      });
      setEdits(initEdits);
      initialEditsRef.current = JSON.parse(JSON.stringify(initEdits));
    } catch (err) {
      toast.error(err.message || "Failed to load collections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDaily(selectedDate);
  }, [selectedDate, fetchDaily]);

  // ─── Draft auto-save ───────────────────────────────────────────────────────

  const draftTimer = useRef(null);
  useEffect(() => {
    if (Object.keys(edits).length === 0) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft(selectedDate, edits);
    }, 500);
    return () => clearTimeout(draftTimer.current);
  }, [edits, selectedDate]);

  // ─── Missing entries check (last 3 days, skip today) ──────────────────────

  useEffect(() => {
    const today = todayStr();
    const from = new Date();
    from.setDate(from.getDate() - 3);
    const fromStr = from.toISOString().split("T")[0];

    // Calculate "yesterday" as toDate (exclude today from missing check)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const toStr = yesterday.toISOString().split("T")[0];

    if (fromStr >= today) return;

    apiRequest(`/api/milk-collections/missing?from=${fromStr}&to=${toStr}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.missing?.length > 0) setMissing(data.missing);
      })
      .catch(() => {});
  }, []);

  // ─── Fix missing: generate for a specific date then navigate to it ────────

  const handleFixMissing = useCallback(async (date) => {
    setFixingDate(date);
    try {
      const res = await apiRequest("/api/milk-collections/generate", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setShowMissingModal(false);
      setSelectedDate(date);
      setView("daily");
      // Remove fixed date from missing list
      setMissing((prev) => prev.filter((m) => m.date !== date));
    } catch (err) {
      toast.error(err.message || "Failed to generate entries.");
    } finally {
      setFixingDate(null);
    }
  }, []);

  // ─── Confirm single ────────────────────────────────────────────────────────

  const handleConfirmOne = useCallback(async (collection) => {
    const edit = edits[collection._id] || {};
    const actualQty = parseFloat(edit.actualQty);
    const ratePerLiter = parseFloat(edit.ratePerLiter);

    if (isNaN(actualQty) || actualQty < 0) {
      toast.error("Enter a valid actual quantity.");
      return;
    }
    if (isNaN(ratePerLiter) || ratePerLiter < 0) {
      toast.error("Enter a valid rate per liter.");
      return;
    }

    setConfirmingId(collection._id);
    try {
      const payload = {
        actualQty,
        ratePerLiter,
        fatContent: edit.fatContent !== "" ? parseFloat(edit.fatContent) : null,
        snf: edit.snf !== "" ? parseFloat(edit.snf) : null,
      };
      const res = await apiRequest(`/api/milk-collections/${collection._id}/confirm`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Optimistic update: replace in-place, no full refetch
      setCollections((prev) =>
        prev.map((c) => (c._id === collection._id ? { ...c, ...data.collection, status: "confirmed" } : c))
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[collection._id];
        return next;
      });

      toast.success(`${collection.supplierId?.name || "Entry"} (${collection.session}) confirmed.`);

      // Auto-focus next pending row (within current filtered view)
      const pendingIds = filtered
        .filter((c) => c.status === "pending" && c._id !== collection._id)
        .map((c) => c._id);
      if (pendingIds.length > 0) {
        setTimeout(() => {
          inputRefs.current[pendingIds[0]]?.focus();
        }, 50);
      }
    } catch (err) {
      toast.error(err.message || "Failed to confirm.");
    } finally {
      setConfirmingId(null);
    }
  }, [edits, filtered]);

  // ─── No Supply shortcut ────────────────────────────────────────────────────

  const handleNoSupply = useCallback(async (collection) => {
    const edit = edits[collection._id] || {};
    const ratePerLiter = parseFloat(edit.ratePerLiter) || collection.ratePerLiter || 0;

    setConfirmingId(collection._id);
    try {
      const res = await apiRequest(`/api/milk-collections/${collection._id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ actualQty: 0, ratePerLiter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setCollections((prev) =>
        prev.map((c) => (c._id === collection._id ? { ...c, ...data.collection, status: "confirmed" } : c))
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[collection._id];
        return next;
      });

      toast.success(`${collection.supplierId?.name || "Entry"} — No Supply recorded.`);
    } catch (err) {
      toast.error(err.message || "Failed to record no supply.");
    } finally {
      setConfirmingId(null);
    }
  }, [edits]);

  // ─── Bulk confirm ──────────────────────────────────────────────────────────

  const handleBulkConfirm = useCallback(async () => {
    setBulkConfirming(true);
    setShowBulkDialog(false);
    try {
      const res = await apiRequest("/api/milk-collections/bulk-confirm", {
        method: "POST",
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      clearDraft(selectedDate);
      // Refetch to get accurate confirmed data
      fetchDaily(selectedDate);
    } catch (err) {
      toast.error(err.message || "Failed to bulk confirm.");
    } finally {
      setBulkConfirming(false);
    }
  }, [selectedDate, fetchDaily]);

  // ─── Keyboard navigation on inputs ────────────────────────────────────────

  const handleInputKeyDown = useCallback((e, collection) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmOne(collection);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // Use filtered list so arrow keys only traverse visible (filtered) pending rows
      const pendingIds = filtered
        .filter((c) => c.status === "pending")
        .map((c) => c._id);
      const idx = pendingIds.indexOf(collection._id);
      const targetIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      const targetId = pendingIds[targetIdx];
      if (targetId && inputRefs.current[targetId]) {
        inputRefs.current[targetId].focus();
      }
    }
  }, [filtered, handleConfirmOne]);

  const setEdit = useCallback((id, field, value) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }, []);

  // ─── History fetch ─────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (historyFilters.supplierId) params.set("supplierId", historyFilters.supplierId);
      if (historyFilters.from) params.set("from", historyFilters.from);
      if (historyFilters.to) params.set("to", historyFilters.to);
      if (historyFilters.session) params.set("session", historyFilters.session);
      const res = await apiRequest(`/api/milk-collections?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setHistory(data.collections || []);
      setHistorySummary(data.summary || null);
    } catch (err) {
      toast.error(err.message || "Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilters]);

  const fetchHistoryRef = useRef(fetchHistory);
  useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);

  useEffect(() => {
    if (view === "history") fetchHistoryRef.current();
  }, [view]);

  // ─── Missing entries grouped by date ─────────────────────────────────────

  const missingByDate = useMemo(() => {
    const groups = {};
    for (const m of missing) {
      if (!groups[m.date]) groups[m.date] = [];
      groups[m.date].push(m);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [missing]);

  // ─── Bulk confirm summary for dialog — computed from ALL collections, not filtered ──

  const bulkPreviewLiters = useMemo(
    () => collections.filter((c) => c.status === "pending").reduce((s, c) => s + (c.expectedQty || 0), 0),
    [collections]
  );
  const bulkPreviewAmount = useMemo(
    () => collections.filter((c) => c.status === "pending").reduce((s, c) => s + (c.expectedQty || 0) * (c.ratePerLiter || 0), 0),
    [collections]
  );

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen />;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="view-stack">
      <PageHeader
        title="Milk Collections"
        subtitle="Daily inbound collection confirmation from farmers"
      />

      {/* ── Missing entries alert ─────────────────────────────────────── */}
      {missing.length > 0 && (
        <div
          className="mc-missing-alert"
          role="button"
          tabIndex={0}
          onClick={() => setShowMissingModal(true)}
          onKeyDown={(e) => e.key === "Enter" && setShowMissingModal(true)}
        >
          <AlertTriangle size={16} color="var(--color-warning)" style={{ flexShrink: 0 }} />
          <span className="mc-missing-alert-text">
            {missing.length} missing {missing.length === 1 ? "entry" : "entries"} from the last 3 days
          </span>
          <span className="mc-missing-alert-link">Review & Fix →</span>
        </div>
      )}

      {/* ── View tabs ─────────────────────────────────────────────────── */}
      <div className="surface" style={{ padding: 0 }}>
        <div className="filter-tabs" style={{ borderBottom: "1px solid var(--border-soft)", padding: "0 16px" }}>
          <button
            className={`filter-tab ${view === "daily" ? "active" : ""}`}
            onClick={() => setView("daily")}
          >
            Daily Confirmation
          </button>
          <button
            className={`filter-tab ${view === "history" ? "active" : ""}`}
            onClick={() => setView("history")}
          >
            History
          </button>
        </div>

        {/* ════════════════════════ DAILY VIEW ════════════════════════ */}
        {view === "daily" && (
          <div style={{ padding: 16 }}>

            {/* ── Toolbar ────────────────────────────────────────────── */}
            <div className="mc-toolbar">
              <div className="mc-toolbar-left">
                <input
                  type="date"
                  className="search-input mc-date-input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                <button
                  className="mini-button"
                  onClick={() => fetchDaily(selectedDate)}
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <div className="mc-toolbar-right">
                {totalPendingCount > 0 && !isMobile && (
                  <button
                    className="mini-button active"
                    onClick={() => setShowBulkDialog(true)}
                    disabled={bulkConfirming}
                    title="Confirm all pending entries for the day using expected quantities"
                  >
                    <CheckCheck size={14} style={{ marginRight: 4 }} />
                    {bulkConfirming ? "Confirming…" : `Confirm All (${totalPendingCount})`}
                  </button>
                )}
              </div>
            </div>

            {/* ── Backdate banner ─────────────────────────────────────── */}
            {!isToday && (
              <div className="mc-backdate-banner">
                <AlertTriangle size={14} />
                Viewing backdated entries for {formatDate(selectedDate)}. Late entries are allowed and will be timestamped.
              </div>
            )}

            {/* ── Session filter + search ─────────────────────────────── */}
            {collections.length > 0 && (
              <div className="mc-filters">
                <QuickChips
                  options={SESSION_OPTIONS}
                  selected={sessionFilter}
                  onSelect={setSessionFilter}
                />
                <SearchInput
                  placeholder="Search farmer…"
                  value={searchTerm}
                  onChange={setSearchTerm}
                />
              </div>
            )}

            {/* ── Progress summary ─────────────────────────────────────── */}
            {collections.length > 0 && (
              <div className="mc-summary">
                <div className="mc-summary-chips">
                  <div className="supplier-default-chip">
                    <span>Total</span>
                    <strong>{summary.total}</strong>
                  </div>
                  <div className="supplier-default-chip" style={{ borderColor: "var(--color-warning)", background: "var(--warning-bg)" }}>
                    <span style={{ color: "var(--warning-text)" }}>Pending</span>
                    <strong style={{ color: "var(--warning-text)" }}>{summary.pending}</strong>
                  </div>
                  <div className="supplier-default-chip" style={{ borderColor: "var(--color-primary)", background: "var(--success-bg)" }}>
                    <span style={{ color: "var(--success-text)" }}>Confirmed</span>
                    <strong style={{ color: "var(--color-primary-dark)" }}>{summary.confirmed}</strong>
                  </div>
                  <div className="supplier-default-chip">
                    <span>Collected</span>
                    <strong>{Number(summary.totalLiters).toFixed(1)} L</strong>
                  </div>
                  <div className="supplier-default-chip">
                    <span>Amount</span>
                    <strong>{formatCurrency(summary.totalAmount)}</strong>
                  </div>
                </div>
                <div className="mc-progress-track">
                  <div className="mc-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="mc-progress-label">{progressPct}% confirmed</p>
              </div>
            )}

            {/* ── Empty state ─────────────────────────────────────────── */}
            {filtered.length === 0 && (
              <div className="mc-empty">
                {collections.length === 0 ? (
                  <>
                    <p>No active suppliers with collection schedules found for this date.</p>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>
                      Entries are auto-generated when suppliers have a default quantity set.
                    </p>
                  </>
                ) : (
                  <p>No entries match your current filters.</p>
                )}
              </div>
            )}

            {/* ── Desktop table ────────────────────────────────────────── */}
            {filtered.length > 0 && !isMobile && (
              <div className="mc-table-wrap">
                <table className="mc-table">
                  <thead>
                    <tr>
                      <th>Farmer</th>
                      <th>Session</th>
                      <th>Exp. Qty</th>
                      <th>Actual Qty (L)</th>
                      <th>Fat %</th>
                      <th>SNF %</th>
                      <th>Rate / L (₹)</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const isPending = c.status === "pending";
                      const edit = edits[c._id] || {};
                      const previewAmt = isPending
                        ? (parseFloat(edit.actualQty || 0) * parseFloat(edit.ratePerLiter || 0)).toFixed(2)
                        : (c.totalAmount || 0).toFixed(2);

                      return (
                        <tr
                          key={c._id}
                          className={isPending ? "mc-row--pending" : "mc-row--confirmed"}
                        >
                          <td>
                            <div className="mc-farmer-name">{c.supplierId?.name || "—"}</div>
                            <div className="mc-farmer-phone">{c.supplierId?.phone}</div>
                          </td>
                          <td>
                            <span className={`mc-session-pill ${c.session}`}>{c.session}</span>
                          </td>
                          <td>{c.expectedQty ?? "—"}</td>
                          <td>
                            {isPending ? (
                              <input
                                ref={(el) => { inputRefs.current[c._id] = el; }}
                                type="number"
                                min="0"
                                step="0.1"
                                className="mc-input"
                                value={edit.actualQty ?? ""}
                                onChange={(e) => setEdit(c._id, "actualQty", e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, c)}
                              />
                            ) : c.actualQty}
                          </td>
                          <td>
                            {isPending ? (
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                className="mc-input mc-input--narrow"
                                value={edit.fatContent ?? ""}
                                onChange={(e) => setEdit(c._id, "fatContent", e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, c)}
                                placeholder="opt."
                              />
                            ) : (c.fatContent != null ? c.fatContent : <span className="text-muted">—</span>)}
                          </td>
                          <td>
                            {isPending ? (
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                className="mc-input mc-input--narrow"
                                value={edit.snf ?? ""}
                                onChange={(e) => setEdit(c._id, "snf", e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, c)}
                                placeholder="opt."
                              />
                            ) : (c.snf != null ? c.snf : <span className="text-muted">—</span>)}
                          </td>
                          <td>
                            {isPending ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="mc-input"
                                value={edit.ratePerLiter ?? ""}
                                onChange={(e) => setEdit(c._id, "ratePerLiter", e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, c)}
                              />
                            ) : `₹${Number(c.ratePerLiter || 0).toFixed(2)}`}
                          </td>
                          <td className="mc-amount">₹{previewAmt}</td>
                          <td>
                            <StatusTag value={c.status} />
                            {wasEdited(c) && <span className="mc-edited-badge">edited</span>}
                          </td>
                          <td>
                            {isPending ? (
                              <div className="mc-row-actions">
                                <button
                                  className="mini-button"
                                  onClick={() => handleNoSupply(c)}
                                  disabled={confirmingId === c._id}
                                  title="Record no supply (0 L)"
                                >
                                  0
                                </button>
                                <button
                                  className="mini-button active"
                                  onClick={() => handleConfirmOne(c)}
                                  disabled={confirmingId === c._id}
                                >
                                  {confirmingId === c._id ? "…" : "Confirm"}
                                </button>
                              </div>
                            ) : (
                              <span className="mc-confirm-icon">✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Mobile cards ─────────────────────────────────────────── */}
            {filtered.length > 0 && isMobile && (
              <div className="mc-card-list">
                {filtered.map((c) => {
                  const isPending = c.status === "pending";
                  const edit = edits[c._id] || {};
                  const previewAmt = isPending
                    ? (parseFloat(edit.actualQty || 0) * parseFloat(edit.ratePerLiter || 0)).toFixed(2)
                    : (c.totalAmount || 0).toFixed(2);

                  return (
                    <div
                      key={c._id}
                      className={`mc-card ${isPending ? "mc-card--pending" : "mc-card--confirmed"}`}
                    >
                      {/* Header */}
                      <div className="mc-card-head">
                        <div className="mc-card-identity">
                          <span className="mc-card-name">{c.supplierId?.name || "—"}</span>
                        </div>
                        <div className="mc-card-badges">
                          <span className={`mc-session-pill ${c.session}`}>{c.session}</span>
                          <StatusTag value={c.status} />
                          {wasEdited(c) && <span className="mc-edited-badge">edited</span>}
                        </div>
                      </div>

                      {isPending ? (
                        <>
                          {/* Expected qty */}
                          <div className="mc-card-expected">
                            Expected: <strong>{c.expectedQty ?? "—"} L</strong>
                          </div>

                          {/* Input grid */}
                          <div className="mc-card-inputs">
                            <div className="mc-card-field">
                              <span className="mc-card-field-label">Actual Qty (L)</span>
                              <input
                                ref={(el) => { inputRefs.current[c._id] = el; }}
                                type="number"
                                min="0"
                                step="0.1"
                                value={edit.actualQty ?? ""}
                                onChange={(e) => setEdit(c._id, "actualQty", e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, c)}
                                inputMode="decimal"
                              />
                            </div>
                            <div className="mc-card-field">
                              <span className="mc-card-field-label">Rate / L (₹)</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={edit.ratePerLiter ?? ""}
                                onChange={(e) => setEdit(c._id, "ratePerLiter", e.target.value)}
                                inputMode="decimal"
                              />
                            </div>
                            <div className="mc-card-field">
                              <span className="mc-card-field-label">Fat %</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={edit.fatContent ?? ""}
                                onChange={(e) => setEdit(c._id, "fatContent", e.target.value)}
                                placeholder="opt."
                                inputMode="decimal"
                              />
                            </div>
                            <div className="mc-card-field">
                              <span className="mc-card-field-label">SNF %</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={edit.snf ?? ""}
                                onChange={(e) => setEdit(c._id, "snf", e.target.value)}
                                placeholder="opt."
                                inputMode="decimal"
                              />
                            </div>
                          </div>

                          {/* Amount preview */}
                          <div className="mc-card-amount-row">
                            <span className="mc-card-amount-label">Amount</span>
                            <span className="mc-card-amount-value">₹{previewAmt}</span>
                          </div>

                          {/* Action buttons */}
                          <div className="mc-card-actions">
                            <button
                              className="mini-button"
                              onClick={() => handleNoSupply(c)}
                              disabled={confirmingId === c._id}
                            >
                              No Supply
                            </button>
                            <button
                              className="mini-button active"
                              onClick={() => handleConfirmOne(c)}
                              disabled={confirmingId === c._id}
                            >
                              {confirmingId === c._id ? "Confirming…" : "Confirm ✓"}
                            </button>
                          </div>
                        </>
                      ) : (
                        /* Confirmed: compact read-only body */
                        <div className="mc-card-confirmed-body">
                          <div className="mc-card-confirmed-stat">
                            <span>Actual</span>
                            <strong>{c.actualQty != null ? `${c.actualQty} L` : "—"}</strong>
                          </div>
                          {c.fatContent != null && (
                            <div className="mc-card-confirmed-stat">
                              <span>Fat %</span>
                              <strong>{c.fatContent}</strong>
                            </div>
                          )}
                          {c.snf != null && (
                            <div className="mc-card-confirmed-stat">
                              <span>SNF %</span>
                              <strong>{c.snf}</strong>
                            </div>
                          )}
                          <div className="mc-card-confirmed-stat">
                            <span>Rate</span>
                            <strong>₹{Number(c.ratePerLiter || 0).toFixed(2)}</strong>
                          </div>
                          <div className="mc-card-confirmed-stat amount">
                            <span>Amount</span>
                            <strong>{formatCurrency(c.totalAmount)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Mobile sticky confirm-all ────────────────────────────── */}
            <StickyActionBar visible={isMobile && totalPendingCount > 0}>
              <div className="mc-sticky-confirm">
                <button
                  className="mini-button active"
                  onClick={() => setShowBulkDialog(true)}
                  disabled={bulkConfirming}
                >
                  <CheckCheck size={16} style={{ marginRight: 6 }} />
                  {bulkConfirming ? "Confirming…" : `Confirm All (${totalPendingCount})`}
                </button>
              </div>
            </StickyActionBar>
          </div>
        )}

        {/* ════════════════════════ HISTORY VIEW ══════════════════════ */}
        {view === "history" && (
          <div style={{ padding: 16 }}>

            {/* ── Filters ─────────────────────────────────────────────── */}
            <div className="mc-history-filters">
              <label className="form-field">
                <span>Farmer</span>
                <select
                  value={historyFilters.supplierId}
                  onChange={(e) => setHistoryFilters((f) => ({ ...f, supplierId: e.target.value }))}
                >
                  <option value="">All Farmers</option>
                  {suppliersList.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Session</span>
                <select
                  value={historyFilters.session}
                  onChange={(e) => setHistoryFilters((f) => ({ ...f, session: e.target.value }))}
                >
                  <option value="">All Sessions</option>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </label>
              <label className="form-field">
                <span>From</span>
                <input
                  type="date"
                  value={historyFilters.from}
                  onChange={(e) => setHistoryFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </label>
              <label className="form-field">
                <span>To</span>
                <input
                  type="date"
                  value={historyFilters.to}
                  onChange={(e) => setHistoryFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </label>
              <button
                className="mini-button active"
                onClick={fetchHistory}
                disabled={historyLoading}
              >
                {historyLoading ? "Loading…" : "Apply"}
              </button>
              {history.length > 0 && (
                <button
                  className="mini-button"
                  onClick={() => downloadCSV(history)}
                  title="Export to CSV"
                >
                  <Download size={14} style={{ marginRight: 4 }} />
                  Export
                </button>
              )}
            </div>

            {/* ── History summary totals ───────────────────────────────── */}
            {historySummary && history.length > 0 && (
              <div className="mc-history-summary">
                <div className="mc-history-total-chip">
                  <span>Total Collected</span>
                  <strong>{Number(historySummary.totalLiters).toFixed(1)} L</strong>
                </div>
                <div className="mc-history-total-chip">
                  <span>Total Amount</span>
                  <strong>{formatCurrency(historySummary.totalAmount)}</strong>
                </div>
                {historySummary.avgFat != null && (
                  <div className="mc-history-total-chip">
                    <span>Avg Fat %</span>
                    <strong>{historySummary.avgFat}</strong>
                  </div>
                )}
                {historySummary.avgSNF != null && (
                  <div className="mc-history-total-chip">
                    <span>Avg SNF %</span>
                    <strong>{historySummary.avgSNF}</strong>
                  </div>
                )}
              </div>
            )}

            {/* ── History table/cards ──────────────────────────────────── */}
            {historyLoading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                Loading…
              </div>
            ) : history.length === 0 ? (
              <EmptyState text="No collections found. Set filters above and click Apply to search." />
            ) : isMobile ? (
              /* Mobile: history cards */
              <div className="sc-list">
                {history.map((c) => (
                  <div key={c._id} className="sc-card">
                    <div className="sc-card-head">
                      <div className="sc-card-date">
                        <strong>{formatDate(c.date)}</strong>
                        <span className="sc-session">{c.session}</span>
                      </div>
                      <div className="sc-card-badges">
                        <StatusTag value={c.status} />
                        {c.paymentId ? <StatusTag value="paid" /> : <StatusTag value="unpaid" />}
                        {wasEdited(c) && <span className="mc-edited-badge">edited</span>}
                      </div>
                    </div>
                    <div className="sc-card-head" style={{ background: "var(--surface)", borderTop: 0, paddingTop: 4, paddingBottom: 4 }}>
                      <strong style={{ fontSize: "var(--font-size-xs)" }}>{c.supplierId?.name || "—"}</strong>
                    </div>
                    <div className="sc-card-stats">
                      <div className="sc-stat"><span>Actual</span><strong>{c.actualQty != null ? `${c.actualQty} L` : "—"}</strong></div>
                      <div className="sc-stat"><span>Fat %</span><strong>{c.fatContent != null ? c.fatContent : "—"}</strong></div>
                      <div className="sc-stat"><span>SNF %</span><strong>{c.snf != null ? c.snf : "—"}</strong></div>
                    </div>
                    <div className="sc-card-stats sc-card-stats--bottom">
                      <div className="sc-stat"><span>Rate / L</span><strong>₹{Number(c.ratePerLiter || 0).toFixed(2)}</strong></div>
                      <div className="sc-stat sc-stat--amount"><span>Amount</span><strong>{c.totalAmount != null ? formatCurrency(c.totalAmount) : "—"}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: history table */
              <div className="mc-table-wrap">
                <table className="mc-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Farmer</th>
                      <th>Session</th>
                      <th>Qty (L)</th>
                      <th>Fat %</th>
                      <th>SNF %</th>
                      <th>Rate / L</th>
                      <th>Amount</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((c) => (
                      <tr key={c._id}>
                        <td>{formatDate(c.date)}</td>
                        <td>
                          <span className="mc-farmer-name">{c.supplierId?.name || "—"}</span>
                        </td>
                        <td>
                          <span className={`mc-session-pill ${c.session}`}>{c.session}</span>
                        </td>
                        <td>{c.actualQty ?? <span className="text-muted">—</span>}</td>
                        <td>{c.fatContent != null ? c.fatContent : <span className="text-muted">—</span>}</td>
                        <td>{c.snf != null ? c.snf : <span className="text-muted">—</span>}</td>
                        <td>₹{Number(c.ratePerLiter || 0).toFixed(2)}</td>
                        <td className="mc-amount">{c.totalAmount != null ? formatCurrency(c.totalAmount) : "—"}</td>
                        <td>
                          {c.paymentId ? <StatusTag value="paid" /> : <StatusTag value="unpaid" />}
                          {wasEdited(c) && <span className="mc-edited-badge">edited</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bulk confirm dialog ──────────────────────────────────────── */}
      <ConfirmDialog
        open={showBulkDialog}
        onClose={() => setShowBulkDialog(false)}
        onConfirm={handleBulkConfirm}
        loading={bulkConfirming}
        title="Confirm All Pending Entries"
        message={`Confirm all ${totalPendingCount} pending entries for ${formatDate(selectedDate)} using expected quantities (all sessions)?\n\nEstimated: ${Number(bulkPreviewLiters).toFixed(1)} L · ${formatCurrency(bulkPreviewAmount)}\n\nYou can correct individual entries afterwards if needed.`}
        confirmText="Confirm All"
      />

      {/* ── Missing entries modal ────────────────────────────────────── */}
      <Modal
        open={showMissingModal}
        onClose={() => setShowMissingModal(false)}
        title={`Missing Entries (${missing.length})`}
        footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={() => setShowMissingModal(false)}>Close</button>
          </div>
        }
      >
        <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
          These suppliers have no collection records for the dates below. Click "Fix" to generate and fill them.
        </p>
        <div className="mc-missing-list">
          {missingByDate.map(([date, items]) => (
            <div key={date} className="mc-missing-group">
              <div className="mc-missing-group-date">
                {formatDate(date)} — {items.length} missing
                <button
                  className="mini-button active"
                  style={{ marginLeft: "var(--space-3)", padding: "2px 10px", fontSize: "var(--font-size-xs)" }}
                  onClick={() => handleFixMissing(date)}
                  disabled={fixingDate === date}
                >
                  {fixingDate === date ? "Generating…" : "Fix All"}
                </button>
              </div>
              {items.map((m, i) => (
                <div key={i} className="mc-missing-item">
                  <span className="mc-missing-item-name">{m.supplierName}</span>
                  <span className={`mc-session-pill ${m.session}`}>{m.session}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
