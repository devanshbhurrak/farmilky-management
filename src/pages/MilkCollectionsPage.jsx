import { useState, useCallback, useEffect, useRef } from "react";
import { RefreshCw, CheckCheck, Zap } from "lucide-react";
import { apiRequest } from "../api/client";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import PageHeader from "../components/ui/PageHeader";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
import toast from "react-hot-toast";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatCurrency(val) {
  return `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const fetchSuppliersList = createApiFetch("/api/suppliers");

export default function MilkCollectionsPage() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [collections, setCollections] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  // Per-row edit state: { [collectionId]: { actualQty, ratePerLiter, fatContent, snf } }
  const [edits, setEdits] = useState({});
  const [confirmingId, setConfirmingId] = useState(null);
  const [view, setView] = useState("daily"); // "daily" | "history"

  // Suppliers list (for history filter dropdown)
  const { data: suppliersData } = useApiData(fetchSuppliersList);
  const suppliersList = suppliersData?.suppliers ?? [];

  // History state
  const [historyFilters, setHistoryFilters] = useState({ supplierId: "", from: "", to: "" });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchDaily = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/milk-collections/daily?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCollections(data.collections || []);
      setSummary(data.summary || {});
      // Initialize edits for pending entries
      const initEdits = {};
      (data.collections || []).forEach((c) => {
        if (c.status === "pending") {
          initEdits[c._id] = {
            actualQty: c.expectedQty?.toString() ?? "",
            ratePerLiter: c.ratePerLiter?.toString() ?? "",
            fatContent: "",
            snf: "",
          };
        }
      });
      setEdits(initEdits);
    } catch (err) {
      toast.error(err.message || "Failed to load collections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDaily(selectedDate);
  }, [selectedDate, fetchDaily]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await apiRequest("/api/milk-collections/generate", {
        method: "POST",
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      fetchDaily(selectedDate);
    } catch (err) {
      toast.error(err.message || "Failed to generate entries.");
    } finally {
      setGenerating(false);
    }
  }, [selectedDate, fetchDaily]);

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
      toast.success(`${collection.supplierId?.name || "Entry"} (${collection.session}) confirmed.`);
      fetchDaily(selectedDate);
    } catch (err) {
      toast.error(err.message || "Failed to confirm.");
    } finally {
      setConfirmingId(null);
    }
  }, [edits, selectedDate, fetchDaily]);

  const handleBulkConfirm = useCallback(async () => {
    setBulkConfirming(true);
    try {
      const res = await apiRequest("/api/milk-collections/bulk-confirm", {
        method: "POST",
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      fetchDaily(selectedDate);
    } catch (err) {
      toast.error(err.message || "Failed to bulk confirm.");
    } finally {
      setBulkConfirming(false);
    }
  }, [selectedDate, fetchDaily]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ status: "confirmed", limit: "100" });
      if (historyFilters.supplierId) params.set("supplierId", historyFilters.supplierId);
      if (historyFilters.from) params.set("from", historyFilters.from);
      if (historyFilters.to) params.set("to", historyFilters.to);
      const res = await apiRequest(`/api/milk-collections?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setHistory(data.collections || []);
    } catch (err) {
      toast.error(err.message || "Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilters]);

  // Use a ref so the view-switch effect always calls the latest fetchHistory
  // without re-triggering every time the user changes a filter input.
  const fetchHistoryRef = useRef(fetchHistory);
  useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);

  useEffect(() => {
    if (view === "history") fetchHistoryRef.current();
  }, [view]);

  const pendingCount = collections.filter((c) => c.status === "pending").length;

  if (loading) return <LoadingScreen />;

  return (
    <div className="view-stack">
      <PageHeader
        title="Milk Collections"
        subtitle="Daily inbound collection confirmation from farmers"
      />

      {/* View Toggle */}
      <div className="surface" style={{ padding: "0" }}>
        <div className="filter-tabs" style={{ borderBottom: "1px solid var(--border-color, #e5e7eb)", padding: "0 16px" }}>
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

        {view === "daily" && (
          <div style={{ padding: 16 }}>
            {/* Date + Actions Bar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
              <input
                type="date"
                className="search-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: "auto", minWidth: 160 }}
              />
              <button
                className="mini-button"
                onClick={handleGenerate}
                disabled={generating}
                title="Generate pending entries for all active suppliers"
              >
                <Zap size={14} style={{ marginRight: 4 }} />
                {generating ? "Generating..." : "Generate Entries"}
              </button>
              <button
                className="mini-button"
                onClick={() => fetchDaily(selectedDate)}
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
              {pendingCount > 0 && (
                <button
                  className="mini-button active"
                  onClick={handleBulkConfirm}
                  disabled={bulkConfirming}
                  title="Confirm all pending entries using expected quantity and pre-set rate"
                >
                  <CheckCheck size={14} style={{ marginRight: 4 }} />
                  {bulkConfirming ? "Confirming..." : `Confirm All (${pendingCount})`}
                </button>
              )}
            </div>

            {/* Summary Bar */}
            {collections.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16, padding: "10px 12px", background: "var(--surface-alt, #f9fafb)", borderRadius: 8, fontSize: "0.9em" }}>
                <span><strong>{summary.total ?? 0}</strong> entries</span>
                <span style={{ color: "var(--color-warning, #d97706)" }}><strong>{summary.pending ?? 0}</strong> pending</span>
                <span style={{ color: "var(--color-success, #16a34a)" }}><strong>{summary.confirmed ?? 0}</strong> confirmed</span>
                <span><strong>{Number(summary.totalLiters ?? 0).toFixed(1)} L</strong> collected</span>
                <span><strong>{formatCurrency(summary.totalAmount)}</strong> total</span>
              </div>
            )}

            {collections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted, #888)" }}>
                <p>No entries for this date.</p>
                <button className="primary-button" onClick={handleGenerate} disabled={generating} style={{ marginTop: 12 }}>
                  <Zap size={16} /> {generating ? "Generating..." : "Generate Entries"}
                </button>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-color, #e5e7eb)", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Farmer</th>
                      <th style={{ padding: "8px 10px" }}>Session</th>
                      <th style={{ padding: "8px 10px" }}>Exp. Qty (L)</th>
                      <th style={{ padding: "8px 10px" }}>Actual Qty (L)</th>
                      <th style={{ padding: "8px 10px" }}>Fat %</th>
                      <th style={{ padding: "8px 10px" }}>SNF %</th>
                      <th style={{ padding: "8px 10px" }}>Rate / L (₹)</th>
                      <th style={{ padding: "8px 10px" }}>Amount</th>
                      <th style={{ padding: "8px 10px" }}>Status</th>
                      <th style={{ padding: "8px 10px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((c) => {
                      const isPending = c.status === "pending";
                      const edit = edits[c._id] || {};
                      const previewAmt = isPending
                        ? (parseFloat(edit.actualQty || 0) * parseFloat(edit.ratePerLiter || 0)).toFixed(2)
                        : (c.totalAmount || 0).toFixed(2);

                      return (
                        <tr
                          key={c._id}
                          style={{
                            borderBottom: "1px solid var(--border-color, #e5e7eb)",
                            background: isPending ? "var(--surface, #fff)" : "var(--surface-alt, #f9fafb)",
                          }}
                        >
                          <td style={{ padding: "8px 10px" }}>
                            <strong>{c.supplierId?.name || "—"}</strong>
                            <div className="text-muted" style={{ fontSize: "0.8em" }}>{c.supplierId?.phone}</div>
                          </td>
                          <td style={{ padding: "8px 10px", textTransform: "capitalize" }}>{c.session}</td>
                          <td style={{ padding: "8px 10px" }}>{c.expectedQty ?? "—"}</td>
                          <td style={{ padding: "8px 10px" }}>
                            {isPending ? (
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={edit.actualQty ?? ""}
                                onChange={(e) => setEdits((prev) => ({ ...prev, [c._id]: { ...prev[c._id], actualQty: e.target.value } }))}
                                style={{ width: 80, padding: "4px 6px", border: "1px solid var(--border-color, #d1d5db)", borderRadius: 4 }}
                              />
                            ) : c.actualQty}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {isPending ? (
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={edit.fatContent ?? ""}
                                onChange={(e) => setEdits((prev) => ({ ...prev, [c._id]: { ...prev[c._id], fatContent: e.target.value } }))}
                                style={{ width: 70, padding: "4px 6px", border: "1px solid var(--border-color, #d1d5db)", borderRadius: 4 }}
                                placeholder="opt."
                              />
                            ) : (c.fatContent != null ? c.fatContent : <span className="text-muted">—</span>)}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {isPending ? (
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={edit.snf ?? ""}
                                onChange={(e) => setEdits((prev) => ({ ...prev, [c._id]: { ...prev[c._id], snf: e.target.value } }))}
                                style={{ width: 70, padding: "4px 6px", border: "1px solid var(--border-color, #d1d5db)", borderRadius: 4 }}
                                placeholder="opt."
                              />
                            ) : (c.snf != null ? c.snf : <span className="text-muted">—</span>)}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {isPending ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={edit.ratePerLiter ?? ""}
                                onChange={(e) => setEdits((prev) => ({ ...prev, [c._id]: { ...prev[c._id], ratePerLiter: e.target.value } }))}
                                style={{ width: 80, padding: "4px 6px", border: "1px solid var(--border-color, #d1d5db)", borderRadius: 4 }}
                              />
                            ) : `₹${Number(c.ratePerLiter || 0).toFixed(2)}`}
                          </td>
                          <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                            ₹{previewAmt}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <StatusTag value={c.status} />
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {isPending && (
                              <button
                                className="mini-button active"
                                onClick={() => handleConfirmOne(c)}
                                disabled={confirmingId === c._id}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {confirmingId === c._id ? "..." : "Confirm"}
                              </button>
                            )}
                            {!isPending && (
                              <span style={{ color: "var(--color-success, #16a34a)", fontSize: "1.1em" }}>✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === "history" && (
          <div style={{ padding: 16 }}>
            {/* History Filters */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85em" }}>
                <span>Farmer</span>
                <select
                  className="search-input"
                  value={historyFilters.supplierId}
                  onChange={(e) => setHistoryFilters((f) => ({ ...f, supplierId: e.target.value }))}
                  style={{ width: 180 }}
                >
                  <option value="">All Farmers</option>
                  {suppliersList.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85em" }}>
                <span>From</span>
                <input
                  type="date"
                  className="search-input"
                  value={historyFilters.from}
                  onChange={(e) => setHistoryFilters((f) => ({ ...f, from: e.target.value }))}
                  style={{ width: 160 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85em" }}>
                <span>To</span>
                <input
                  type="date"
                  className="search-input"
                  value={historyFilters.to}
                  onChange={(e) => setHistoryFilters((f) => ({ ...f, to: e.target.value }))}
                  style={{ width: 160 }}
                />
              </label>
              <button className="mini-button" onClick={fetchHistory} disabled={historyLoading}>
                {historyLoading ? "Loading..." : "Apply"}
              </button>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted, #888)" }}>Loading...</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted, #888)" }}>No confirmed collections found.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-color, #e5e7eb)", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Date</th>
                      <th style={{ padding: "8px 10px" }}>Farmer</th>
                      <th style={{ padding: "8px 10px" }}>Session</th>
                      <th style={{ padding: "8px 10px" }}>Qty (L)</th>
                      <th style={{ padding: "8px 10px" }}>Fat %</th>
                      <th style={{ padding: "8px 10px" }}>SNF %</th>
                      <th style={{ padding: "8px 10px" }}>Rate / L</th>
                      <th style={{ padding: "8px 10px" }}>Amount</th>
                      <th style={{ padding: "8px 10px" }}>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((c) => (
                      <tr key={c._id} style={{ borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                        <td style={{ padding: "8px 10px" }}>
                          {new Date(c.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <strong>{c.supplierId?.name || "—"}</strong>
                        </td>
                        <td style={{ padding: "8px 10px", textTransform: "capitalize" }}>{c.session}</td>
                        <td style={{ padding: "8px 10px" }}>{c.actualQty ?? "—"}</td>
                        <td style={{ padding: "8px 10px" }}>{c.fatContent != null ? c.fatContent : <span className="text-muted">—</span>}</td>
                        <td style={{ padding: "8px 10px" }}>{c.snf != null ? c.snf : <span className="text-muted">—</span>}</td>
                        <td style={{ padding: "8px 10px" }}>₹{Number(c.ratePerLiter || 0).toFixed(2)}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>{formatCurrency(c.totalAmount)}</td>
                        <td style={{ padding: "8px 10px" }}>
                          {c.paymentId ? (
                            <StatusTag value="paid" />
                          ) : (
                            <StatusTag value="unpaid" />
                          )}
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
    </div>
  );
}
