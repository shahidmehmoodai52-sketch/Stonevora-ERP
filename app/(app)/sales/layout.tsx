import Link from "next/link";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-4 border-b border-zinc-200 text-sm dark:border-zinc-800">
        <Link href="/sales/orders" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Sales Orders
        </Link>
        <Link href="/sales/invoices" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Invoices
        </Link>
        <Link href="/sales/customers" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Customers
        </Link>
        <Link href="/sales/price-lists" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Price Lists
        </Link>
      </nav>
      {children}
    </div>
  );
}
