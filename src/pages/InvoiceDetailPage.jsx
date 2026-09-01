import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Download, MessageCircle, CheckCircle2,
  XCircle, RefreshCw, ChevronDown, ChevronUp,
  Calendar, Printer,
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
  const [downloading, setDownloading] = useState(false);
  const downloadInFlight = useRef(false);

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
    if (downloadInFlight.current) return;
    downloadInFlight.current = true;
    setDownloading(true);
    try {
      // Pass frontend brand config as query params so the PDF generator can
      // render the QR code and UPI link even if the backend env vars differ.
      const upiId   = import.meta.env.VITE_UPI_ID      || "";
      const upiName = import.meta.env.VITE_UPI_NAME    || "Farmilky";
      const phone   = import.meta.env.VITE_BRAND_PHONE || "";

      const params = new URLSearchParams({ detailed });
      if (upiId)   params.set("upiId",   upiId);
      if (upiName) params.set("upiName", upiName);
      if (phone)   params.set("phone",   phone);

      const res = await apiRequest(`/api/invoices/admin/${id}/pdf?${params}`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${invoice.invoiceNumber}${detailed ? "-detailed" : ""}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
    finally {
      downloadInFlight.current = false;
      setDownloading(false);
    }
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

      {/* Breadcrumb */}
      <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: "var(--space-3)" }}>
        <Link to="/invoices">Invoices</Link>
        <span className="breadcrumb-separator" aria-hidden="true">›</span>
        <span>{invoice.invoiceNumber}</span>
      </nav>

      {/* Admin Header + Actions */}
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

        {!isVoid && (
          <div className="inv-detail-actions">
            <div className="inv-action-group">
              <button className="btn btn-sm" onClick={() => handleDownloadPDF(false)} disabled={downloading} title="Download compact PDF">
                <Download size={14} /> {downloading ? "…" : "PDF"}
              </button>
              <button className="btn btn-sm" onClick={() => handleDownloadPDF(true)} disabled={downloading} title="Download detailed PDF">
                <Printer size={14} /> {downloading ? "…" : "Detailed"}
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

      {/* Replaced-by banner */}
      {invoice.replacedByInvoice && (
        <div className="inv-replaced-banner">
          This invoice was replaced by{" "}
          <Link to={`/invoices/${invoice.replacedByInvoice._id}`} style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-primary)" }}>
            {invoice.replacedByInvoice.invoiceNumber}
          </Link>
        </div>
      )}

      {/* Void banner */}
      {isVoid && invoice.voidReason && (
        <div className="inv-void-banner">
          <XCircle size={15} style={{ flexShrink: 0 }} />
          <span><strong>Voided:</strong> {invoice.voidReason}</span>
        </div>
      )}

      {/* ── INVOICE DOCUMENT ── */}
      <div className="inv-doc">

        {/* Doc Header: branding + invoice meta */}
        <div className="inv-doc-header">
          <div className="inv-doc-brand">
            <div className="inv-doc-brand-name">FARMILKY</div>
            <div className="inv-doc-brand-sub">Fresh &amp; Pure Milk Delivered Daily</div>
            <div className="inv-doc-brand-tagline">Aapka bharosa, hamari zimmedari.</div>
          </div>
          <div className="inv-doc-meta">
            <div className="inv-doc-invoice-label">INVOICE</div>
            <div className="inv-doc-invoice-num">{invoice.invoiceNumber}</div>
            <StatusTag value={invoice.status} />
          </div>
        </div>

        {/* Two-column: Customer Details + Invoice Info */}
        <div className="inv-doc-info-row">

          {/* Left: Customer Details */}
          <div className="inv-info-box">
            <div className="inv-info-box-header">CUSTOMER DETAILS</div>
            <div className="inv-info-box-body">
              <div className="inv-info-row">
                <span className="inv-info-label">Customer Name</span>
                <span className="inv-info-value">{invoice.userId?.name || "—"}</span>
              </div>
              <div className="inv-info-row">
                <span className="inv-info-label">Mobile No.</span>
                <span className="inv-info-value">{invoice.userId?.phone || "—"}</span>
              </div>
              {invoice.userId?.email && (
                <div className="inv-info-row">
                  <span className="inv-info-label">Email</span>
                  <span className="inv-info-value">{invoice.userId.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Invoice meta */}
          <div className="inv-info-box inv-info-box--meta">
            <div className="inv-info-box-body">
              <div className="inv-info-row">
                <span className="inv-info-label">Bill No.</span>
                <span className="inv-info-value inv-info-value--bold">{invoice.invoiceNumber}</span>
              </div>
              <div className="inv-info-row">
                <span className="inv-info-label">Billing Period</span>
                <span className="inv-info-value">{monthYearLabel(invoice.billingPeriod.month, invoice.billingPeriod.year)}</span>
              </div>
              <div className="inv-info-row">
                <span className="inv-info-label">Bill Date</span>
                <span className="inv-info-value">{formatDate(invoice.createdAt)}</span>
              </div>
              {invoice.sentAt && (
                <div className="inv-info-row">
                  <span className="inv-info-label">Sent On</span>
                  <span className="inv-info-value">{formatDate(invoice.sentAt)}</span>
                </div>
              )}
              {invoice.paidAt && (
                <div className="inv-info-row">
                  <span className="inv-info-label">Paid On</span>
                  <span className="inv-info-value inv-info-value--green">{formatDate(invoice.paidAt)}</span>
                </div>
              )}
              {invoice.isEarlyBilling && (
                <div className="inv-info-row">
                  <span className="inv-info-label">Type</span>
                  <span className="inv-info-value"><span className="inv-early-badge">Early Billing</span></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="inv-doc-section">
          <div className="inv-doc-section-title">INVOICE SUMMARY</div>
          <div className="inv-summary-ledger">
            {invoice.previousBalance !== 0 && (
              <div className="inv-ledger-row">
                <span>Previous Balance B/F</span>
                <span style={{ color: invoice.previousBalance > 0 ? "var(--danger)" : "var(--color-primary)", fontWeight: "var(--font-weight-bold)" }}>
                  {formatCurrency(invoice.previousBalance)}
                </span>
              </div>
            )}
            <div className="inv-ledger-row">
              <span>Total Charges</span>
              <span>{formatCurrency(invoice.totalCharges)}</span>
            </div>
            {invoice.orderCredits > 0 && (
              <div className="inv-ledger-row">
                <span>Order Credits</span>
                <span style={{ color: "var(--color-primary)" }}>({formatCurrency(invoice.orderCredits)})</span>
              </div>
            )}
            <div className="inv-ledger-row">
              <span>Payments Received</span>
              <span style={{ color: "var(--color-primary)" }}>({formatCurrency(invoice.totalPayments)})</span>
            </div>
            {invoice.totalAdjustments !== 0 && (
              <div className="inv-ledger-row">
                <span>Adjustments</span>
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

        {/* Product / Milk Summary */}
        {invoice.productSummary?.length > 0 && (
          <div className="inv-doc-section">
            <div className="inv-doc-section-title">PRODUCT / MILK SUMMARY</div>
            <div className="ledger-table-wrapper">
              <table className="ledger-table inv-product-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {["Product", "Total Qty", "Rate", "Amount", "Paid", "Outstanding"].map(h => (
                      <th key={h} style={{ textAlign: h === "Product" ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoice.productSummary.map((p, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <strong style={{ display: "block", color: "var(--text-primary)" }}>{p.productName}</strong>
                        {p.variantLabel && (
                          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>{p.variantLabel}</span>
                        )}
                        {p.rateBreakdown?.length > 0 && (
                          <details style={{ marginTop: 2 }}>
                            <summary style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)", cursor: "pointer" }}>Rate breakdown</summary>
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
                <tfoot>
                  <tr className="inv-table-total-row">
                    <td colSpan={4}>TOTAL</td>
                    <td style={{ textAlign: "right", fontWeight: "var(--font-weight-extrabold)" }}>
                      {formatCurrency(invoice.productSummary.reduce((s, p) => s + p.totalAmount, 0))}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "var(--font-weight-extrabold)", color: "var(--color-primary)" }}>
                      {formatCurrency(invoice.productSummary.reduce((s, p) => s + p.paidAmount, 0))}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "var(--font-weight-extrabold)", color: invoice.netAmountDue > 0 ? "var(--danger)" : "var(--color-primary)" }}>
                      {formatCurrency(invoice.productSummary.reduce((s, p) => s + p.outstandingAmount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Transaction Ledger — collapsible on screen, always visible in print */}
        {invoice.lineItems?.length > 0 && (
          <div className="inv-doc-section inv-ledger-section">
            <button className="inv-doc-section-toggle" onClick={() => setShowLineItems(v => !v)} aria-expanded={showLineItems}>
              <span className="inv-doc-section-title" style={{ margin: 0 }}>
                TRANSACTION LOG{" "}
                <span style={{ fontWeight: "var(--font-weight-medium)", textTransform: "none", fontSize: "var(--font-size-xs)" }}>
                  ({invoice.lineItems.length} entries)
                </span>
              </span>
              {showLineItems ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <div className={`ledger-table-wrapper${showLineItems ? "" : " inv-ledger-collapsed"}`} style={{ marginTop: "var(--space-2)" }}>
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
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="inv-doc-notes">{invoice.notes}</div>
        )}

        {/* Payment Info */}
        {(() => {
          const upiId   = import.meta.env.VITE_UPI_ID   || "";
          const upiName = import.meta.env.VITE_UPI_NAME || "Farmilky";
          const amt     = invoice.netAmountDue > 0 ? invoice.netAmountDue : 0;
          const upiUri  = upiId && amt > 0
            ? [
                "upi://pay",
                `?pa=${encodeURIComponent(upiId)}`,
                `&pn=${encodeURIComponent(upiName)}`,
                `&am=${amt.toFixed(2)}`,
                "&cu=INR",
                `&tn=${encodeURIComponent(`Farmilky Invoice ${invoice.invoiceNumber}`)}`,
              ].join("")
            : null;

          return (
            <div className="inv-doc-payment">
              <div className="inv-doc-section-title">PAYMENT OPTIONS</div>
              <div className="inv-payment-body">

                {/* QR Code — shown when UPI is configured and amount is due */}
                {upiUri && (
                  <div className="inv-payment-qr">
                    <a
                      href={upiUri}
                      className="inv-payment-qr-link"
                      title="Tap to open UPI payment app"
                      aria-label={`Pay Rs.${amt.toFixed(2)} via UPI`}
                    >
                      <QRCodeSVG
                        value={upiUri}
                        size={110}
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#1a4731"
                      />
                    </a>
                    <span className="inv-payment-qr-label">Scan &amp; Pay</span>
                    <span className="inv-payment-qr-amount">{formatCurrency(amt)}</span>
                  </div>
                )}

                <div className="inv-payment-info">
                  <p>Pay via <strong>UPI, Google Pay, PhonePe,</strong> or <strong>Paytm</strong></p>
                  {upiId ? (
                    <div className="inv-payment-upi">
                      <span className="inv-payment-upi-label">UPI ID</span>
                      <span className="inv-payment-upi-id">{upiId}</span>
                    </div>
                  ) : (
                    <p className="inv-payment-note" style={{ color: "var(--warning-text)" }}>
                      Set VITE_UPI_ID in .env to enable QR &amp; UPI ID display.
                    </p>
                  )}
                  {upiUri && (
                    <a href={upiUri} className="inv-payment-tap-link">
                      Tap here to open UPI app →
                    </a>
                  )}
                  <p className="inv-payment-note">After payment, share a screenshot as confirmation. Dhanyavaad! 🙏</p>
                </div>

                <div className="inv-payment-contact">
                  <p style={{ fontWeight: "var(--font-weight-bold)" }}>Contact</p>
                  <p>📞 {import.meta.env.VITE_BRAND_PHONE || "9244237975"}</p>
                  <p>💬 {import.meta.env.VITE_BRAND_PHONE || "9244237975"}</p>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Invoice Footer */}
        <div className="inv-doc-footer">
          <span>♥ Pure Milk, Pure Promise ♥</span>
        </div>

      </div>{/* end .inv-doc */}

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
