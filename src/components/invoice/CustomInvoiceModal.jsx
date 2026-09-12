import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Download, FileText } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import ResponsiveModal from "../ui/ResponsiveModal";
import { todayLocal, formatCurrency } from "../../utils/format";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS = ["L", "ml", "kg", "g", "pcs", "bottle", "pack", "dozen"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid() { return `ci_${++_idCounter}`; }

function emptyProduct() {
  return { id: uid(), name: "", qty: "", unit: "L", rate: "" };
}

function emptyTx() {
  return { id: uid(), date: todayLocal(), description: "", qty: "", amount: "", type: "debit" };
}

function makeInvoiceNumber() {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `CUST-${yy}${mm}${dd}-${rnd}`;
}

function freshState() {
  return {
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    invoiceNumber: makeInvoiceNumber(),
    invoiceDate: todayLocal(),
    billingPeriod: "",
    notes: "",
    products: [emptyProduct()],
    previousBalance: "",
    paymentsReceived: "",
    adjustments: "",
    includeTransactions: false,
    transactions: [emptyTx()],
  };
}

// ─── Derived financials ───────────────────────────────────────────────────────

function deriveFinancials(form) {
  const products = form.products.map(p => ({
    ...p,
    amount: (parseFloat(p.qty) || 0) * (parseFloat(p.rate) || 0),
  }));
  const totalCharges     = products.reduce((s, p) => s + p.amount, 0);
  const previousBalance  = parseFloat(form.previousBalance) || 0;
  const paymentsReceived = parseFloat(form.paymentsReceived) || 0;
  const adjustments      = parseFloat(form.adjustments) || 0;
  const netAmountDue     = previousBalance + totalCharges - paymentsReceived + adjustments;
  return { products, totalCharges, previousBalance, paymentsReceived, adjustments, netAmountDue };
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

/** Minimal HTML escaping to prevent XSS in the print window. */
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape and convert newlines to <br> for multi-line fields. */
function escHtmlMultiline(str) {
  return escHtml(str).replace(/\n/g, "<br>");
}

// ─── Print function ───────────────────────────────────────────────────────────

function openCustomInvoicePrint(form, derived) {
  const { products, totalCharges, previousBalance, paymentsReceived, adjustments, netAmountDue } = derived;

  const upiId   = import.meta.env.VITE_UPI_ID      || "";
  const upiName = import.meta.env.VITE_UPI_NAME    || "Farmilky";
  const phone   = import.meta.env.VITE_BRAND_PHONE || "9244237975";
  const amt     = Math.max(0, netAmountDue);

  const upiUri = upiId && amt > 0
    ? [
        "upi://pay",
        `?pa=${encodeURIComponent(upiId)}`,
        `&pn=${encodeURIComponent(upiName)}`,
        `&am=${amt.toFixed(2)}`,
        "&cu=INR",
        `&tn=${encodeURIComponent("Invoice " + form.invoiceNumber)}`,
      ].join("")
    : null;

  const qrSvg = upiUri
    ? renderToStaticMarkup(
        <QRCodeSVG value={upiUri} size={110} bgColor="#ffffff" fgColor="#1a4731" includeMargin={false} />
      )
    : "";

  // Standalone formatters — no CSS vars available in the new window
  const fmtCurr = (v) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Number(v || 0));

  const fmtDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  };

  const validProducts = products.filter(p => p.name.trim());

  const productRows = validProducts.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escHtml(p.name)}</strong></td>
      <td style="text-align:right">${p.qty ? escHtml(String(p.qty)) + "&nbsp;" + escHtml(p.unit) : "—"}</td>
      <td style="text-align:right">${p.rate ? "₹" + parseFloat(p.rate).toFixed(2) + "/" + escHtml(p.unit) : "—"}</td>
      <td style="text-align:right;font-weight:700">${fmtCurr(p.amount)}</td>
    </tr>
  `).join("");

  // Filter out completely empty transaction rows before rendering
  const filledTxs = form.includeTransactions
    ? form.transactions.filter(t => t.description.trim() || parseFloat(t.amount) > 0)
    : [];

  const txRows = filledTxs.map(t => `
    <tr>
      <td style="white-space:nowrap">${fmtDate(t.date)}</td>
      <td>${escHtml(t.description || "—")}</td>
      <td style="text-align:right">${t.qty ? escHtml(String(t.qty)) : "—"}</td>
      <td style="text-align:right;color:${t.type === "credit" ? "#2d6a4f" : "#1a1a2e"}">${fmtCurr(t.amount)}</td>
      <td style="text-align:right">
        <span class="${t.type === "credit" ? "badge-cr" : "badge-dr"}">${t.type === "credit" ? "CR" : "DR"}</span>
      </td>
    </tr>
  `).join("");

  // Payment grid layout: 3 cols when QR present, 2 cols when absent
  const paymentGridCols = upiUri ? "auto 1fr auto" : "1fr auto";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${escHtml(form.invoiceNumber)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; }
  .inv-doc { max-width: 860px; margin: 0 auto; border: 1px solid #e5e7eb; }

  /* ── Header ── */
  .doc-header { background: #1a4731; color: #fff; padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .brand-name { font-size: 28px; font-weight: 800; letter-spacing: 0.06em; line-height: 1; margin-bottom: 6px; }
  .brand-sub  { font-size: 11px; color: #7dbf9a; margin-bottom: 2px; }
  .brand-tag  { font-size: 11px; color: #b2d8c4; font-style: italic; }
  .meta-wrap  { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; text-align: right; }
  .meta-label { font-size: 18px; font-weight: 800; letter-spacing: 0.12em; }
  .meta-num   { font-size: 12px; color: #7dbf9a; }
  .custom-badge { font-size: 10px; background: rgba(255,255,255,.15); color: #b2d8c4; padding: 2px 8px; border-radius: 99px; font-weight: 700; letter-spacing: .04em; border: 1px solid rgba(255,255,255,.2); }

  /* ── Info row (customer + meta) ── */
  .info-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e5e7eb; }
  .info-box { border-right: 1px solid #e5e7eb; }
  .info-box:last-child { border-right: none; }
  .info-box-hdr { background: #2d6a4f; color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .1em; padding: 6px 16px; text-transform: uppercase; }
  .info-box-body { padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 8px; }
  .info-box--meta .info-box-body { padding-top: calc(28px + 12px); }
  .info-r { display: flex; align-items: baseline; gap: 8px; font-size: 12px; line-height: 1.4; }
  .info-lbl { color: #6b7280; font-size: 11px; font-weight: 500; min-width: 108px; flex-shrink: 0; }
  .info-lbl::after { content: ":"; }
  .info-val { color: #1a1a2e; font-size: 12px; }
  .info-val--bold { font-weight: 700; }

  /* ── Generic section ── */
  .section { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
  .section-title { display: block; width: 100%; background: #2d6a4f; color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; padding: 5px 12px; margin-bottom: 12px; border-radius: 2px; }

  /* ── Invoice summary ledger ── */
  .ledger { display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
  .l-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; gap: 16px; }
  .l-total { border-top: 2px solid #e5e7eb; padding-top: 8px; font-weight: 800; font-size: 14px; }
  .l-total span:last-child { font-size: 18px; }
  .settled { font-size: 11px; color: #2d6a4f; font-weight: 700; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #2d6a4f; color: #fff; padding: 8px 12px; font-weight: 700; font-size: 10px; letter-spacing: .05em; white-space: nowrap; }
  td { padding: 10px 12px; border-top: 1px solid #e5e7eb; vertical-align: middle; }
  .total-row td { background: #f0faf4; font-weight: 800; border-top: 2px solid #9ecfb4; font-size: 12px; }
  .badge-cr { display: inline-flex; align-items: center; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; color: #166534; background: #dcfce7; }
  .badge-dr { display: inline-flex; align-items: center; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; color: #991b1b; background: #fee2e2; }

  /* ── Notes ── */
  .notes { padding: 12px 20px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; font-style: italic; line-height: 1.6; }

  /* ── Payment ── */
  .payment-section { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
  .payment-body { display: grid; grid-template-columns: ${paymentGridCols}; gap: 20px; margin-top: 12px; align-items: start; }
  .qr-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .qr-box { display: block; padding: 8px; border: 1.5px solid #9ecfb4; border-radius: 6px; background: #fff; line-height: 0; }
  .qr-lbl { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; }
  .qr-amt { font-size: 12px; font-weight: 800; color: #2d6a4f; }
  .pay-info { display: flex; flex-direction: column; gap: 8px; font-size: 12px; }
  .pay-info p { margin: 0; }
  .upi-box { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #f8f8f8; border: 1px solid #9ecfb4; border-radius: 6px; width: fit-content; }
  .upi-lbl { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; }
  .upi-id  { font-weight: 700; color: #2d6a4f; font-size: 14px; }
  .pay-note { font-size: 11px; color: #6b7280; font-style: italic; }
  .contact { font-size: 12px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; min-width: 140px; }

  /* ── Footer ── */
  .doc-footer { background: #1a4731; color: #b2d8c4; text-align: center; padding: 12px 16px; font-size: 12px; font-weight: 700; letter-spacing: .06em; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .inv-doc { border: none; }
    @page { margin: 8mm; }
  }
</style>
</head>
<body>
<div class="inv-doc">

  <div class="doc-header">
    <div>
      <div class="brand-name">FARMILKY</div>
      <div class="brand-sub">Fresh &amp; Pure Milk Delivered Daily</div>
      <div class="brand-tag">Aapka bharosa, hamari zimmedari.</div>
    </div>
    <div class="meta-wrap">
      <div class="meta-label">INVOICE</div>
      <div class="meta-num">${escHtml(form.invoiceNumber)}</div>
      <span class="custom-badge">CUSTOM</span>
    </div>
  </div>

  <div class="info-row">
    <div class="info-box">
      <div class="info-box-hdr">CUSTOMER DETAILS</div>
      <div class="info-box-body">
        <div class="info-r"><span class="info-lbl">Customer Name</span><span class="info-val info-val--bold">${escHtml(form.customerName)}</span></div>
        ${form.customerPhone ? `<div class="info-r"><span class="info-lbl">Mobile No.</span><span class="info-val">${escHtml(form.customerPhone)}</span></div>` : ""}
        ${form.customerEmail ? `<div class="info-r"><span class="info-lbl">Email</span><span class="info-val">${escHtml(form.customerEmail)}</span></div>` : ""}
      </div>
    </div>
    <div class="info-box info-box--meta">
      <div class="info-box-body">
        <div class="info-r"><span class="info-lbl">Bill No.</span><span class="info-val info-val--bold">${escHtml(form.invoiceNumber)}</span></div>
        <div class="info-r"><span class="info-lbl">Billing Period</span><span class="info-val">${escHtml(form.billingPeriod)}</span></div>
        <div class="info-r"><span class="info-lbl">Bill Date</span><span class="info-val">${fmtDate(form.invoiceDate)}</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <span class="section-title">INVOICE SUMMARY</span>
    <div class="ledger">
      ${previousBalance !== 0 ? `<div class="l-row"><span>Previous Balance B/F</span><span style="color:${previousBalance > 0 ? "#ef4444" : "#2d6a4f"};font-weight:700">${fmtCurr(previousBalance)}</span></div>` : ""}
      <div class="l-row"><span>Total Charges</span><span>${fmtCurr(totalCharges)}</span></div>
      ${paymentsReceived > 0 ? `<div class="l-row"><span>Payments Received</span><span style="color:#2d6a4f">(${fmtCurr(paymentsReceived)})</span></div>` : ""}
      ${adjustments !== 0 ? `<div class="l-row"><span>Adjustments</span><span>${fmtCurr(adjustments)}</span></div>` : ""}
      <div class="l-row l-total">
        <span>Net Amount Due</span>
        <span style="color:${netAmountDue <= 0 ? "#2d6a4f" : "#ef4444"}">${fmtCurr(netAmountDue)}</span>
      </div>
      ${netAmountDue <= 0 ? `<p class="settled">✓ Account fully settled</p>` : ""}
    </div>
  </div>

  ${validProducts.length > 0 ? `
  <div class="section">
    <span class="section-title">PRODUCT / MILK SUMMARY</span>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th style="text-align:right">Total Qty</th>
          <th style="text-align:right">Rate</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>${productRows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4">TOTAL</td>
          <td style="text-align:right">${fmtCurr(totalCharges)}</td>
        </tr>
      </tfoot>
    </table>
  </div>` : ""}

  ${form.includeTransactions && txRows ? `
  <div class="section">
    <span class="section-title">TRANSACTION LOG (${filledTxs.length} ${filledTxs.length === 1 ? "entry" : "entries"})</span>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Amount</th>
          <th style="text-align:right">Type</th>
        </tr>
      </thead>
      <tbody>${txRows}</tbody>
    </table>
  </div>` : ""}

  ${form.notes.trim() ? `<div class="notes">${escHtmlMultiline(form.notes)}</div>` : ""}

  <div class="payment-section">
    <span class="section-title">PAYMENT OPTIONS</span>
    <div class="payment-body">
      ${upiUri ? `
      <div class="qr-col">
        <div class="qr-box">${qrSvg}</div>
        <span class="qr-lbl">Scan &amp; Pay</span>
        <span class="qr-amt">${fmtCurr(amt)}</span>
      </div>` : ""}
      <div class="pay-info">
        <p>Pay via <strong>UPI, Google Pay, PhonePe,</strong> or <strong>Paytm</strong></p>
        ${upiId ? `
        <div class="upi-box">
          <span class="upi-lbl">UPI ID</span>
          <span class="upi-id">${escHtml(upiId)}</span>
        </div>` : ""}
        <p class="pay-note">After payment, share a screenshot as confirmation. Dhanyavaad! 🙏</p>
      </div>
      <div class="contact">
        <p style="font-weight:700">Contact</p>
        <p>📞 ${escHtml(phone)}</p>
        <p>💬 ${escHtml(phone)}</p>
      </div>
    </div>
  </div>

  <div class="doc-footer">♥ Pure Milk, Pure Promise ♥</div>

