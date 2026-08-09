import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { CheckCheck, AlertTriangle, Download, ChevronDown, SquarePen, CalendarDays, Ban, Phone, Search, X } from "lucide-react";
import { apiRequest } from "../api/client";
import { formatCurrency } from "../utils/format";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { useMediaQuery } from "../hooks/useMediaQuery";
import PageHeader from "../components/ui/PageHeader";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import QuickChips from "../components/ui/QuickChips";
import StickyActionBar from "../components/ui/StickyActionBar";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import toast from "react-hot-toast";

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  } catch { /* ignored */ }
}

function loadDraft(date) {
  try {
    const raw = sessionStorage.getItem(`mc-drafts-${date}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft(date) {
  try { sessionStorage.removeItem(`mc-drafts-${date}`); } catch { /* ignored */ }
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

const HISTORY_SESSION_OPTIONS = [
  { label: "All", value: "" },
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

  // Per-row edit state: { [id]: { actualQty, ratePerLiter, fatContent, snf } }
  const [edits, setEdits] = useState({});
  const [confirmingId, setConfirmingId] = useState(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  // Track initial edit values for dirty detection
  const initialEditsRef = useRef({});

  // Input refs for keyboard navigation (actualQty inputs keyed by collection id)
  const inputRefs = useRef({});
  const dateInputRef = useRef(null);

  // Collapsible cards — all cards start closed
  const [openCards, setOpenCards] = useState(() => new Set());

  const toggleCard = useCallback((id) => {
    setOpenCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Missing entries
  const [missing, setMissing] = useState([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [fixingDate, setFixingDate] = useState(null);

  // Suppliers for history dropdown
  const { data: suppliersData } = useApiData(fetchSuppliersList);
  const suppliersList = suppliersData?.suppliers ?? [];

  // History
  const [historyFilters, setHistoryFilters] = useState({ supplierId: "", from: "", to: "" });
  const [historySessionFilter, setHistorySessionFilter] = useState("");
  const [historyDateOpen, setHistoryDateOpen] = useState(false);
  const [historyFarmerOpen, setHistoryFarmerOpen] = useState(false);
  const farmerDropdownRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Collection edit
  const [colEditTarget, setColEditTarget] = useState(null);
  const [colEditForm, setColEditForm] = useState({});
  const [savingCol, setSavingCol] = useState(false);

  // ─── Derived data ──────────────────────────────────────────────────────────

  const displayedHistory = useMemo(
    () => historySessionFilter ? history.filter((c) => c.session === historySessionFilter) : history,
    [history, historySessionFilter]
  );

  const filtered = useMemo(() => {
    let result = collections;
    if (sessionFilter !== "all") result = result.filter((c) => c.session === sessionFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((c) => c.supplierId?.name?.toLowerCase().includes(term));
    }
    return result;
  }, [collections, sessionFilter, searchTerm]);

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

  // ─── Missing entries check (last 3 days, excluding today) ─────────────────

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 3);
    const fromStr = from.toISOString().split("T")[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const toStr = yesterday.toISOString().split("T")[0];

    // No missing entries possible if window is today-only
    if (fromStr > toStr) return;

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

  const openColEdit = useCallback((c) => {
    setColEditTarget(c);
    setColEditForm({
      actualQty: c.actualQty?.toString() ?? "",
      ratePerLiter: c.ratePerLiter?.toString() ?? "",
      fatContent: c.fatContent?.toString() ?? "",
      snf: c.snf?.toString() ?? "",
      notes: c.notes ?? "",
    });
  }, []);

  const handleColSave = useCallback(async () => {
    if (!colEditTarget) return;
    setSavingCol(true);
    try {
      const body = {
        actualQty: colEditForm.actualQty !== "" ? parseFloat(colEditForm.actualQty) : undefined,
        ratePerLiter: colEditForm.ratePerLiter !== "" ? parseFloat(colEditForm.ratePerLiter) : undefined,
        fatContent: colEditForm.fatContent !== "" ? parseFloat(colEditForm.fatContent) : null,
        snf: colEditForm.snf !== "" ? parseFloat(colEditForm.snf) : null,
        notes: colEditForm.notes,
      };
      const res = await apiRequest(`/api/milk-collections/${colEditTarget._id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Collection updated.");
      setColEditTarget(null);
      if (view === "history") fetchHistory();
      else fetchDaily(selectedDate);
    } catch (err) {
      toast.error(err.message || "Failed to update collection.");
    } finally {
      setSavingCol(false);
    }
  }, [colEditTarget, colEditForm, view, fetchHistory, fetchDaily, selectedDate]);

  useEffect(() => {
    if (view === "history") fetchHistory();
  }, [view, fetchHistory]);

  useEffect(() => {
    if (!historyFarmerOpen) return;
    const handler = (e) => {
      if (farmerDropdownRef.current && !farmerDropdownRef.current.contains(e.target)) {
        setHistoryFarmerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [historyFarmerOpen]);

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
    <div className="view-stack milk-collections-page">
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
          <AlertTriangle size={16} className="mc-alert-icon" style={{ flexShrink: 0 }} />
          <span className="mc-missing-alert-text">
            {missing.length} missing {missing.length === 1 ? "entry" : "entries"} from the last 3 days
          </span>
          <span className="mc-missing-alert-link">Review & Fix →</span>
        </div>
      )}

      {/* ── View tabs ─────────────────────────────────────────────────── */}
      <div className="surface" style={{ padding: 0 }}>
        <div className="mc-tabs">
          <button
            className={`mc-tab ${view === "daily" ? "active" : ""}`}
            onClick={() => setView("daily")}
          >
            Daily Confirmation
          </button>
          <button
            className={`mc-tab ${view === "history" ? "active" : ""}`}
            onClick={() => setView("history")}
          >
            History
          </button>
        </div>

        {/* ════════════════════════ DAILY VIEW ════════════════════════ */}
        {view === "daily" && (
          <div className="mc-content">

            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="mc-toolbar">
              {/* Inline search — full control over height */}
              <div className="mc-search">
                <Search size={14} className="mc-search-icon" aria-hidden />
                <input
                  type="text"
                  className="mc-search-input"
                  placeholder="Search farmer…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="mc-search-clear"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search"
                  >
                    <X size={14} aria-hidden />
                  </button>
                )}
              </div>

              {/* Date button — shows formatted date, hidden input opens picker */}
              <div className="mc-date-group">
                <button
                  className="mc-date-btn"
                  onClick={() => dateInputRef.current?.showPicker()}
                  title="Change date"
                >
                  <CalendarDays size={14} />
                  <span>{new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</span>
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="mc-date-input-hidden"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
              {!isToday && (
                <button
                  className="mini-button mc-today-btn"
                  onClick={() => setSelectedDate(todayStr())}
                  title="Jump to today"
                >
                  Today
                </button>
              )}

              <div className="mc-toolbar-divider" />

              {/* Confirm All — desktop only */}
              {totalPendingCount > 0 && !isMobile && (
                <button
                  className="btn btn-primary mc-confirm-all-btn"
                  onClick={() => setShowBulkDialog(true)}
                  disabled={bulkConfirming}
                >
                  <CheckCheck size={14} />
                  {bulkConfirming ? "Confirming…" : `Confirm All (${totalPendingCount})`}
                </button>
              )}
            </div>

            {/* ── Backdate banner ─────────────────────────────────────── */}
            {!isToday && (
              <div className="mc-backdate-banner">
                <AlertTriangle size={14} />
                Backdated — {formatDate(selectedDate)}. Late entries are timestamped automatically.
              </div>
            )}

            {/* ── All confirmed banner ─────────────────────────────────── */}
            {collections.length > 0 && totalPendingCount === 0 && (
              <div className="mc-day-complete">
                <CheckCheck size={14} />
                <span>All {collections.length} entries confirmed for {formatDate(selectedDate)}</span>
              </div>
            )}

            {/* ── Compact summary bar ──────────────────────────────────── */}
            {collections.length > 0 && (
              <div className="mc-summary">
                <div className="mc-progress-track">
                  <div className="mc-progress-fill" style={{ width: `${progressPct}%` }}>
                    {progressPct >= 15 && (
                      <span className="mc-progress-pct-inside">{progressPct}%</span>
                    )}
                  </div>
                </div>
                <div className="mc-summary-meta">
                  <span className="mc-summary-meta-item">
                    <span className="mc-summary-meta-label">Collected</span>
                    <strong>{Number(summary.totalLiters).toFixed(1)} L</strong>
                  </span>
                  <span className="mc-summary-meta-dot" aria-hidden="true">·</span>
                  <span className="mc-summary-meta-item">
                    <span className="mc-summary-meta-label">Amount</span>
                    <strong>{formatCurrency(summary.totalAmount)}</strong>
                  </span>
                  <span className="mc-summary-meta-item mc-summary-meta-item--pct">
                    <strong>{progressPct}%</strong>
                    <span className="mc-summary-meta-label">confirmed</span>
                  </span>
                </div>
              </div>
            )}

            {/* ── Session filter tabs ─────────────────────────────────── */}
            <div className="mc-session-tabs">
              <QuickChips
                options={SESSION_OPTIONS}
                selected={sessionFilter}
                onSelect={setSessionFilter}
              />
            </div>

            {/* ── Empty state ─────────────────────────────────────────── */}
            {filtered.length === 0 && (
              collections.length === 0 ? (
                <EmptyState text="No active suppliers with collection schedules found for this date. Entries are auto-generated when suppliers have a default quantity set." />
              ) : (
                <EmptyState text="No entries match your current filters." />
              )
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
                                inputMode="decimal"
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
                                inputMode="decimal"
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
                                inputMode="decimal"
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
                                inputMode="decimal"
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
                          </td>
                          <td>
                            {isPending ? (
                              <div className="mc-row-actions">
                                <button
                                  className="mini-button mc-no-supply-btn"
                                  onClick={() => handleNoSupply(c)}
                                  disabled={confirmingId === c._id}
                                  title="Record no supply (0 L)"
                                >
                                  <Ban size={14} />
                                  <span>0 L</span>
                                </button>
                                <button
                                  className="btn mc-confirm-row-btn"
                                  onClick={() => handleConfirmOne(c)}
                                  disabled={confirmingId === c._id}
                                >
                                  {confirmingId === c._id ? "…" : "Confirm"}
                                </button>
                              </div>
                            ) : (
                              <button
                                className="mc-edit-btn"
                                onClick={() => openColEdit(c)}
                                title="Edit confirmed entry"
                                aria-label="Edit confirmed entry"
                              >
                                <SquarePen size={14} />
                              </button>
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
                {[...filtered].sort((a, b) => {
                  if (a.status === b.status) return 0;
                  return a.status === "pending" ? -1 : 1;
                }).map((c) => {
                  const isPending = c.status === "pending";
                  const edit = edits[c._id] || {};
                  const qty = parseFloat(edit.actualQty);
                  const rate = parseFloat(edit.ratePerLiter);
                  const previewAmt = isPending
                    ? (isNaN(qty) || isNaN(rate) ? 0 : qty * rate).toFixed(2)
                    : (c.totalAmount || 0).toFixed(2);
                  const isOpen = openCards.has(c._id);

                  return (
                    <div
                      key={c._id}
                      className={`mc-card ${isPending ? "mc-card--pending" : "mc-card--confirmed"}`}
                    >
                      {/* ── Header ── */}
                      <div
                        className="mc-card-head"
                        onClick={() => toggleCard(c._id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && toggleCard(c._id)}
                        aria-expanded={isOpen}
                      >
                        <div className="mc-card-identity">
                          <span className="mc-card-name">{c.supplierId?.name || "—"}</span>
                          {c.supplierId?.phone && (
                            <a
                              href={`tel:${c.supplierId.phone}`}
                              className="mc-card-phone-icon"
                              onClick={(e) => e.stopPropagation()}
                              title={c.supplierId.phone}
                              aria-label={`Call ${c.supplierId.name}`}
                            >
                              <Phone size={14} />
                            </a>
                          )}
                        </div>
                        <div className="mc-card-head-right">
                          <span className={`mc-session-pill ${c.session}`}>{c.session}</span>
                          {isPending ? (
                            <span className="mc-card-head-meta">{c.expectedQty ?? "—"} L</span>
                          ) : (
                            <span className="mc-card-head-amount">{formatCurrency(c.totalAmount)}</span>
                          )}
                          <ChevronDown size={16} className={`mc-card-chevron${isOpen ? " open" : ""}`} />
                        </div>
                      </div>

                      {/* ── Body ── */}
                      {isOpen && (
                        <div className="mc-card-body">

                          {isPending ? (
                            <>
                              <div className="mc-card-inputs">
                                <div className="mc-card-field mc-card-field--primary">
                                  <span className="mc-card-field-label">
                                    Actual Qty
                                    {c.expectedQty != null && c.expectedQty > 0 && (
                                      <span className="mc-card-field-hint">exp. {c.expectedQty} L</span>
                                    )}
                                  </span>
                                  <div className="mc-card-input-wrap">
                                    <input
                                      ref={(el) => { inputRefs.current[c._id] = el; }}
                                      type="number" min="0" step="0.1"
                                      value={edit.actualQty ?? ""}
                                      onChange={(e) => setEdit(c._id, "actualQty", e.target.value)}
                                      onKeyDown={(e) => handleInputKeyDown(e, c)}
                                      inputMode="decimal"
                                      placeholder="0.0"
                                      disabled={confirmingId === c._id}
                                    />
                                    <span className="mc-card-input-unit">L</span>
                                  </div>
                                </div>
                                <div className="mc-card-field mc-card-field--primary">
                                  <span className="mc-card-field-label">Rate / Litre</span>
                                  <div className="mc-card-input-wrap">
                                    <span className="mc-card-input-prefix">₹</span>
                                    <input
                                      type="number" min="0" step="0.01"
                                      value={edit.ratePerLiter ?? ""}
                                      onChange={(e) => setEdit(c._id, "ratePerLiter", e.target.value)}
                                      inputMode="decimal"
                                      placeholder="0.00"
                                      disabled={confirmingId === c._id}
                                    />
                                  </div>
                                </div>
                                <div className="mc-card-field">
                                  <span className="mc-card-field-label">Fat % <span className="mc-card-field-opt">opt</span></span>
                                  <input
                                    type="number" min="0" step="0.1"
                                    value={edit.fatContent ?? ""}
                                    onChange={(e) => setEdit(c._id, "fatContent", e.target.value)}
                                    inputMode="decimal"
                                    placeholder="—"
                                    disabled={confirmingId === c._id}
                                  />
                                </div>
                                <div className="mc-card-field">
                                  <span className="mc-card-field-label">SNF % <span className="mc-card-field-opt">opt</span></span>
                                  <input
                                    type="number" min="0" step="0.1"
                                    value={edit.snf ?? ""}
                                    onChange={(e) => setEdit(c._id, "snf", e.target.value)}
                                    inputMode="decimal"
                                    placeholder="—"
                                    disabled={confirmingId === c._id}
                                  />
                                </div>
                              </div>

                              <div className="mc-card-footer">
                                <div className="mc-card-footer-est">
                                  <span className="mc-card-footer-est-label">Est. Amount</span>
                                  <span className="mc-card-footer-amount">₹{previewAmt}</span>
                                </div>
                                <div className="mc-card-actions">
                                  <button
                                    className="mc-card-nosupply-btn"
                                    onClick={() => handleNoSupply(c)}
                                    disabled={confirmingId === c._id}
                                  >
                                    No Supply
                                  </button>
                                  <button
                                    className="mc-card-confirm-btn"
                                    onClick={() => handleConfirmOne(c)}
                                    disabled={confirmingId === c._id}
                                  >
                                    {confirmingId === c._id ? "Confirming…" : "Confirm ✓"}
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="mc-card-data">
                              <div className="mc-card-data-main">
                                <div className="mc-card-datum">
                                  <span>Collected</span>
                                  <strong>{c.actualQty != null ? `${c.actualQty} L` : "—"}</strong>
                                </div>
                                <div className="mc-card-datum">
                                  <span>Rate / L</span>
                                  <strong>₹{Number(c.ratePerLiter || 0).toFixed(2)}</strong>
                                </div>
                                {c.fatContent != null && (
                                  <div className="mc-card-datum">
                                    <span>Fat %</span>
                                    <strong>{c.fatContent}%</strong>
                                  </div>
                                )}
                                {c.snf != null && (
                                  <div className="mc-card-datum">
                                    <span>SNF %</span>
                                    <strong>{c.snf}%</strong>
                                  </div>
                                )}
                              </div>
                              <div className="mc-card-total">
                                <span>Total Amount</span>
                                <strong>{formatCurrency(c.totalAmount)}</strong>
                              </div>
                              <div className="mc-card-footer" style={{ justifyContent: "flex-end" }}>
                                <button
                                  className="mini-button"
                                  onClick={() => openColEdit(c)}
                                  title="Edit confirmed entry"
                                >
                                  <SquarePen size={13} style={{ marginRight: 4 }} />
                                  Edit Entry
                                </button>
                              </div>
                            </div>
                          )}
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
                  className="btn btn-primary mc-sticky-confirm-btn"
                  onClick={() => setShowBulkDialog(true)}
                  disabled={bulkConfirming}
                >
                  <CheckCheck size={16} />
                  {bulkConfirming ? "Confirming…" : `Confirm All (${totalPendingCount})`}
                </button>
              </div>
            </StickyActionBar>
          </div>
        )}

        {/* ════════════════════════ HISTORY VIEW ══════════════════════ */}
        {view === "history" && (
          <div className="mc-content">

            {/* ── Filters ─────────────────────────────────────────────── */}
            <div className="mc-hist-filters">
              <div className="mc-hist-filter-row">
                {/* Farmer custom dropdown */}
                <div className="mc-hist-dropdown" ref={farmerDropdownRef}>
                  <button
                    type="button"
                    className={`mc-hist-dropdown-trigger${historyFarmerOpen ? " open" : ""}${historyFilters.supplierId ? " has-value" : ""}`}
                    onClick={() => setHistoryFarmerOpen((o) => !o)}
                    aria-expanded={historyFarmerOpen}
                    aria-haspopup="listbox"
                  >
                    <span className="mc-hist-dropdown-value">
                      {historyFilters.supplierId
                        ? suppliersList.find((s) => s._id === historyFilters.supplierId)?.name ?? "Farmer"
                        : "All Farmers"}
                    </span>
                    <ChevronDown size={14} className={`mc-hist-chevron${historyFarmerOpen ? " open" : ""}`} />
                  </button>
                  {historyFarmerOpen && (
                    <div className="mc-hist-dropdown-menu" role="listbox">
                      {[{ _id: "", name: "All Farmers" }, ...suppliersList].map((s) => (
                        <button
                          key={s._id}
                          type="button"
                          role="option"
                          aria-selected={historyFilters.supplierId === s._id}
                          className={`mc-hist-dropdown-option${historyFilters.supplierId === s._id ? " selected" : ""}`}
                          onClick={() => { setHistoryFilters((f) => ({ ...f, supplierId: s._id })); setHistoryFarmerOpen(false); }}
                        >
                          {s._id === "" && <span className="mc-hist-dropdown-all-icon">·</span>}
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date range toggle */}
                <button
                  className={`mc-hist-date-toggle${historyDateOpen ? " active" : ""}${(historyFilters.from || historyFilters.to) ? " has-value" : ""}`}
                  type="button"
                  onClick={() => setHistoryDateOpen((o) => !o)}
                  aria-expanded={historyDateOpen}
                >
                  <CalendarDays size={14} />
                  <span className="mc-hist-date-label">
                    {historyFilters.from || historyFilters.to
                      ? `${historyFilters.from || "…"} – ${historyFilters.to || "…"}`
                      : "Date Range"}
                  </span>
                  <ChevronDown size={14} className={`mc-hist-chevron${historyDateOpen ? " open" : ""}`} />
                </button>

                {/* Loading indicator */}
                {historyLoading && <span className="mc-hist-loading-dot" aria-label="Loading" />}

                {/* Export icon */}
                {history.length > 0 && (
                  <button
                    className="mc-hist-export-icon"
                    onClick={() => downloadCSV(history)}
                    title="Export CSV"
                    aria-label="Export to CSV"
                  >
                    <Download size={16} />
                  </button>
                )}
              </div>

              {/* Collapsible date inputs */}
              {historyDateOpen && (
                <div className="mc-hist-date-row">
                  <input
                    className="mc-hist-date-input"
                    type="date"
                    value={historyFilters.from}
                    onChange={(e) => setHistoryFilters((f) => ({ ...f, from: e.target.value }))}
                  />
                  <span className="mc-hist-date-sep" aria-hidden="true">–</span>
                  <input
                    className="mc-hist-date-input"
                    type="date"
                    value={historyFilters.to}
                    onChange={(e) => { setHistoryFilters((f) => ({ ...f, to: e.target.value })); setHistoryDateOpen(false); }}
                  />
                  {(historyFilters.from || historyFilters.to) && (
                    <button
                      className="mc-hist-date-clear"
                      type="button"
                      onClick={() => { setHistoryFilters((f) => ({ ...f, from: "", to: "" })); }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Summary strip ───────────────────────────────────────── */}
            {historySummary && history.length > 0 && (
              <div className="mc-hist-summary">
                <div className="mc-hist-summary-card mc-hist-summary-card--liters">
                  <span>Total Collected</span>
                  <strong>{Number(historySummary.totalLiters).toFixed(1)}<em>L</em></strong>
                </div>
                <div className="mc-hist-summary-card mc-hist-summary-card--amount">
                  <span>Total Amount</span>
                  <strong>{formatCurrency(historySummary.totalAmount)}</strong>
                </div>
                {(historySummary.avgFat != null || historySummary.avgSNF != null) && (
                  <div className="mc-hist-summary-secondary">
                    {historySummary.avgFat != null && (
                      <div className="mc-hist-summary-sub">
                        <span>Avg Fat</span>
                        <strong>{historySummary.avgFat}%</strong>
                      </div>
                    )}
                    {historySummary.avgSNF != null && (
                      <div className="mc-hist-summary-sub">
                        <span>Avg SNF</span>
                        <strong>{historySummary.avgSNF}%</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Session tabs ─────────────────────────────────────────── */}
            {history.length > 0 && (
              <div className="mc-session-tabs">
                <QuickChips
                  options={HISTORY_SESSION_OPTIONS}
                  selected={historySessionFilter}
                  onSelect={setHistorySessionFilter}
                />
              </div>
            )}

            {/* ── History table/cards ──────────────────────────────────── */}
            {historyLoading ? (
              <div className="mc-loading-state">Loading…</div>
            ) : history.length === 0 ? (
              <EmptyState text="No collections found. Set filters above and click Apply to search." />
            ) : displayedHistory.length === 0 ? (
              <EmptyState text="No records for the selected session." />
            ) : isMobile ? (
              /* Mobile: history cards */
              <div className="mc-hist-list">
                {displayedHistory.map((c) => (
                  <div key={c._id} className={`mc-hist-card mc-hist-card--${c.session}`}>
                    {/* Top row: name + date/edit */}
                    <div className="mc-hist-card-top">
                      <span className="mc-hist-card-name">{c.supplierId?.name || "—"}</span>
                      <div className="mc-hist-card-aside">
                        <span className="mc-hist-card-date">{formatDate(c.date)}</span>
                        <button className="mc-edit-btn" onClick={() => openColEdit(c)} title="Edit entry" aria-label="Edit entry">
                          <SquarePen size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Badge row */}
                    <div className="mc-hist-card-badges">
                      <span className={`mc-badge mc-badge--session mc-badge--${c.session}`}>{c.session}</span>
                      <span className={`mc-badge mc-badge--${c.status}`}>{c.status}</span>
                      <span className={`mc-badge mc-badge--${c.paymentId ? "paid" : "unpaid"}`}>{c.paymentId ? "paid" : "unpaid"}</span>
                    </div>
                    {/* Stats grid */}
                    <div className="mc-hist-card-stats">
                      <div className="mc-hist-stat-cell"><span>Qty</span><strong>{c.actualQty != null ? `${c.actualQty} L` : "—"}</strong></div>
                      <div className="mc-hist-stat-cell"><span>Fat %</span><strong>{c.fatContent ?? "—"}</strong></div>
                      <div className="mc-hist-stat-cell"><span>SNF %</span><strong>{c.snf ?? "—"}</strong></div>
                      <div className="mc-hist-stat-cell"><span>Rate / L</span><strong>₹{Number(c.ratePerLiter || 0).toFixed(2)}</strong></div>
                    </div>
                    {/* Amount footer */}
                    <div className="mc-hist-card-amount">
                      <span>Total Amount</span>
                      <strong>{c.totalAmount != null ? formatCurrency(c.totalAmount) : "—"}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: history table */
              <div className="mc-table-wrap">
                <table className="mc-table mc-history-table">
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
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedHistory.map((c) => (
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
                        </td>
                        <td>
                          <button className="mc-edit-btn" onClick={() => openColEdit(c)} title="Edit">
                            <SquarePen size={14} />
                          </button>
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

      {/* ── Edit Collection Modal ────────────────────────────────────── */}
      <Modal
        open={!!colEditTarget}
        onClose={() => setColEditTarget(null)}
        title={colEditTarget ? `Edit — ${formatDate(colEditTarget.date)} ${colEditTarget.session} · ${colEditTarget.supplierId?.name || ""}` : "Edit Collection"}
        footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={() => setColEditTarget(null)} disabled={savingCol}>Cancel</button>
            <button className="mini-button active" onClick={handleColSave} disabled={savingCol}>
              {savingCol ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Actual Qty (L)</span>
            <input type="number" min="0" step="0.1"
              value={colEditForm.actualQty}
              onChange={(e) => setColEditForm((f) => ({ ...f, actualQty: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Rate / Liter (₹)</span>
            <input type="number" min="0" step="0.01"
              value={colEditForm.ratePerLiter}
              onChange={(e) => setColEditForm((f) => ({ ...f, ratePerLiter: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Fat %</span>
            <input type="number" min="0" step="0.01"
              value={colEditForm.fatContent}
              onChange={(e) => setColEditForm((f) => ({ ...f, fatContent: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>SNF %</span>
            <input type="number" min="0" step="0.01"
              value={colEditForm.snf}
              onChange={(e) => setColEditForm((f) => ({ ...f, snf: e.target.value }))}
            />
          </label>
          <label className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span>Notes</span>
            <textarea rows={2}
              value={colEditForm.notes}
              onChange={(e) => setColEditForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>
      </Modal>

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
        <p className="mc-missing-desc">
          These suppliers have no collection records for the dates below. Click "Fix" to generate and fill them.
        </p>
        <div className="mc-missing-list">
          {missingByDate.map(([date, items]) => (
            <div key={date} className="mc-missing-group">
              <div className="mc-missing-group-date">
                {formatDate(date)} — {items.length} missing
                <button
                  className="mini-button active mc-missing-fix-btn"
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
