import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  limit,
  onLimitChange,
  showMeta = false,
  pageSizeOptions = [10, 20, 50, 100],
}) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  if (totalPages <= 1 && !showMeta) return null;
  if (totalPages <= 1 && showMeta && total == null) return null;

  const getPageNumbers = (maxVisible) => {
    const pages = [];
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (page < totalPages - 2) pages.push("...");
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const pageButtons = (maxVisible) =>
    getPageNumbers(maxVisible).map((p, i) =>
      p === "..." ? (
        <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
      ) : (
        <button
          key={p}
          className={`pagination-page-btn${p === page ? " active" : ""}`}
          onClick={() => onPageChange(p)}
          type="button"
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </button>
      )
    );

  // Single-page: just show meta + size selector
  if (totalPages <= 1) {
    return (
      <div className="pagination-bar">
        {total != null && showMeta && (
          <span className="pagination-meta">{total} {total === 1 ? "record" : "records"}</span>
        )}
        {onLimitChange && limit && (
          <div className="pagination-size">
            <span>Show</span>
            <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))} aria-label="Rows per page">
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>per page</span>
          </div>
        )}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="pagination-bar pagination-bar--mobile">
        {/* Top row: record count + rows selector inline */}
        {(showMeta || onLimitChange) && (
          <div className="pagination-meta-row">
            {showMeta && total != null && (
              <span className="pagination-meta">{total} {total === 1 ? "record" : "records"}</span>
            )}
            {onLimitChange && limit && (
              <div className="pagination-size">
                <span>Show</span>
                <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))} aria-label="Rows per page">
                  {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
        {/* Bottom row: prev · pages · next */}
        <div className="pagination-controls">
          <button
            className="pagination-nav-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            type="button"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="pagination-pages">{pageButtons(3)}</div>
          <button
            className="pagination-nav-btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            type="button"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Desktop: count left · controls center · rows-per-page right
  return (
    <div className="pagination-bar">
      <span className="pagination-meta">
        {showMeta && total != null
          ? `${total} ${total === 1 ? "record" : "records"}`
          : <span />}
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-nav-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} aria-hidden />
          <span>Prev</span>
        </button>
        <div className="pagination-pages">{pageButtons(5)}</div>
        <button
          className="pagination-nav-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={14} aria-hidden />
        </button>
      </div>
      {onLimitChange && limit ? (
        <div className="pagination-size">
          <span>Show</span>
          <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))} aria-label="Rows per page">
            {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>per page</span>
        </div>
      ) : <span />}
    </div>
  );
}
