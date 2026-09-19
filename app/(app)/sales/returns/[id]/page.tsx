import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";
import { postSalesReturnAction } from "@/actions/sales";
import { PostButton } from "@/components/PostButton";

export default async function SalesReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: ret }, { data: lines }, permissionSet] = await Promise.all([
    supabase
      .from("sales_returns")
      .select("*, customers(name), branches(name), sales_invoices(invoice_number)")
      .eq("id", id)
      .single(),
    supabase
      .from("sales_return_lines_secure")
      .select("id, quantity, unit_price, line_total, unit_cost, margin, restock, products(sku, name)")
      .eq("sales_return_id", id),
    fetchPermissionSet(tenant.tenantId),
  ]);

  if (!ret) notFound();

  const showCost = hasPermission(permissionSet, "sales", "view_cost") || hasPermission(permissionSet, "sales", "view_profit");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{ret.return_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {ret.customers?.name} · {ret.branches?.name} · against invoice {ret.sales_invoices?.invoice_number} ·{" "}
        <span className="font-medium">{ret.status}</span>
      </p>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Lines</h2>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2 pr-2">Total</th>
              {showCost && <th className="py-2 pr-2">Cost</th>}
              <th className="py-2">Restocked</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">{l.products?.sku} — {l.products?.name}</td>
                <td className="py-2 pr-2">{l.quantity}</td>
                <td className="py-2 pr-2">{l.line_total}</td>
                {showCost && <td className="py-2 pr-2">{l.unit_cost ?? "—"}</td>}
                <td className="py-2">{l.restock ? "Yes" : "No — scrapped/damaged"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mb-6 text-sm text-zinc-700 dark:text-zinc-300">
        Total credit: <span className="font-medium">{ret.total_amount}</span>
      </p>

      {ret.status === "draft" && (
        <PostButton id={id} action={postSalesReturnAction} label="Post return" pendingLabel="Posting…" />
      )}
    </div>
  );
}
