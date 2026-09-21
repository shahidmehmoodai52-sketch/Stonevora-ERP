import Link from "next/link";

// Unlike Factory/Projects/Manufacturing/Reservations, accounting is not an
// optional business_capabilities module -- it's always-on core
// functionality (like Trading/Distribution), gated purely by the
// 'accounting' permission resource. No capability check needed here.
export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-4 border-b border-zinc-200 text-sm dark:border-zinc-800">
        <Link href="/accounting/chart-of-accounts" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Chart of Accounts
        </Link>
        <Link href="/accounting/journal-entries" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Journal Entries
        </Link>
        <Link href="/accounting/reports/profit-and-loss" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Profit &amp; Loss
        </Link>
        <Link href="/accounting/reports/balance-sheet" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Balance Sheet
        </Link>
        <Link href="/accounting/reports/trial-balance" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Trial Balance
        </Link>
      </nav>
      {children}
    </div>
  );
}
