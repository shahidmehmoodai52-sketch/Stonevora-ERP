import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createPriceListItemAction } from "@/actions/sales";
import { ActionForm } from "@/components/ActionForm";

export default async function PriceListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: priceList }, { data: items }, { data: products }] = await Promise.all([
    supabase.from("price_lists").select("*").eq("id", id).single(),
    supabase
      .from("price_list_items")
      .select("id, price, effective_from, products(sku, name)")
      .eq("price_list_id", id)
      .order("effective_from", { ascending: false }),
    supabase
      .from("products")
      .select("id, sku, name")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
  ]);

  if (!priceList) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{priceList.name}</h1>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">Product</th>
              <th className="py-3">Price</th>
              <th className="py-3">Since</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it) => (
              <tr key={it.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-3">{it.products?.sku} — {it.products?.name}</td>
                <td className="py-3">{it.price}</td>
                <td className="py-3">{it.effective_from}</td>
              </tr>
            ))}
            {(items ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-zinc-500">No prices set yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add / update price</h2>
      <ActionForm
        action={createPriceListItemAction.bind(null, id)}
        submitLabel="Save price"
        className="flex flex-col gap-4 max-w-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Product</label>
          <select name="productId" required className="input">
            <option value="">—</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Price</label>
          <input name="price" type="number" step="0.0001" required className="input" />
        </div>
      </ActionForm>
    </div>
  );
}
