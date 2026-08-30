import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FileText, Download, MessageCircle, CheckCircle2,
  XCircle, RefreshCw, ChevronDown, ChevronUp,
  Calendar, User, Printer,
} from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import PageSkeleton from "../components/ui/PageSkeleton";
import PageError from "../components/ui/PageError";
import StatusTag from "../components/ui/StatusTag";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import { apiRequest, safeParseJson } from "../api/client";
import toast from "react-hot-toast";

function monthYearLabel(m, y) {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[m - 1]} ${y}`;
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLineItems, setShowLineItems] = useState(false);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [markPaidConfirm, setMarkPaidConfirm] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [sending, setSending] = useState(false);
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchInvoice = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiRequest(`/api/invoices/admin/${id}`);
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed to load"); }
      const data = await res.json();
      setInvoice(data.invoice);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  async function handleSendWhatsApp() {
    const phone = (invoice.userId?.phone || "").replace(/\D/g, "");
    if (!phone) { toast.error("Customer has no phone number."); return; }
    const waPhone = phone.startsWith("91") ? phone : `91${phone}`;
    const period = monthYearLabel(invoice.billingPeriod.month, invoice.billingPeriod.year);
    const msg =
      `Hi ${invoice.userId?.name || ""},\n\n` +
      `Your *Farmilky* invoice *${invoice.invoiceNumber}* for *${period}* is ready.\n\n` +
      `💰 Net Amount Due: *₹${invoice.netAmountDue}*\n\n` +
      `Please find the invoice PDF attached.\n\nThank you! 🙏\n— Farmilky Team`;

    setSending(true);
    let blob;
    try {
      const res = await apiRequest(`/api/invoices/admin/${id}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      blob = await res.blob();
    } catch (err) {
      toast.error("Could not generate PDF: " + err.message);
      setSending(false);
      return;
    }

    const pdfFile = new File([blob], `${invoice.invoiceNumber}.pdf`, { type: "application/pdf" });

    // Android / mobile: Web Share API → native share sheet → pick WhatsApp → PDF pre-attached
    if (navigator.canShare?.({ files: [pdfFile] })) {
      try {
        await navigator.share({ files: [pdfFile], text: msg });
      } catch (err) {
        if (err.name === "AbortError") { setSending(false); return; }
        // share failed — fall through to desktop fallback
      }
    } else {
      // Desktop fallback: download PDF + open WhatsApp Web in new tab
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl; a.download = pdfFile.name; a.click();
      URL.revokeObjectURL(dlUrl);
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank");
      toast.success("PDF downloaded — attach it in the WhatsApp tab that opened.");
    }

    // Mark as sent
    try {
      await apiRequest(`/api/invoices/admin/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: invoice.status === "draft" ? "sent" : invoice.status }),
      });
      fetchInvoice();
    } catch (_) {}
    setSending(false);
  }

  async function handleDownloadPDF(detailed = false) {
    try {
      const res = await apiRequest(`/api/invoices/admin/${id}/pdf?detailed=${detailed}`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${invoice.invoiceNumber}${detailed ? "-detailed" : ""}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
  }

  async function handleMarkPaid() {
    setMarkingPaid(true);
    try {
      const res = await apiRequest(`/api/invoices/admin/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed"); }
      toast.success("Invoice marked as paid");
      setMarkPaidConfirm(false);
      fetchInvoice();
    } catch (err) { toast.error(err.message); }
    finally { setMarkingPaid(false); }
  }

  async function handleVoid(e) {
    e.preventDefault();
    if (!voidReason.trim()) { toast.error("Please provide a reason"); return; }
    setVoiding(true);
    try {
      const res = await apiRequest(`/api/invoices/admin/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "void", voidReason }),
      });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed"); }
      toast.success("Invoice voided");
      setVoidModalOpen(false);
      fetchInvoice();
    } catch (err) { toast.error(err.message); }
    finally { setVoiding(false); }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await apiRequest(`/api/invoices/admin/${id}/regenerate`, { method: "POST" });
      const p = await safeParseJson(res);
      if (!res.ok) throw new Error(p?.message || "Failed");
      toast.success("Invoice regenerated");
      setRegenerateConfirm(false);
      if (p.invoice?._id) navigate(`/invoices/${p.invoice._id}`);
      else fetchInvoice();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={fetchInvoice} />;
  if (!invoice) return null;

  const isVoid = invoice.status === "void";
  const isPaid = invoice.status === "paid";

  return (
    <div className="view-stack inv-detail-wrap">

      {/* Breadcrumb + Header */}
      <div>
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: "var(--space-3)" }}>
          <Link to="/invoices">Invoices</Link>
          <span className="breadcrumb-separator" aria-hidden="true">›</span>
          <span>{invoice.invoiceNumber}</span>
        </nav>

        <div className="inv-detail-header">
          <div className="inv-detail-title-row">
            <h1 className="inv-detail-title">{invoice.invoiceNumber}</h1>
            <div className="inv-detail-badges">
              <StatusTag value={invoice.status} />
              {invoice.isEarlyBilling && (
                <span className="inv-early-badge">Early Billing</span>
              )}
            </div>
            <span className="inv-detail-period">
              <Calendar size={12} aria-hidden />
              {monthYearLabel(invoice.billingPeriod.month, invoice.billingPeriod.year)}
            </span>
          </div>

          {/* Action buttons — grouped by intent */}
          {!isVoid && (
            <div className="inv-detail-actions">
              <div className="inv-action-group">
                <button className="btn btn-sm" onClick={() => handleDownloadPDF(false)} title="Download compact PDF">
                  <Download size={14} /> PDF
                </button>
                <button className="btn btn-sm" onClick={() => handleDownloadPDF(true)} title="Download detailed PDF">
                  <Printer size={14} /> Detailed
                </button>
                <button className="btn btn-sm" onClick={handleSendWhatsApp} disabled={sending}>
                  <MessageCircle size={14} /> {sending ? "Sending…" : "WhatsApp"}
                </button>
              </div>
              {!isPaid && (
                <div className="inv-action-group">
                  <button
                    className="btn btn-sm inv-btn-success"
                    onClick={() => setMarkPaidConfirm(true)}
                  >
                    <CheckCircle2 size={14} /> Mark Paid
                  </button>
                  <button className="btn btn-sm" onClick={() => setRegenerateConfirm(true)} title="Regenerate invoice">
                    <RefreshCw size={14} /> Regenerate
                  </button>
                  <button
                    className="btn btn-sm inv-btn-danger"
                    onClick={() => setVoidModalOpen(true)}
                  >
                    <XCircle size={14} /> Void
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Replaced-by notice */}
      {invoice.replacedByInvoice && (
        <div className="inv-replaced-banner">
          This invoice was replaced by{" "}
          <Link to={`/invoices/${invoice.replacedByInvoice._id}`} style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-primary)" }}>
            {invoice.replacedByInvoice.invoiceNumber}
          </Link>
        </div>
      )}

      {/* Void notice */}
      {isVoid && invoice.voidReason && (
        <div className="inv-void-banner">
          <XCircle size={15} style={{ flexShrink: 0 }} />
          <span><strong>Voided:</strong> {invoice.voidReason}</span>
        </div>
      )}

      {/* Customer card */}
      <div className="surface-card card-inset">
        <div className="inv-customer-header">
          <User size={14} style={{ color: "var(--text-muted)" }} />
          <span className="eyebrow" style={{ margin: 0 }}>Billed To</span>
        </div>
        <div className="inv-customer-meta">
          <div className="inv-customer-primary">
            <p style={{ fontWeight: "var(--font-weight-bold)", color: "var(--text-primary)", margin: 0 }}>
              {invoice.userId?.name}
            </p>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)", margin: 0 }}>
              {invoice.userId?.phone}
            </p>
            {invoice.userId?.email && (
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)", margin: 0 }}>
                {invoice.userId.email}
              </p>
            )}
          </div>
          <div className="inv-customer-dates">
            <div className="inv-meta-item">
              <span className="inv-meta-label">Generated</span>
              <span className="inv-meta-value">{formatDate(invoice.createdAt)}</span>
            </div>
            {invoice.sentAt && (
              <div className="inv-meta-item">
                <span className="inv-meta-label">Sent via {invoice.sentVia}</span>
                <span className="inv-meta-value">{formatDate(invoice.sentAt)}</span>
              </div>
            )}
            {invoice.paidAt && (
              <div className="inv-meta-item">
                <span className="inv-meta-label">Paid on</span>
                <span className="inv-meta-value" style={{ color: "var(--color-primary)" }}>
                  {formatDate(invoice.paidAt)}
                </span>
              </div>
            )}
          </div>
        </div>
        {invoice.notes && (
          <p className="inv-customer-note">
            {invoice.notes}
          </p>
        )}
      </div>

      {/* Product Summary */}
      {invoice.productSummary?.length > 0 && (
        <div className="surface-card">
          <div className="card-inset" style={{ borderBottom: "1px solid var(--border-soft)", paddingBottom: "var(--space-3)" }}>
            <h3 style={{ margin: 0, fontSize: "var(--font-size-base)", fontWeight: "var(--font-weight-bold)" }}>
              Product Summary
            </h3>
          </div>
          <div className="ledger-table-wrapper">
            <table className="ledger-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  {["Product", "Qty", "Avg Rate", "Amount", "Paid", "Outstanding"].map(h => (
                    <th key={h} style={{ textAlign: h === "Product" ? "left" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.productSummary.map((p, i) => (
                  <tr key={i}>
                    <td>
                      <strong style={{ display: "block", color: "var(--text-primary)" }}>{p.productName}</strong>
                      {p.variantLabel && (
                        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>{p.variantLabel}</span>
                      )}
                      {p.rateBreakdown?.length > 0 && (
                        <details style={{ marginTop: 2 }}>
                          <summary style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)", cursor: "pointer" }}>
                            Rate breakdown
                          </summary>
                          {p.rateBreakdown.map((rb, j) => (
                            <span key={j} style={{ display: "block", fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>
                              ₹{rb.rate}/{p.unit} × {rb.quantity} = {formatCurrency(rb.amount)}
                            </span>
                          ))}
                        </details>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>{p.totalQuantity} {p.unit}</td>
                    <td style={{ textAlign: "right" }}>₹{p.avgRate?.toFixed(2)}/{p.unit}</td>
                    <td style={{ textAlign: "right", fontWeight: "var(--font-weight-bold)" }}>{formatCurrency(p.totalAmount)}</td>
                    <td style={{ textAlign: "right", color: "var(--color-primary)" }}>{formatCurrency(p.paidAmount)}</td>
                    <td style={{ textAlign: "right", fontWeight: "var(--font-weight-bold)", color: p.outstandingAmount > 0 ? "var(--danger)" : "var(--color-primary)" }}>
                      {formatCurrency(p.outstandingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Summary */}
      <div className="surface-card card-inset">
        <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--font-size-base)", fontWeight: "var(--font-weight-bold)" }}>
          Invoice Summary
        </h3>
        <div className="inv-summary-ledger">
          {invoice.previousBalance !== 0 && (
            <div className="inv-ledger-row">
              <span style={{ color: "var(--text-muted)" }}>Previous Balance B/F</span>
              <span style={{ fontWeight: "var(--font-weight-bold)", color: invoice.previousBalance > 0 ? "var(--danger)" : "var(--color-primary)" }}>
                {formatCurrency(invoice.previousBalance)}
              </span>
            </div>
          )}
          <div className="inv-ledger-row">
            <span style={{ color: "var(--text-muted)" }}>Total Charges</span>
            <span>{formatCurrency(invoice.totalCharges)}</span>
          </div>
          {invoice.orderCredits > 0 && (
            <div className="inv-ledger-row">
              <span style={{ color: "var(--text-muted)" }}>Order Credits</span>
              <span style={{ color: "var(--color-primary)" }}>({formatCurrency(invoice.orderCredits)})</span>
            </div>
          )}
          <div className="inv-ledger-row">
            <span style={{ color: "var(--text-muted)" }}>Payments Received</span>
            <span style={{ color: "var(--color-primary)" }}>({formatCurrency(invoice.totalPayments)})</span>
          </div>
          {invoice.totalAdjustments !== 0 && (
            <div className="inv-ledger-row">
              <span style={{ color: "var(--text-muted)" }}>Adjustments</span>
              <span>{formatCurrency(invoice.totalAdjustments)}</span>
            </div>
          )}
          <div className="inv-ledger-row inv-ledger-total">
            <span>Net Amount Due</span>
            <span style={{ color: invoice.netAmountDue <= 0 ? "var(--color-primary)" : "var(--danger)" }}>
              {formatCurrency(invoice.netAmountDue)}
            </span>
          </div>
          {invoice.netAmountDue <= 0 && (
            <p className="inv-settled-note">✓ Account fully settled</p>
          )}
        </div>
      </div>

      {/* Detailed line items — collapsible */}
      {invoice.lineItems?.length > 0 && (
        <div className="surface-card">
          <button
            className="card-inset inv-log-toggle"
            onClick={() => setShowLineItems(v => !v)}
            aria-expanded={showLineItems}
          >
            <h3 style={{ margin: 0, fontSize: "var(--font-size-base)", fontWeight: "var(--font-weight-bold)" }}>
              Transaction Log <span style={{ color: "var(--text-muted)", fontWeight: "var(--font-weight-medium)" }}>({invoice.lineItems.length})</span>
            </h3>
            {showLineItems ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showLineItems && (
            <div className="ledger-table-wrapper">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th style={{ textAlign: "right" }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDate(item.date)}</td>
                      <td>
                        <span className="ledger-ref">{item.description}</span>
                        {item.productName && (
                          <span className="ledger-by">
                            {item.productName}{item.variantLabel ? ` (${item.variantLabel})` : ""}
                          </span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{item.category}</td>
                      <td style={{ textAlign: "right" }}>{item.quantity != null ? item.quantity : "—"}</td>
                      <td style={{ textAlign: "right", color: item.entryType === "credit" ? "var(--color-primary)" : "var(--text-primary)" }}>
                        {formatCurrency(item.amount)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`inv-entry-badge ${item.entryType === "credit" ? "inv-entry-cr" : "inv-entry-dr"}`}>
                          {item.entryType === "credit" ? "CR" : "DR"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Void modal */}
      <ResponsiveModal
        open={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
        title="Void Invoice"
        footer={
          <>
            <button className="btn" onClick={() => setVoidModalOpen(false)} disabled={voiding}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={handleVoid}
              disabled={voiding || !voidReason.trim()}
            >
              {voiding ? "Voiding…" : "Void Invoice"}
            </button>
          </>
        }
      >
        <div className="form-stack">
          <div className="inv-void-info">
            <p>Voiding marks this invoice as cancelled. You can regenerate a corrected invoice afterwards.</p>
          </div>
          <div className="form-group">
            <label>Reason for voiding <span style={{ color: "var(--danger)" }}>*</span></label>
            <textarea
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              rows={3}
              placeholder="e.g. Incorrect charges, customer dispute…"
            />
          </div>
        </div>
      </ResponsiveModal>

      {/* Mark Paid confirm */}
      <ConfirmDialog
        open={markPaidConfirm}
        onClose={() => setMarkPaidConfirm(false)}
        title="Mark as Paid"
        message="Mark this invoice as fully paid? This will update the invoice status to Paid."
        confirmText="Mark Paid"
        variant="primary"
        onConfirm={handleMarkPaid}
        loading={markingPaid}
      />

      {/* Regenerate confirm */}
      <ConfirmDialog
        open={regenerateConfirm}
        onClose={() => setRegenerateConfirm(false)}
        title="Regenerate Invoice"
        message="This will void the current invoice and generate a fresh one from the latest ledger data. Are you sure?"
        confirmText="Regenerate"
        variant="danger"
        onConfirm={handleRegenerate}
        loading={regenerating}
      />
    </div>
  );
}
