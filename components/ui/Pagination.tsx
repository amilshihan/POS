"use client";

export const PAGE_SIZE = 20;

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginated = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return { totalPages, currentPage, paginated };
}

const btnClass =
  "px-2.5 py-1.5 rounded-lg border border-input text-muted hover:bg-surface hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed";

export default function Pagination({
  page,
  totalPages,
  totalItems,
  shownCount,
  onPageChange,
  itemLabel = "items",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  shownCount: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-card text-sm">
      <span className="text-muted">
        Page {page} of {totalPages} · Showing {shownCount} of {totalItems} {itemLabel}
      </span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onPageChange(1)} disabled={page <= 1} className={btnClass} aria-label="First page">
          « First
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className={btnClass} aria-label="Previous page">
          ‹ Prev
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={btnClass}
          aria-label="Next page"
        >
          Next ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className={btnClass}
          aria-label="Last page"
        >
          Last »
        </button>
      </div>
    </div>
  );
}
