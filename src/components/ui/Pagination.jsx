import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

export default function Pagination({ page, totalPages, onPageChange }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  if (totalPages <= 1) return null;

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

  const renderMobilePagination = () => (
    <div className="pagination mobile">
      <button
        className="mini-button with-icon"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
        aria-label="Previous page"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="pagination-pages">
        {getPageNumbers(3).map((p, i) => (
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={p === page ? "mini-button active" : "mini-button"}
              onClick={() => onPageChange(p)}
              type="button"
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        ))}
      </div>
      <button
        className="mini-button with-icon"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
        aria-label="Next page"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );

  const renderDesktopPagination = () => (
    <div className="pagination">
      <button
        className="mini-button with-icon"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} aria-hidden />
        <span>Previous</span>
      </button>
      <div className="pagination-pages">
        {getPageNumbers(5).map((p, i) => (
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={p === page ? "mini-button active" : "mini-button"}
              onClick={() => onPageChange(p)}
              type="button"
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        ))}
      </div>
      <button
        className="mini-button with-icon"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
        aria-label="Next page"
      >
        <span>Next</span>
        <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  );

  return isMobile ? renderMobilePagination() : renderDesktopPagination();
}
