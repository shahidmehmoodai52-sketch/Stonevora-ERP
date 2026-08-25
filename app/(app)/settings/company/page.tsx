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
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Company settings
      </h1>
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
