import Link from "next/link";
import { PAGE_SIZE } from "@/lib/pagination";

// Plain Previous/Next pager, server-rendered (no client JS needed) -- every
// list screen links to the same route with ?page=N, so this works
// identically whether the page has other query params or not (none of the
// paginated list screens currently take any).
export function Pagination({
  currentPage,
  totalCount,
  basePath,
  pageSize = PAGE_SIZE,
}: {
  currentPage: number;
  totalCount: number;
  basePath: string;
  pageSize?: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const prevHref = `${basePath}?page=${currentPage - 1}`;
  const nextHref = `${basePath}?page=${currentPage + 1}`;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
      <span>
        Page {currentPage} of {totalPages} ({totalCount} total)
      </span>
      <div className="flex gap-2">
        {currentPage > 1 ? (
          <Link
            href={prevHref}
            className="flex min-h-11 items-center rounded-md border border-zinc-300 px-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Previous
          </Link>
        ) : (
          <span className="flex min-h-11 items-center rounded-md border border-zinc-200 px-3 opacity-40 dark:border-zinc-800">
            Previous
          </span>
        )}
        {currentPage < totalPages ? (
          <Link
            href={nextHref}
            className="flex min-h-11 items-center rounded-md border border-zinc-300 px-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Next
          </Link>
        ) : (
          <span className="flex min-h-11 items-center rounded-md border border-zinc-200 px-3 opacity-40 dark:border-zinc-800">
            Next
          </span>
        )}
      </div>
    </div>
  );
}
