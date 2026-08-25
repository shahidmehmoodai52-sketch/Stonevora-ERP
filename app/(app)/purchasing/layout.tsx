import Link from "next/link";

export default function PurchasingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b border-zinc-200 text-sm dark:border-zinc-800">
        <Link href="/purchasing/orders" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Purchase Orders
        </Link>
        <Link href="/purchasing/suppliers" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Suppliers
        </Link>
      </nav>
      {children}
    </div>
  );
}
