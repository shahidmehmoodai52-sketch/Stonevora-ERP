import Link from "next/link";
import { requireActiveTenant, listUserTenants } from "@/lib/tenant/getActiveTenant";
import { signOutAction } from "@/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireActiveTenant();
  const memberships = await listUserTenants();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Stonevora ERP
            </span>
            <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <Link href="/products" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                Products
              </Link>
              <Link
                href="/settings/company"
                className="hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {memberships.length > 1 ? (
              <Link
                href="/select-tenant"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                {tenant.tenantName} ⇄
              </Link>
            ) : (
              <span className="text-zinc-600 dark:text-zinc-400">{tenant.tenantName}</span>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
