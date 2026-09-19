import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

// Same purely-UX capability gate as /factory, /projects, /manufacturing --
// activate_stock_reservation/convert_reservation_to_sales_order already
// enforce has_capability(..., 'showroom_reservation') independently
// (release_stock_reservation deliberately does not, matching
// cancel_processing_job/cancel_production_batch's precedent).
export default async function ReservationsLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: capabilityRow } = await supabase
    .from("business_capabilities")
    .select("id")
    .eq("code", "showroom_reservation")
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
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reservations</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The Showroom Reservation capability isn&apos;t enabled for this business yet. Turn it on in{" "}
          <Link href="/settings/capabilities" className="underline">
            Business capabilities
          </Link>{" "}
          to hold stock for a walk-in customer before they commit to an order.
        </p>
      </div>
    );
  }

  return <div>{children}</div>;
}
