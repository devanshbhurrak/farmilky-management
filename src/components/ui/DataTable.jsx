import { useState, useMemo, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import EmptyState from "./EmptyState";
import Pagination from "./Pagination";
import LoadingSkeleton from "./LoadingSkeleton";
import { useMediaQuery } from "../../hooks/useMediaQuery";

export default function DataTable({
  columns,
  data,
  loading,
  sortable = true,
  defaultSortKey,
  defaultSortDir = "asc",
  pageSize = 20,
  onRowClick,
  emptyText = "No data available.",
  searchQuery = "",
  searchKeys = [],
  renderCard,
  emptyAction,
  noMatchAction,
  scrollable = false,
}) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sortKey, setSortKey] = useState(defaultSortKey || columns[0]?.key);
  const [sortDir, setSortDir] = useState(defaultSortDir);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!searchQuery || !searchKeys.length) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((key) => {
        const val = key.split(".").reduce((o, k) => o?.[k], row);
        return val?.toString().toLowerCase().includes(q);
      })
    );
  }, [data, searchQuery, searchKeys]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [filtered, sortKey, sortDir]);

  const sorted = useMemo(() => {
    if (!filtered) return [];
    if (!sortable || !sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || col.sortable === false) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = sortKey.split(".").reduce((o, k) => o?.[k], a);
      const bVal = sortKey.split(".").reduce((o, k) => o?.[k], b);
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortKey, sortDir, sortable, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  function handleSort(key) {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (loading) return <LoadingSkeleton rows={5} columns={columns.length} />;

  if (!data || data.length === 0) {
    return <EmptyState text={emptyText} action={emptyAction} />;
  }

  const getCellValue = (row, col) =>
    col.render
      ? col.render(row)
      : col.key.split(".").reduce((o, k) => o?.[k], row) ?? "-";

  const renderMobileView = () => (
    <div className="card-list">
      {paged.length === 0 ? (
        <EmptyState text="No matching records." action={noMatchAction} />
      ) : (
        paged.map((row, i) => (
          <div
            key={row._id || row.id || i}
            className="mobile-data-card"
            onClick={() => onRowClick?.(row)}
            {...(onRowClick
              ? {
                  tabIndex: 0,
                  role: "link",
                  onKeyDown: (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  },
                }
              : {})}
          >
            {renderCard ? (
              renderCard(row)
            ) : (
              <div className="fallback-card-row">
                <strong>{columns[0]?.render ? columns[0].render(row) : columns[0]?.key.split(".").reduce((o, k) => o?.[k], row) ?? "-"}</strong>
                <span className="text-muted">{columns[1]?.key ? columns[1].key.split(".").reduce((o, k) => o?.[k], row) ?? "" : ""}</span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderDesktopView = () => (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {columns.map((col) => {
              const isSortable = sortable && col.sortable !== false;
              const isSorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    isSorted
                      ? sortDir === "asc" ? "ascending" : "descending"
                      : undefined
                  }
                >
                  {isSortable ? (
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {isSorted &&
                        (sortDir === "asc"
                          ? <ChevronUp size={14} aria-hidden />
                          : <ChevronDown size={14} aria-hidden />)}
                    </button>
                  ) : (
                    <span>{col.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {paged.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState text="No matching records." action={noMatchAction} />
              </td>
            </tr>
          ) : (
            paged.map((row, i) => (
              <tr
                key={row._id || row.id || i}
                onClick={() => onRowClick?.(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((col) => (
                  <td key={col.key} data-label={col.label}>
                    {getCellValue(row, col)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (scrollable) {
    return (
      <div className="datatable-scrollable">
        <div className="datatable-scroll-body">
          {isMobile ? renderMobileView() : renderDesktopView()}
        </div>
        {totalPages > 1 && (
          <div className="datatable-scroll-footer">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {isMobile ? renderMobileView() : renderDesktopView()}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
