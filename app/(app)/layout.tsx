import Link from "next/link";
import { requireActiveTenant, listUserTenants } from "@/lib/tenant/getActiveTenant";
import { signOutAction } from "@/actions/auth";
import { OfflineProvider } from "@/lib/offline/OfflineProvider";
import { OfflineStatusBadge } from "@/lib/offline/OfflineStatusBadge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireActiveTenant();
  const memberships = await listUserTenants();

  return (
    <OfflineProvider tenantId={tenant.tenantId}>
      <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-4 sm:gap-6">
              <span className="shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Stonevora
              </span>
              <nav className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                <Link
                  href="/products"
                  className="flex min-h-11 items-center px-2 hover:text-zinc-900 dark:hover:text-zinc-50"
                >
                  Products
                </Link>
                <Link
                  href="/purchasing/orders"
                  className="flex min-h-11 items-center px-2 hover:text-zinc-900 dark:hover:text-zinc-50"
                >
                  Purchasing
                </Link>
                <Link
                  href="/sales/orders"
                  className="flex min-h-11 items-center px-2 hover:text-zinc-900 dark:hover:text-zinc-50"
                >
                  Sales
                </Link>
                <Link
                  href="/settings/company"
                  className="flex min-h-11 items-center px-2 hover:text-zinc-900 dark:hover:text-zinc-50"
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex min-w-0 items-center gap-3 text-sm sm:gap-4">
              <OfflineStatusBadge />
              {memberships.length > 1 ? (
                <Link
                  href="/select-tenant"
                  className="flex min-h-11 max-w-32 items-center truncate text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 sm:max-w-none"
                >
                  <span className="truncate">{tenant.tenantName}</span>&nbsp;⇄
                </Link>
              ) : (
                <span className="max-w-32 truncate text-zinc-600 dark:text-zinc-400 sm:max-w-none">
                  {tenant.tenantName}
                </span>
              )}
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex min-h-11 items-center px-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </OfflineProvider>
  );
}