</div>
<script>
  // Wait for all resources (esp. inline SVG) before printing
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 150);
  });
  window.addEventListener('afterprint', function() { window.close(); });
</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=920,height=740,scrollbars=yes,resizable=yes");
  if (!win) {
    toast.error("Popup blocked — allow popups for this site to download invoices.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomInvoiceModal({ open, onClose }) {
  const [form, setForm] = useState(freshState);
  const [downloading, setDownloading] = useState(false);

  // Reset form on every open so stale data never leaks between sessions
  useEffect(() => {
    if (open) setForm(freshState());
  }, [open]);

  // ── Field helpers ───────────────────────────────────────────────────────────

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  // Products
  function setProduct(id, key, val) {
    setForm(prev => ({
      ...prev,
      products: prev.products.map(p => p.id === id ? { ...p, [key]: val } : p),
    }));
  }

  function addProduct() {
    setForm(prev => ({ ...prev, products: [...prev.products, emptyProduct()] }));
  }

  function removeProduct(id) {
    setForm(prev => ({
      ...prev,
      products: prev.products.length > 1
        ? prev.products.filter(p => p.id !== id)
        : prev.products,
    }));
  }

  // Transactions
  function setTransaction(id, key, val) {
    setForm(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => t.id === id ? { ...t, [key]: val } : t),
    }));
  }

  function addTransaction() {
    setForm(prev => ({ ...prev, transactions: [...prev.transactions, emptyTx()] }));
  }

  function removeTransaction(id) {
    setForm(prev => ({
      ...prev,
      transactions: prev.transactions.length > 1
        ? prev.transactions.filter(t => t.id !== id)
        : prev.transactions,
    }));
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const derived = deriveFinancials(form);
  const { products, totalCharges, netAmountDue } = derived;

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate() {
    if (!form.customerName.trim()) {
      toast.error("Customer name is required.");
      return false;
    }
    if (!form.invoiceNumber.trim()) {
      toast.error("Invoice number is required.");
      return false;
    }
    if (!form.billingPeriod.trim()) {
      toast.error("Billing period is required.");
      return false;
    }
    const hasValidProduct = products.some(p => p.name.trim() && p.amount > 0);
    if (!hasValidProduct) {
      toast.error("Add at least one product with a name, quantity, and rate.");
      return false;
    }
    if (form.includeTransactions) {
      const badTx = form.transactions.find(
        t => !t.description.trim() || !(parseFloat(t.amount) > 0)
      );
      if (badTx) {
        toast.error("Each transaction needs a description and a valid amount.");
        return false;
      }
    }
    return true;
  }

  // ── Download ─────────────────────────────────────────────────────────────────

  function handleDownload() {
    if (!validate()) return;
    setDownloading(true);
    try {
      openCustomInvoicePrint(form, derived);
    } finally {
      // Restore button after a short delay (print dialog is synchronous on most browsers)
      setTimeout(() => setDownloading(false), 800);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Custom Invoice"
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={downloading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
            <Download size={14} />
            {downloading ? "Preparing…" : "Download PDF"}
          </button>
        </>
      }
    >
      <div className="form-stack ci-form">

        {/* ── Customer Details ───────────────────────────────────────────── */}
        <div className="ci-section">
          <div className="ci-section-label">Customer Details</div>
          <div className="form-group">
            <label>Customer Name <span className="ci-required">*</span></label>
            <input
              type="text"
              value={form.customerName}
              onChange={e => setField("customerName", e.target.value)}
              placeholder="e.g. Ramesh Sharma"
              autoComplete="name"
              autoFocus
            />
          </div>
          <div className="ci-two-col">
            <div className="form-group">
              <label>Phone <span className="ci-optional">(optional)</span></label>
              <input
                type="tel"
                inputMode="numeric"
                value={form.customerPhone}
                onChange={e => setField("customerPhone", e.target.value)}
                placeholder="e.g. 9876543210"
                autoComplete="tel"
              />
            </div>
            <div className="form-group">
              <label>Email <span className="ci-optional">(optional)</span></label>
              <input
                type="email"
                inputMode="email"
                value={form.customerEmail}
                onChange={e => setField("customerEmail", e.target.value)}
                placeholder="e.g. ramesh@email.com"
                autoComplete="email"
              />
            </div>
          </div>
        </div>

        {/* ── Invoice Info ───────────────────────────────────────────────── */}
        <div className="ci-section">
          <div className="ci-section-label">Invoice Info</div>
          <div className="ci-invoice-info-grid">
            <div className="form-group">
              <label>Invoice Number</label>
              <input
                type="text"
                value={form.invoiceNumber}
                onChange={e => setField("invoiceNumber", e.target.value)}
                placeholder="CUST-20250601-123"
              />
            </div>
            <div className="form-group">
              <label>Invoice Date</label>
              <input
                type="date"
                value={form.invoiceDate}
                onChange={e => setField("invoiceDate", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Billing Period <span className="ci-required">*</span></label>
              <input
                type="text"
                value={form.billingPeriod}
                onChange={e => setField("billingPeriod", e.target.value)}
                placeholder="e.g. June 2025"
              />
            </div>
          </div>
        </div>

        {/* ── Products ──────────────────────────────────────────────────── */}
        <div className="ci-section">
          <div className="ci-section-label">Products <span className="ci-required">*</span></div>

          {form.products.map((p, index) => {
            const productAmt = (parseFloat(p.qty) || 0) * (parseFloat(p.rate) || 0);
            return (
              <div key={p.id} className="ci-product-card">
                {/* Card header: index + remove */}
                <div className="ci-product-card-header">
                  <span className="ci-product-index">{index + 1}</span>
                  {form.products.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-sm ci-remove-btn"
                      onClick={() => removeProduct(p.id)}
                      title="Remove product"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => setProduct(p.id, "name", e.target.value)}
                    placeholder="e.g. Full Cream Milk"
                  />
                </div>

                <div className="ci-product-nums">
                  <div className="form-group">
                    <label>Quantity</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={p.qty}
                      onChange={e => setProduct(p.id, "qty", e.target.value)}
                      placeholder="30"
                    />
                  </div>
                  <div className="form-group">
                    <label>Unit</label>
                    <select value={p.unit} onChange={e => setProduct(p.id, "unit", e.target.value)}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Rate (₹/unit)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={p.rate}
                      onChange={e => setProduct(p.id, "rate", e.target.value)}
                      placeholder="60"
                    />
                  </div>
                  <div className="form-group">
                    <label>Amount</label>
                    <div className="ci-amt-display">
                      {productAmt > 0 ? formatCurrency(productAmt) : "—"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button type="button" className="btn btn-sm ci-add-btn" onClick={addProduct}>
            <Plus size={13} /> Add Product
          </button>
        </div>

        {/* ── Adjustments ───────────────────────────────────────────────── */}
        <div className="ci-section">
          <div className="ci-section-label">Adjustments <span className="ci-optional">(optional)</span></div>
          <div className="ci-adj-grid">
            <div className="form-group">
              <label>Previous Balance (₹)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.previousBalance}
                onChange={e => setField("previousBalance", e.target.value)}
                placeholder="0"
              />
              <span className="form-help">Carried forward from last period</span>
            </div>
            <div className="form-group">
              <label>Payments Received (₹)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.paymentsReceived}
                onChange={e => setField("paymentsReceived", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label>Other Adjustments (₹)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.adjustments}
                onChange={e => setField("adjustments", e.target.value)}
                placeholder="0"
              />
              <span className="form-help">+ extra charge &nbsp;/&nbsp; − discount</span>
            </div>
          </div>
        </div>

        {/* ── Running total ──────────────────────────────────────────────── */}
        <div className="ci-total-card">
          <div className="ci-total-row">
            <span>Total Charges</span>
            <span>{formatCurrency(totalCharges)}</span>
          </div>
          {derived.previousBalance !== 0 && (
            <div className="ci-total-row">
              <span>Previous Balance</span>
              <span style={{ color: derived.previousBalance > 0 ? "var(--danger)" : "var(--color-primary)" }}>
                {formatCurrency(derived.previousBalance)}
              </span>
            </div>
          )}
          {derived.paymentsReceived > 0 && (
            <div className="ci-total-row">
              <span>Payments Received</span>
              <span style={{ color: "var(--color-primary)" }}>({formatCurrency(derived.paymentsReceived)})</span>
            </div>
          )}
          {derived.adjustments !== 0 && (
            <div className="ci-total-row">
              <span>Adjustments</span>
              <span>{formatCurrency(derived.adjustments)}</span>
            </div>
          )}
          <div className="ci-total-row ci-total-net">
            <span>Net Amount Due</span>
            <span style={{ color: netAmountDue <= 0 ? "var(--color-primary)" : "var(--danger)" }}>
              {formatCurrency(netAmountDue)}
            </span>
          </div>
        </div>

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label>Notes <span className="ci-optional">(optional)</span></label>
          <textarea
            value={form.notes}
            onChange={e => setField("notes", e.target.value)}
            rows={2}
            placeholder="Any additional notes for this invoice…"
          />
        </div>

        {/* ── Daily Transactions (optional) ─────────────────────────────── */}
        <div className="ci-section ci-tx-section">
          <button
            type="button"
            className="ci-tx-toggle"
            onClick={() => setField("includeTransactions", !form.includeTransactions)}
            aria-expanded={form.includeTransactions}
          >
            <div className="ci-tx-toggle-left">
              <div className="ci-section-label">
                <FileText size={13} className="ci-tx-icon" aria-hidden />
                Daily Transactions
                <span className="ci-optional" style={{ marginLeft: 6 }}>(optional — for detailed invoice)</span>
              </div>
              <div className="ci-tx-hint">
                Add date-by-date entries; these appear as a transaction log in the PDF
              </div>
            </div>
            <div className="ci-tx-toggle-right">
              <span className={`ci-tx-badge${form.includeTransactions ? " ci-tx-badge--on" : ""}`}>
                {form.includeTransactions ? "On" : "Off"}
              </span>
              {form.includeTransactions ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
            </div>
          </button>

          {form.includeTransactions && (
            <div className="ci-tx-body">
              {/* Desktop column headers */}
              <div className="ci-tx-header-row" aria-hidden="true">
                <span className="ci-tx-col-label ci-tx-f-date">Date</span>
                <span className="ci-tx-col-label ci-tx-f-desc">Description</span>
                <span className="ci-tx-col-label ci-tx-f-qty">Qty</span>
                <span className="ci-tx-col-label ci-tx-f-amt">Amount (₹)</span>
                <span className="ci-tx-col-label ci-tx-f-type">Type</span>
                <span className="ci-tx-f-del" />
              </div>

              {form.transactions.map((t, idx) => (
                <div key={t.id} className="ci-tx-row" role="group" aria-label={`Transaction ${idx + 1}`}>
                  <div className="ci-tx-field ci-tx-f-date">
                    <label className="ci-tx-mobile-label">Date</label>
                    <input
                      type="date"
                      value={t.date}
                      onChange={e => setTransaction(t.id, "date", e.target.value)}
                      aria-label="Transaction date"
                    />
                  </div>
                  <div className="ci-tx-field ci-tx-f-desc">
                    <label className="ci-tx-mobile-label">Description</label>
                    <input
                      type="text"
                      value={t.description}
                      onChange={e => setTransaction(t.id, "description", e.target.value)}
                      placeholder="e.g. Full Cream Milk delivery"
                      aria-label="Description"
                    />
                  </div>
                  <div className="ci-tx-field ci-tx-f-qty">
                    <label className="ci-tx-mobile-label">Qty</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={t.qty}
                      onChange={e => setTransaction(t.id, "qty", e.target.value)}
                      placeholder="qty"
                      aria-label="Quantity"
                    />
                  </div>
                  <div className="ci-tx-field ci-tx-f-amt">
                    <label className="ci-tx-mobile-label">Amount (₹)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={t.amount}
                      onChange={e => setTransaction(t.id, "amount", e.target.value)}
                      placeholder="0.00"
                      aria-label="Amount"
                    />
                  </div>
                  <div className="ci-tx-field ci-tx-f-type">
                    <label className="ci-tx-mobile-label">Type</label>
                    <select
                      value={t.type}
                      onChange={e => setTransaction(t.id, "type", e.target.value)}
                      aria-label="Entry type"
                    >
                      <option value="debit">Debit (DR)</option>
                      <option value="credit">Credit (CR)</option>
                    </select>
                  </div>
                  <div className="ci-tx-f-del">
                    <label className="ci-tx-mobile-label" aria-hidden="true" />
                    <button
                      type="button"
                      className="btn btn-sm ci-tx-del-btn"
                      onClick={() => removeTransaction(t.id)}
                      disabled={form.transactions.length <= 1}
                      title="Remove entry"
                      aria-label="Remove transaction"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}

              <button type="button" className="btn btn-sm ci-add-btn" onClick={addTransaction}>
                <Plus size={13} /> Add Entry
              </button>
            </div>
          )}
        </div>

      </div>
    </ResponsiveModal>
  );
}
