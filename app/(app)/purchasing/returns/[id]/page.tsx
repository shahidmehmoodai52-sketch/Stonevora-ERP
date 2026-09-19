import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postPurchaseReturnAction } from "@/actions/purchasing";
import { PostButton } from "@/components/PostButton";

export default async function PurchaseReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: ret }, { data: lines }] = await Promise.all([
    supabase
      .from("purchase_returns")
      .select("*, suppliers(name), branches(name), goods_receipts(grn_number)")
      .eq("id", id)
      .single(),
    supabase
      .from("purchase_return_lines")
      .select("id, quantity, unit_cost, line_total, products(sku, name)")
      .eq("purchase_return_id", id),
  ]);

  if (!ret) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{ret.return_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {ret.suppliers?.name} · {ret.branches?.name} · against receipt {ret.goods_receipts?.grn_number} ·{" "}
        <span className="font-medium">{ret.status}</span>
      </p>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Lines</h2>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2 pr-2">Unit cost</th>
              <th className="py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">{l.products?.sku} — {l.products?.name}</td>
                <td className="py-2 pr-2">{l.quantity}</td>
                <td className="py-2 pr-2">{l.unit_cost}</td>
                <td className="py-2">{l.line_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mb-6 text-sm text-zinc-700 dark:text-zinc-300">
        Total debit: <span className="font-medium">{ret.total_amount}</span>
      </p>

      {ret.status === "draft" && (
        <PostButton id={id} action={postPurchaseReturnAction} label="Post return" pendingLabel="Posting…" />
      )}
    </div>
  );
}
