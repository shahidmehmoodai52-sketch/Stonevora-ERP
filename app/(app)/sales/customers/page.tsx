import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createCustomerAction } from "@/actions/sales";
import { ActionForm } from "@/components/ActionForm";

export default async function CustomersPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const [{ data: customers }, { data: priceLists }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, code, name, customer_type, phone, email")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
    supabase.from("price_lists").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Customers</h1>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">Code</th>
              <th className="py-3">Name</th>
              <th className="hidden py-3 sm:table-cell">Type</th>
              <th className="hidden py-3 sm:table-cell">Phone</th>
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-3">{c.code}</td>
                <td className="py-3">
                  <Link href={`/sales/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="hidden py-3 sm:table-cell">{c.customer_type}</td>
                <td className="hidden py-3 sm:table-cell">{c.phone}</td>
              </tr>
            ))}
            {(customers ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-zinc-500">No customers yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add customer</h2>
      <ActionForm action={createCustomerAction} submitLabel="Add customer" className="flex flex-col gap-4 max-w-sm">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Code</label>
          <input name="code" required className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
          <input name="name" required className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Type</label>
          <select name="customerType" className="input" defaultValue="retail">
            <option value="retail">Retail</option>
            <option value="dealer">Dealer</option>
            <option value="contractor">Contractor</option>
            <option value="project">Project</option>
            <option value="corporate">Corporate</option>
            <option value="international">International</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Price list</label>
          <select name="priceListId" className="input">
            <option value="">—</option>
            {(priceLists ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Phone</label>
          <input name="phone" className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
          <input name="email" type="email" className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Credit limit</label>
          <input name="creditLimit" type="number" step="0.01" className="input" />
        </div>
      </ActionForm>
    </div>
  );
}
