import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function ProjectsPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, project_number, status, material_cost, total_cost, customers(name)")
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Projects</h1>
        <Link href="/projects/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          New project
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Number</th>
              <th className="py-2 pr-2">Customer</th>
              <th className="py-2 pr-2">Material cost</th>
              <th className="py-2 pr-2">Total cost</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <Link href={`/projects/${p.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {p.project_number}
                  </Link>
                </td>
                <td className="py-2 pr-2">{p.customers?.name}</td>
                <td className="py-2 pr-2">{p.material_cost}</td>
                <td className="py-2 pr-2">{p.total_cost ?? "—"}</td>
                <td className="py-2">{p.status}</td>
              </tr>
            ))}
            {(projects ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">No projects yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
