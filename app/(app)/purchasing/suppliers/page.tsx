import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createSupplierAction } from "@/actions/purchasing";
import { ActionForm } from "@/components/ActionForm";

export default async function SuppliersPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, code, name, phone, email")
    .eq("tenant_id", tenant.tenantId)
    .order("name");

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Suppliers</h1>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">Code</th>
              <th className="py-3">Name</th>
              <th className="hidden py-3 sm:table-cell">Phone</th>
              <th className="hidden py-3 sm:table-cell">Email</th>
            </tr>
          </thead>
          <tbody>
            {(suppliers ?? []).map((s) => (
              <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-3">{s.code}</td>
                <td className="py-3">
                  <Link href={`/purchasing/suppliers/${s.id}`} className="font-medium hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="hidden py-3 sm:table-cell">{s.phone}</td>
                <td className="hidden py-3 sm:table-cell">{s.email}</td>
              </tr>
            ))}
            {(suppliers ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-zinc-500">No suppliers yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add supplier</h2>
      <ActionForm action={createSupplierAction} submitLabel="Add supplier" className="flex flex-col gap-4 max-w-sm">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Code</label>
          <input name="code" required className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
          <input name="name" required className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Contact name</label>
          <input name="contactName" className="input" />
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
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Payment terms (days)</label>
          <input name="paymentTermsDays" type="number" defaultValue={0} className="input" />
        </div>
      </ActionForm>
    </div>
  );
}
