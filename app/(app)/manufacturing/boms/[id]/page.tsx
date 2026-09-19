import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function BomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActiveTenant();
  const supabase = await createClient();

  const { data: bom } = await supabase
    .from("bill_of_materials")
    .select("*, products(sku, name)")
    .eq("id", id)
    .single();

  if (!bom) notFound();

  const [{ data: lines }, { data: uoms }] = await Promise.all([
    supabase
      .from("bill_of_materials_lines")
      .select("id, quantity, uom_id, products(sku, name)")
      .eq("bom_id", id),
    supabase.from("uom").select("id, code"),
  ]);

  const uomCodeById = new Map((uoms ?? []).map((u) => [u.id, u.code]));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{bom.bom_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {bom.name ? `${bom.name} · ` : ""}
        {bom.products?.sku} — {bom.products?.name} · Output {bom.output_quantity} {uomCodeById.get(bom.output_uom_id)}
        {" · "}
        <span className="font-medium">{bom.is_active ? "Active" : "Inactive"}</span>
      </p>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Raw materials</h2>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2">UOM</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">{l.products?.sku} — {l.products?.name}</td>
                <td className="py-2 pr-2">{l.quantity}</td>
                <td className="py-2">{uomCodeById.get(l.uom_id)}</td>
              </tr>
            ))}
            {(lines ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-zinc-500">No raw material lines.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
