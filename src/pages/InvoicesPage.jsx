import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FileText, Download, MessageCircle, Plus, RefreshCw,
  ReceiptText, AlertCircle, Wallet,
} from "lucide-react";
import { formatCurrency } from "../utils/format";
import PageHeader from "../components/ui/PageHeader";
import PageSkeleton from "../components/ui/PageSkeleton";
import PageError from "../components/ui/PageError";
import EmptyState from "../components/ui/EmptyState";
import StatusTag from "../components/ui/StatusTag";
import SearchInput from "../components/ui/SearchInput";
import DataTable from "../components/ui/DataTable";
import GenerateInvoiceModal from "../components/invoice/GenerateInvoiceModal";
import { useApiData } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [
  { value: "",               label: "All Statuses" },
  { value: "draft",          label: "Draft" },
  { value: "sent",           label: "Sent" },
  { value: "paid",           label: "Paid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "overdue",        label: "Overdue" },
  { value: "cancelled",      label: "Cancelled" },
  { value: "void",           label: "Void" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthYearLabel(m, y) {
  return `${MONTHS[m - 1]} ${y}`;
}

async function fetchInvoices(params) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v !== "" && v != null)));
  const res = await apiRequest(`/api/invoices/admin?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch invoices");
  return res.json();
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [generateOpen, setGenerateOpen] = useState(false);

  const fetcher = useCallback(
    () => fetchInvoices({ month, year, status, page, limit: 50 }),
    [month, year, status, page]
  );
  const { data, loading, error, refetch } = useApiData(fetcher);

  // Re-fetch whenever filters change (useApiData only fetches once on mount)
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, status, page]);

  const invoices = data?.invoices || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(inv =>
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.userId?.name?.toLowerCase().includes(q) ||
      inv.userId?.phone?.includes(q)
    );
  }, [invoices, search]);

  // Summary stats
  const stats = useMemo(() => {
    const all = invoices.filter(i => i.status !== "void");
    const outstanding = all.filter(i => !["paid", "cancelled"].includes(i.status))
      .reduce((s, i) => s + Math.max(0, i.netAmountDue || 0), 0);
    const collected = all.reduce((s, i) => s + (i.totalPayments || 0), 0);
    return { count: all.length, outstanding, collected };
  }, [invoices]);

  // Build brand-config query params from frontend env so the PDF generator
  // renders the QR and UPI link even when backend env vars differ.
  function buildPdfParams(extra = {}) {
    const p = new URLSearchParams(extra);
    const upiId   = import.meta.env.VITE_UPI_ID      || "";
    const upiName = import.meta.env.VITE_UPI_NAME    || "Farmilky";
    const phone   = import.meta.env.VITE_BRAND_PHONE || "";
    if (upiId)   p.set("upiId",   upiId);
    if (upiName) p.set("upiName", upiName);
    if (phone)   p.set("phone",   phone);
    return p.toString();
  }

  async function handleDownloadPDF(inv, detailed = false) {
    try {
      const res = await apiRequest(`/api/invoices/admin/${inv._id}/pdf?${buildPdfParams({ detailed })}`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${inv.invoiceNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleSendWhatsApp(inv) {
    const phone = (inv.userId?.phone || "").replace(/\D/g, "");
    if (!phone) { toast.error("Customer has no phone number."); return; }
    const waPhone = phone.startsWith("91") ? phone : `91${phone}`;
    const period = monthYearLabel(inv.billingPeriod.month, inv.billingPeriod.year);
    const msg =
      `Hi ${inv.userId?.name || ""},\n\n` +
      `Your *Farmilky* invoice *${inv.invoiceNumber}* for *${period}* is ready.\n\n` +
      `💰 Net Amount Due: *₹${inv.netAmountDue}*\n\n` +
      `Please find the invoice PDF attached.\n\nThank you! 🙏\n— Farmilky Team`;

    // Fetch PDF first
    let blob;
    try {
      const res = await apiRequest(`/api/invoices/admin/${inv._id}/pdf?${buildPdfParams()}`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      blob = await res.blob();
    } catch (err) {
      toast.error("Could not generate PDF: " + err.message);
      return;
    }

    const pdfFile = new File([blob], `${inv.invoiceNumber}.pdf`, { type: "application/pdf" });

    // Android / mobile: use Web Share API → native share sheet → pick WhatsApp → PDF + message attached
    if (navigator.canShare?.({ files: [pdfFile] })) {
      try {
        await navigator.share({ files: [pdfFile], text: msg });
      } catch (err) {
        if (err.name === "AbortError") return; // user cancelled
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

    // Mark as sent regardless of method
    try {
      await apiRequest(`/api/invoices/admin/${inv._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: inv.status === "draft" ? "sent" : inv.status }),
      });
      refetch();
    } catch (_) {}
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  /* Mobile card renderer for DataTable */
  function renderInvoiceCard(r) {
    return (
      <>
        <div className="mc-head">
          <div className="mc-identity">
            <span className="mc-name">{r.userId?.name || "—"}</span>
            <span className="mc-sub">
              {r.invoiceNumber} · {monthYearLabel(r.billingPeriod.month, r.billingPeriod.year)}
            </span>
          </div>
          <div className="mc-tags">
            <StatusTag value={r.status} />
          </div>
        </div>
        <div className="mc-stats">
          <div className="mc-stat">
            <span className="mc-stat-label">Charges</span>
            <span className="mc-stat-value">{formatCurrency(r.totalCharges)}</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Paid</span>
            <span className="mc-stat-value success">{formatCurrency(r.totalPayments)}</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Net Due</span>
            <span className={`mc-stat-value${r.netAmountDue > 0 ? " danger" : " success"}`}>
              {formatCurrency(r.netAmountDue)}
            </span>
          </div>
        </div>
        <div className="inv-card-action" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm" onClick={() => navigate(`/invoices/${r._id}`)}>
            <FileText size={13} /> View
          </button>
          <button className="btn btn-sm" onClick={() => handleDownloadPDF(r)}>
            <Download size={13} /> PDF
          </button>
          <button className="btn btn-sm" onClick={() => handleSendWhatsApp(r)}>
            <MessageCircle size={13} /> WA
          </button>
        </div>
      </>
    );
  }

  const columns = [
    {
      key: "invoiceNumber",
      label: "Invoice #",
      render: (r) => (
        <Link to={`/invoices/${r._id}`} style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-primary)", textDecoration: "none" }}>
          {r.invoiceNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (r) => (
        <div>
          <strong className="cell-title">{r.userId?.name || "—"}</strong>
          <span className="cell-sub">{r.userId?.phone || r.userId?.email || "—"}</span>
        </div>
      ),
    },
    {
      key: "period",
      label: "Period",
      render: (r) => monthYearLabel(r.billingPeriod.month, r.billingPeriod.year),
    },
    {
      key: "totalCharges",
      label: "Charges",
      render: (r) => formatCurrency(r.totalCharges),
    },
    {
      key: "totalPayments",
      label: "Payments",
      render: (r) => <span style={{ color: "var(--color-primary)" }}>{formatCurrency(r.totalPayments)}</span>,
    },
    {
      key: "netAmountDue",
      label: "Net Due",
      render: (r) => (
        <span style={{ fontWeight: "var(--font-weight-bold)", color: r.netAmountDue > 0 ? "var(--danger)" : "var(--color-primary)" }}>
          {formatCurrency(r.netAmountDue)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusTag value={r.status} />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <div className="inv-actions-cell">
          <button className="btn btn-sm" title="View" onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${r._id}`); }}>
            <FileText size={14} />
          </button>
          <button className="btn btn-sm" title="Download PDF" onClick={(e) => { e.stopPropagation(); handleDownloadPDF(r); }}>
            <Download size={14} />
          </button>
          <button className="btn btn-sm" title="Send via WhatsApp" onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(r); }}>
            <MessageCircle size={14} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="invoices-page view-stack">
      <PageHeader
        title="Invoices"
        subtitle={`${stats.count} invoice${stats.count !== 1 ? "s" : ""} for ${monthYearLabel(month, year)}`}
        actions={
          <button className="btn btn-primary" onClick={() => setGenerateOpen(true)}>
            <Plus size={15} /> Generate
          </button>
        }
      />

      {/* Summary stats */}
      <div className="surface-card inv-summary-grid">
        <div className="inv-summary-stat">
          <div className="inv-summary-icon">
            <ReceiptText size={16} />
          </div>
          <div>
            <span className="inv-summary-label">Total Invoices</span>
            <span className="inv-summary-value">{stats.count}</span>
          </div>
        </div>
        <div className="inv-summary-stat">
          <div className="inv-summary-icon inv-summary-icon--danger">
            <AlertCircle size={16} />
          </div>
          <div>
            <span className="inv-summary-label">Outstanding</span>
            <span className="inv-summary-value outstanding">{formatCurrency(stats.outstanding)}</span>
          </div>
        </div>
        <div className="inv-summary-stat">
          <div className="inv-summary-icon inv-summary-icon--success">
            <Wallet size={16} />
          </div>
          <div>
            <span className="inv-summary-label">Collected</span>
            <span className="inv-summary-value collected">{formatCurrency(stats.collected)}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="surface-filters inv-filter-bar">
        <div className="desktop-filters">
          <select value={month} onChange={e => { setMonth(Number(e.target.value)); setPage(1); }}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setPage(1); }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search invoice or customer…" />
        <button className="btn btn-sm inv-refresh-btn" onClick={refetch} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No invoices found"
          message={search ? "Try adjusting your search or filters." : "Generate invoices using the button above."}
          action={
            !search && (
              <button className="btn btn-primary" onClick={() => setGenerateOpen(true)}>
                <Plus size={15} /> Generate Invoice
              </button>
            )
          }
        />
      ) : (
        <div className="surface-card table-shell">
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(r) => navigate(`/invoices/${r._id}`)}
            renderCard={renderInvoiceCard}
          />
        </div>
      )}

      <GenerateInvoiceModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}
