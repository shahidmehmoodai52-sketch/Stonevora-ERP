import Link from "next/link";

// Cross-module reporting, not an optional business_capabilities module --
// always-on core (same reasoning as /accounting), gated purely by the
// per-report permission each RPC already checks server-side.
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-4 border-b border-zinc-200 text-sm dark:border-zinc-800">
        <Link href="/reports" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Dashboard
        </Link>
        <Link href="/reports/sales" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Sales
        </Link>
        <Link href="/reports/inventory-valuation" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Inventory Valuation
        </Link>
        <Link href="/reports/low-stock" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Low Stock
        </Link>
        <Link href="/reports/receivables-aging" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Receivables Aging
        </Link>
        <Link href="/reports/payables-aging" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Payables Aging
        </Link>
      </nav>
      {children}
    </div>
  );
}
