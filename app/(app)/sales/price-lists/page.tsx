import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createPriceListAction } from "@/actions/sales";
import { ActionForm } from "@/components/ActionForm";

export default async function PriceListsPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const [{ data: priceLists }, { data: currencies }] = await Promise.all([
    supabase
      .from("price_lists")
      .select("id, code, name, currencies(iso_code)")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
    supabase.from("currencies").select("id, iso_code").order("iso_code"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Price lists</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Create a price list per pricing tier — retail, dealer, wholesale, project — and assign one to
        each customer.
      </p>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">Code</th>
              <th className="py-3">Name</th>
              <th className="py-3">Currency</th>
            </tr>
          </thead>
          <tbody>
            {(priceLists ?? []).map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-3">{p.code}</td>
                <td className="py-3">
                  <Link href={`/sales/price-lists/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="py-3">{p.currencies?.iso_code}</td>
              </tr>
            ))}
            {(priceLists ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-zinc-500">No price lists yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add price list</h2>
      <ActionForm action={createPriceListAction} submitLabel="Add price list" className="flex flex-col gap-4 max-w-sm">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Code</label>
          <input name="code" required className="input" placeholder="DEALER" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
          <input name="name" required className="input" placeholder="Dealer Price List" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Currency</label>
          <select name="currencyId" className="input">
            <option value="">—</option>
            {(currencies ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.iso_code}</option>
            ))}
          </select>
        </div>
      </ActionForm>
    </div>
  );
}
