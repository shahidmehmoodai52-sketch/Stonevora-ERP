import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { setTenantCapabilityAction } from "@/actions/settings";
import { CapabilityToggleList } from "./CapabilityToggleList";

export default async function CapabilitiesSettingsPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: capabilities }, { data: enabled }] = await Promise.all([
    supabase.from("business_capabilities").select("id, code, name, description").order("sort_order"),
    supabase.from("tenant_capabilities").select("capability_id").eq("tenant_id", tenant.tenantId),
  ]);

  const enabledIds = new Set((enabled ?? []).map((e) => e.capability_id));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Business capabilities
      </h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Turn on the operating modes this business actually uses. Stonevora adapts to a
        small retail shop or a full factory — nothing you don&apos;t enable shows up.
      </p>
      <CapabilityToggleList
        capabilities={(capabilities ?? []).map((c) => ({
          ...c,
          enabled: enabledIds.has(c.id),
        }))}
        action={setTenantCapabilityAction}
      />
    </div>
  );
}
