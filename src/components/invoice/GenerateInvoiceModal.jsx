import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, AlertTriangle, User, X, Calendar } from "lucide-react";
import ResponsiveModal from "../ui/ResponsiveModal";
import { apiRequest, safeParseJson } from "../../api/client";
import toast from "react-hot-toast";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Returns "YYYY-MM-DD" for a given year/month/day (local, no timezone shift) */
function localDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function GenerateInvoiceModal({ open, onClose, onSuccess }) {
  const now = new Date();
  const [mode, setMode] = useState("single"); // "single" | "bulk"
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [useCustomEndDate, setUseCustomEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [force, setForce] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  // Derived bounds for the end date picker
  const lastDay = new Date(year, month, 0).getDate(); // last day of selected month
  const endDateMin = localDate(year, month, 1);
  const endDateMax = localDate(year, month, lastDay);

  // Default end date = last day of selected month
  const defaultEndDate = endDateMax;

  // isEarlyBilling is true when the chosen end date is before the last day of the month
  const effectiveEndDate = useCustomEndDate ? endDate : defaultEndDate;
  const isEarlyBilling = useCustomEndDate && endDate !== "" && endDate < endDateMax;

  useEffect(() => {
    if (!open) {
      setResult(null);
      setSelectedCustomer(null);
      setCustomerSearch("");
      setUseCustomEndDate(false);
      setEndDate("");
      setForce(false);
      setNotes("");
      return;
    }
    apiRequest("/api/user/admin/all")
      .then(r => r.json())
      .then(d => setCustomers((d.users || []).filter(u => u.role === "customer")))
      .catch(() => {});
  }, [open]);

  // When month/year changes, clamp the end date to stay within the new month
  useEffect(() => {
    if (!useCustomEndDate || !endDate) return;
    const newMin = localDate(year, month, 1);
    const newMax = localDate(year, month, new Date(year, month, 0).getDate());
    if (endDate < newMin) setEndDate(newMin);
    else if (endDate > newMax) setEndDate(newMax);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  // When enabling custom end date, initialise to last day of month (full month → easy to adjust)
  function handleToggleCustomEndDate(checked) {
    setUseCustomEndDate(checked);
    if (checked && !endDate) {
      setEndDate(endDateMax);
    }
  }

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    ).slice(0, 8);
  }, [customers, customerSearch]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === "single" && !selectedCustomer) {
      toast.error("Select a customer"); return;
    }
    // Validate end date if custom
    if (useCustomEndDate) {
      if (!endDate) { toast.error("Select a billing end date"); return; }
      if (endDate < endDateMin || endDate > endDateMax) {
        toast.error(`End date must be within ${MONTHS[month - 1]} ${year}`); return;
      }
    }
    setSaving(true); setResult(null);
    try {
      let res, payload;
      const billingEndDate = useCustomEndDate ? effectiveEndDate : undefined;

      if (mode === "bulk") {
        res = await apiRequest("/api/invoices/admin/generate-bulk", {
          method: "POST",
          body: JSON.stringify({
            month, year, force,
            isEarlyBilling,
            billingCutoffDate: billingEndDate,
          }),
        });
        payload = await safeParseJson(res);
        if (!res.ok) throw new Error(payload?.message || "Bulk generation failed");
        setResult(payload);
        toast.success(payload.message || "Bulk generation complete");
      } else {
        res = await apiRequest(`/api/invoices/admin/generate/${selectedCustomer._id}`, {
          method: "POST",
          body: JSON.stringify({
            month, year, force,
            isEarlyBilling,
            billingCutoffDate: billingEndDate,
            notes: notes || undefined,
          }),
        });
        payload = await safeParseJson(res);
        if (!res.ok) throw new Error(payload?.message || "Generation failed");
        toast.success(payload.message || "Invoice generated");
        onSuccess?.();
        onClose();
        return;
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Generate Invoice"
      footer={
        result ? (
          <button className="btn btn-primary" onClick={() => { onClose(); onSuccess?.(); }}>Done</button>
        ) : (
          <>
            <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "Generating…" : mode === "bulk" ? "Generate for All" : "Generate"}
            </button>
          </>
        )
      }
    >
      {result ? (
        /* ── Bulk result view ── */
        <div className="form-stack">
          <div className="gen-result-card">
            <CheckCircle2 size={28} style={{ color: "var(--success-text)", flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: "var(--font-weight-bold)", color: "var(--success-text)", margin: "0 0 var(--space-1)" }}>
                Bulk Generation Complete
              </p>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)", margin: 0 }}>
                Generated: <strong>{result.generated}</strong> &nbsp;·&nbsp;
                Skipped: <strong>{result.skipped}</strong> &nbsp;·&nbsp;
                Errors: <strong style={{ color: result.errors?.length ? "var(--danger-text)" : "inherit" }}>
                  {result.errors?.length ?? 0}
                </strong>
              </p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <details className="gen-error-details">
              <summary>View {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}</summary>
              <ul>
                {result.errors.map((e, i) => <li key={i}>{e.userId}: {e.error}</li>)}
              </ul>
            </details>
          )}
        </div>
      ) : (
        /* ── Form ── */
        <form className="form-stack" onSubmit={handleSubmit}>

          {/* Mode tabs */}
          <div className="scrollable-tab-bar" style={{ paddingBottom: 0 }}>
            {[["single", "Single Customer"], ["bulk", "All Customers"]].map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`tab-pill${mode === val ? " active" : ""}`}
                onClick={() => setMode(val)}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "bulk" && (
            <div className="gen-bulk-info">
              <AlertTriangle size={14} style={{ flexShrink: 0, color: "var(--warning-text)" }} />
              <span>Generates invoices for all active customers in the selected period.</span>
            </div>
          )}

          {/* Period */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div className="form-group">
              <label>Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Customer search (single mode only) */}
          {mode === "single" && (
            <div className="form-group">
              <label>Customer</label>
              {selectedCustomer ? (
                <div className="gen-selected-customer">
                  <User size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: "var(--font-size-sm)" }}>
                    {selectedCustomer.name}
                    <span style={{ color: "var(--text-muted)", marginLeft: "var(--space-2)" }}>
                      {selectedCustomer.phone}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }}
                    title="Change customer"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="gen-customer-search">
                  <input
                    type="text"
                    placeholder="Search by name or phone…"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    autoComplete="off"
                  />
                  {customerSearch && filteredCustomers.length > 0 && (
                    <div className="gen-customer-dropdown">
                      {filteredCustomers.map(c => (
                        <button
                          key={c._id}
                          type="button"
                          className="gen-customer-option"
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}
                        >
                          <span className="gen-customer-name">{c.name}</span>
                          <span className="gen-customer-phone">{c.phone || c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {customerSearch && filteredCustomers.length === 0 && (
                    <div className="gen-customer-empty">No matching customers</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Billing end date */}
          <label className="gen-checkbox-row">
            <input
              type="checkbox"
              checked={useCustomEndDate}
              onChange={e => handleToggleCustomEndDate(e.target.checked)}
            />
            <span>Custom Billing End Date</span>
          </label>
          {useCustomEndDate && (
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                Bill End Date
                <span style={{ color: "var(--text-muted)", fontWeight: "var(--font-weight-normal)", fontSize: "var(--font-size-sm)" }}>
                  (defaults to last day of month)
                </span>
              </label>
              <input
                type="date"
                value={endDate}
                min={endDateMin}
                max={endDateMax}
                onChange={e => setEndDate(e.target.value)}
              />
              {isEarlyBilling && (
                <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-xs)", color: "var(--warning-text)" }}>
                  Early billing — invoice will cover {MONTHS[month - 1]} 1 to {endDate}.
                </p>
              )}
              {useCustomEndDate && endDate === endDateMax && (
                <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>
                  Full month billing — same as default.
                </p>
              )}
            </div>
          )}

          {/* Force regenerate */}
          <label className="gen-checkbox-row">
            <input
              type="checkbox"
              checked={force}
              onChange={e => setForce(e.target.checked)}
            />
            <span>Force Regenerate</span>
          </label>
          {force && (
            <div className="gen-force-warning">
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              <span>The existing invoice will be voided and a new one generated.</span>
            </div>
          )}

          {/* Notes (single mode) */}
          {mode === "single" && (
            <div className="form-group">
              <label>Notes <span style={{ color: "var(--text-muted)", fontWeight: "var(--font-weight-normal)" }}>(optional)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Early billing due to customer pause"
              />
            </div>
          )}
        </form>
      )}
    </ResponsiveModal>
  );
}
