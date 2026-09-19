import Link from "next/link";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b border-zinc-200 text-sm dark:border-zinc-800">
        <Link href="/inventory/adjustments" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Stock Adjustments
        </Link>
      </nav>
      {children}
    </div>
  );
}
