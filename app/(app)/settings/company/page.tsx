import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { CompanySettingsForm } from "./CompanySettingsForm";

export default async function CompanySettingsPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: tenantRow }, { data: settingsRow }, { data: countries }, { data: currencies }] =
    await Promise.all([
      supabase.from("tenants").select("name").eq("id", tenant.tenantId).single(),
      supabase.from("tenant_settings").select("*").eq("tenant_id", tenant.tenantId).single(),
      supabase.from("countries").select("id, name").order("name"),
      supabase.from("currencies").select("id, iso_code, name").order("iso_code"),
    ]);

  return (
    <div className="max-w-lg">
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Company settings
      </h1>
      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/settings/branches" className="text-zinc-600 hover:underline dark:text-zinc-400">Branches</Link>
        <Link href="/settings/warehouses" className="text-zinc-600 hover:underline dark:text-zinc-400">Warehouses</Link>
        <Link href="/settings/roles" className="text-zinc-600 hover:underline dark:text-zinc-400">Roles</Link>
        <Link href="/settings/users" className="text-zinc-600 hover:underline dark:text-zinc-400">Users</Link>
        <Link href="/settings/capabilities" className="text-zinc-600 hover:underline dark:text-zinc-400">Business capabilities</Link>
      </nav>
      <CompanySettingsForm
        name={tenantRow?.name ?? ""}
        countryId={settingsRow?.country_id ?? ""}
        baseCurrencyId={settingsRow?.base_currency_id ?? ""}
        fiscalYearStartMonth={settingsRow?.fiscal_year_start_month ?? 1}
        timezone={settingsRow?.timezone ?? "UTC"}
        countries={countries ?? []}
        currencies={currencies ?? []}
      />
    </div>
  );
}
