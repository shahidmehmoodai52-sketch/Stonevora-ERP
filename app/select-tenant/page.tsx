import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listUserTenants } from "@/lib/tenant/getActiveTenant";
import { selectTenantAction } from "@/actions/tenants";

export default async function SelectTenantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memberships = await listUserTenants();
  if (memberships.length === 0) redirect("/onboarding");
  if (memberships.length === 1) redirect("/products");

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Choose a company
        </h1>
        <div className="flex flex-col gap-2">
          {memberships.map((m) => (
            <form key={m.tenantId} action={selectTenantAction.bind(null, m.tenantId)}>
              <button
                type="submit"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {m.tenantName}
              </button>
            </form>
          ))}
        </div>
        <Link
          href="/onboarding"
          className="mt-6 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          + Create another company
        </Link>
      </div>
    </div>
  );
}
