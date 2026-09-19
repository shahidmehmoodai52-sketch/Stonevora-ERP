import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { releaseStockReservationAction } from "@/actions/reservations";
import { PostButton } from "@/components/PostButton";
import { ActivateReservationForm } from "./ActivateReservationForm";
import { ConvertReservationForm } from "./ConvertReservationForm";

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActiveTenant();
  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("stock_reservations")
    .select("*, customers(name), branches(name)")
    .eq("id", id)
    .single();

  if (!reservation) notFound();

  const { data: lines } = await supabase
    .from("stock_reservation_lines")
    .select("id, quantity, unit_price, products(sku, name)")
    .eq("stock_reservation_id", id);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{reservation.reservation_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {reservation.customers?.name} · {reservation.branches?.name} ·{" "}
        <span className="font-medium">{reservation.status}</span>
        {reservation.expires_at && ` · expires ${reservation.expires_at}`}
      </p>

      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2">Indicative price</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">{l.products?.sku} — {l.products?.name}</td>
                <td className="py-2 pr-2">{l.quantity}</td>
                <td className="py-2">{l.unit_price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reservation.status === "draft" && <ActivateReservationForm stockReservationId={reservation.id} />}

      {reservation.status === "active" && (
        <div className="flex flex-col gap-6">
          <PostButton id={reservation.id} action={releaseStockReservationAction} label="Release hold" pendingLabel="Releasing…" />
          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Convert to sales order</h2>
            <ConvertReservationForm stockReservationId={reservation.id} />
          </div>
        </div>
      )}

      {reservation.status === "converted" && reservation.sales_order_id && (
        <p className="text-sm text-zinc-500">
          Converted — see <Link href={`/sales/orders/${reservation.sales_order_id}`} className="underline">the sales order</Link>.
        </p>
      )}

      {reservation.status === "released" && <p className="text-sm text-zinc-500">Released — no stock is held.</p>}
    </div>
  );
}
