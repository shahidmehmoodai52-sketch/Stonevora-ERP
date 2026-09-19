import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

// Same purely-UX capability gate as app/(app)/factory/layout.tsx -- every
// underlying RPC (add_project_material/complete_project/
// generate_project_invoice) already enforces has_capability(...,
// 'stone_fabrication') independently.
export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: capabilityRow } = await supabase
    .from("business_capabilities")
    .select("id")
    .eq("code", "stone_fabrication")
    .single();
  const { data: enabled } = capabilityRow
    ? await supabase
        .from("tenant_capabilities")
        .select("id")
        .eq("tenant_id", tenant.tenantId)
        .eq("capability_id", capabilityRow.id)
        .maybeSingle()
    : { data: null };

  if (!enabled) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Projects</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The Stone Fabrication capability isn&apos;t enabled for this business yet. Turn it on in{" "}
          <Link href="/settings/capabilities" className="underline">
            Business capabilities
          </Link>{" "}
          to consume slabs/remnants into customer fabrication projects and invoice by area.
        </p>
      </div>
    );
  }

  return <div>{children}</div>;
}
