import { useState } from "react";
import { useActionMap } from "../hooks/useAction";
import { useNavigate, Link } from "react-router-dom";
import {
  FileText, Download, MessageCircle, Plus,
  FilePlus, ChevronLeft, ChevronRight, Calendar,
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
import CustomInvoiceModal from "../components/invoice/CustomInvoiceModal";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
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

export default function InvoicesPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [customInvOpen, setCustomInvOpen] = useState(false);
  const { run: runInvoiceAction, isLoading: isInvoiceActionLoading } = useActionMap();

  const {
    data: invoices,
    loading,
    error,
    pagination,
    search,
    sort,
    setPage,
    setLimit,
    setSearch,
    setSort,
    setFilterValue,
    refetch,
  } = usePaginatedFetch("/api/invoices/admin", {
    initialLimit: 20,
    initialFilters: { month: String(month), year: String(year), status: "" },
    initialSort: { sortBy: "createdAt", sortOrder: "desc" },
    dataKey: "invoices",
  });


  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const handleMonthChange = (val) => {
    setMonth(val);
    setFilterValue("month", String(val));
  };
  const handleYearChange = (val) => {
    setYear(val);
    setFilterValue("year", String(val));
  };
  const handleStatusChange = (val) => {
    setStatus(val);
    setFilterValue("status", val);
  };
  const handleSort = (key, dir) => setSort(key, dir);

  function goPrevMonth() {
    if (month === 1) { handleYearChange(year - 1); handleMonthChange(12); }
    else handleMonthChange(month - 1);
  }
  function goNextMonth() {
    if (isCurrentMonth) return;
    if (month === 12) { handleYearChange(year + 1); handleMonthChange(1); }
    else handleMonthChange(month + 1);
  }

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
    await runInvoiceAction(`${inv._id}_pdf`, async () => {
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
    });
  }

  async function handleSendWhatsApp(inv) {
    await runInvoiceAction(`${inv._id}_wa`, async () => {
    const phone = (inv.userId?.phone || "").replace(/\D/g, "");
    if (!phone) { toast.error("Customer has no phone number."); return; }
    const waPhone = phone.startsWith("91") ? phone : `91${phone}`;
    const period = monthYearLabel(inv.billingPeriod.month, inv.billingPeriod.year);
    const msg =
      `Hi ${inv.userId?.name || ""},\n\n` +
      `Your *Farmilky* invoice *${inv.invoiceNumber}* for *${period}* is ready.\n\n` +
      `💰 Net Amount Due: *₹${inv.netAmountDue}*\n\n` +
      `Please find the invoice PDF attached.\n\nThank you! 🙏\n— Farmilky Team`;

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

    if (navigator.canShare?.({ files: [pdfFile] })) {
      try {
        await navigator.share({ files: [pdfFile], text: msg });
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    } else {
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl; a.download = pdfFile.name; a.click();
      URL.revokeObjectURL(dlUrl);
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank");
      toast.success("PDF downloaded — attach it in the WhatsApp tab that opened.");
    }

    try {
      await apiRequest(`/api/invoices/admin/${inv._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: inv.status === "draft" ? "sent" : inv.status }),
      });
      refetch();
    } catch (_) {}
    });
  }

  function renderInvoiceCard(r) {
    const isDue = r.netAmountDue > 0;
    return (
      <div className={`inv2-card inv2-card--${r.status}`}>
        <div className="inv2-body">
          <div className="inv2-left">
            <span className="inv2-name">{r.userId?.name || "—"}</span>
            <div className="inv2-sub">
              <span className="inv2-num">{r.invoiceNumber}</span>
              <span className="sc2-dot">·</span>
              <span className="sc2-meta-val">{monthYearLabel(r.billingPeriod.month, r.billingPeriod.year)}</span>
              <span className="sc2-dot">·</span>
              <span className="sc2-meta-val">Paid {formatCurrency(r.totalPayments)}</span>
            </div>
          </div>
          <div className="inv2-right">
            <span className={`inv2-due${isDue ? " inv2-due--owed" : " inv2-due--clear"}`}>
              {formatCurrency(r.netAmountDue)}
            </span>
            <StatusTag value={r.status} />
          </div>
        </div>
        <div className="inv2-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm" onClick={() => navigate(`/invoices/${r._id}`)}>
            <FileText size={13} /> View
          </button>
          <button className="btn btn-sm" onClick={() => handleDownloadPDF(r)} disabled={isInvoiceActionLoading(`${r._id}_pdf`)}>
            <Download size={13} /> {isInvoiceActionLoading(`${r._id}_pdf`) ? "…" : "PDF"}
          </button>
          <button className="btn btn-sm" onClick={() => handleSendWhatsApp(r)} disabled={isInvoiceActionLoading(`${r._id}_wa`)}>
            <MessageCircle size={13} /> {isInvoiceActionLoading(`${r._id}_wa`) ? "…" : "WA"}
          </button>
        </div>
      </div>
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
          <button className="btn btn-sm" title="Download PDF" disabled={isInvoiceActionLoading(`${r._id}_pdf`)} onClick={(e) => { e.stopPropagation(); handleDownloadPDF(r); }}>
            <Download size={14} />
          </button>
          <button className="btn btn-sm" title="Send via WhatsApp" disabled={isInvoiceActionLoading(`${r._id}_wa`)} onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(r); }}>
            <MessageCircle size={14} />
          </button>
        </div>
      ),
    },
  ];

  if (loading && invoices.length === 0) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="invoices-page view-stack">
      <PageHeader
        title="Invoices"
        subtitle={`${pagination.total} invoice${pagination.total !== 1 ? "s" : ""} for ${monthYearLabel(month, year)}`}
        actions={
          <div className="inv-header-actions">
            <button className="btn inv-hdr-btn" onClick={() => setCustomInvOpen(true)} title="Custom Invoice">
              <FilePlus size={20} className="inv-hdr-icon" />
              <span className="btn-label">Custom Invoice</span>
            </button>
            <button className="btn btn-primary inv-hdr-btn" onClick={() => setGenerateOpen(true)} title="Generate Invoices">
              <Plus size={20} className="inv-hdr-icon" />
              <span className="btn-label">Generate</span>
            </button>
          </div>
        }
      />

      {/* Month slider */}
      <div className="month-selector">
        <button className="month-selector-nav" onClick={goPrevMonth} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className="month-selector-label">
          <Calendar size={13} />
          {monthYearLabel(month, year)}
          {isCurrentMonth && <span className="month-selector-current">This Month</span>}
        </span>
        <button className="month-selector-nav" onClick={goNextMonth} disabled={isCurrentMonth} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Filters */}
      <div className="surface-filters inv-filter-bar">
        <div className="inv-filter-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoice or customer…" />
          <div className="inv-status-filter">
            <select value={status} onChange={e => handleStatusChange(e.target.value)}>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {invoices.length === 0 ? (
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
            data={invoices}
            loading={loading}
            onRowClick={(r) => navigate(`/invoices/${r._id}`)}
            renderCard={renderInvoiceCard}
            pagination={{ ...pagination, onPageChange: setPage, onLimitChange: setLimit }}
            sortBy={sort.sortBy}
            sortOrder={sort.sortOrder}
            onSortChange={handleSort}
            serverSide
          />
        </div>
      )}

      <GenerateInvoiceModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSuccess={refetch}
      />

      <CustomInvoiceModal
        open={customInvOpen}
        onClose={() => setCustomInvOpen(false)}
      />
    </div>
  );
}
