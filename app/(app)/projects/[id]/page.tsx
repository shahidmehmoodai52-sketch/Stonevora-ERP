import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";
import { cancelProjectAction, removeProjectMaterialAction } from "@/actions/projects";
import { PostButton } from "@/components/PostButton";
import { AddMaterialForm } from "./AddMaterialForm";
import { CompleteProjectForm } from "./CompleteProjectForm";
import { GenerateInvoiceForm } from "./GenerateInvoiceForm";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: project }, permissionSet, { data: uoms }] = await Promise.all([
    supabase.from("projects").select("*, customers(name), branches(name)").eq("id", id).single(),
    fetchPermissionSet(tenant.tenantId),
    supabase.from("uom").select("id, code"),
  ]);

  if (!project) notFound();

  const showCost = hasPermission(permissionSet, "project", "view_cost") || hasPermission(permissionSet, "project", "view_profit");
  const uomCodeById = new Map((uoms ?? []).map((u) => [u.id, u.code]));

  const { data: materials } = await supabase
    .from("project_materials")
    .select("inventory_unit_id, inventory_units(unit_code, unit_type, actual_area, area_uom_id, cost, products(sku, name))")
    .eq("project_id", id);

  const { data: availableUnits } = await supabase
    .from("inventory_units")
    .select("id, unit_code, unit_type, actual_area, area_uom_id, products(sku, name)")
    .eq("tenant_id", tenant.tenantId)
    .in("unit_type", ["slab", "remnant"])
    .eq("status", "in_stock")
    .order("unit_code");

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{project.project_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {project.customers?.name} · {project.branches?.name} · <span className="font-medium">{project.status}</span>
      </p>

      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {showCost && (
          <>
            <div>
              <dt className="text-zinc-500">Material cost</dt>
              <dd>{project.material_cost}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Labor / overhead</dt>
              <dd>{project.labor_cost ?? "—"} / {project.overhead_cost ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Total cost</dt>
              <dd>{project.total_cost ?? "—"}</dd>
            </div>
          </>
        )}
      </dl>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Materials</h2>
      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Code</th>
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Area</th>
              {showCost && <th className="py-2 pr-2">Cost</th>}
              {project.status === "draft" && <th className="py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {(materials ?? []).map((m) => (
              <tr key={m.inventory_unit_id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">{m.inventory_units?.unit_code}</td>
                <td className="py-2 pr-2">{m.inventory_units?.products?.sku} — {m.inventory_units?.products?.name}</td>
                <td className="py-2 pr-2">{m.inventory_units?.unit_type}</td>
                <td className="py-2 pr-2">
                  {m.inventory_units?.actual_area}{" "}
                  {m.inventory_units?.area_uom_id ? uomCodeById.get(m.inventory_units.area_uom_id) : ""}
                </td>
                {showCost && <td className="py-2 pr-2">{m.inventory_units?.cost ?? "—"}</td>}
                {project.status === "draft" && (
                  <td className="py-2">
                    <PostButton
                      id={m.inventory_unit_id}
                      action={(unitId) => removeProjectMaterialAction(id, unitId)}
                      label="Remove"
                      pendingLabel="Removing…"
                    />
                  </td>
                )}
              </tr>
            ))}
            {(materials ?? []).length === 0 && (
              <tr>
                <td colSpan={showCost ? 6 : 5} className="py-4 text-zinc-500">No materials added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {project.status === "draft" && (
        <>
          <AddMaterialForm
            projectId={project.id}
            availableUnits={(availableUnits ?? []).map((u) => ({
              id: u.id,
              label: `${u.unit_code} — ${u.products?.sku ?? ""} ${u.products?.name ?? ""} (${u.actual_area ?? "?"} ${u.area_uom_id ? uomCodeById.get(u.area_uom_id) ?? "" : ""})`,
            }))}
          />

          <div className="my-8 flex gap-3">
            <PostButton id={project.id} action={cancelProjectAction} label="Cancel project" pendingLabel="Cancelling…" />
          </div>

          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Complete project</h2>
          <CompleteProjectForm projectId={project.id} />
        </>
      )}

      {project.status === "completed" && !project.invoice_id && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Generate invoice</h2>
          <GenerateInvoiceForm
            projectId={project.id}
            materials={(materials ?? []).map((m) => ({
              inventoryUnitId: m.inventory_unit_id,
              label: `${m.inventory_units?.unit_code} — ${m.inventory_units?.products?.sku ?? ""}`,
            }))}
          />
        </>
      )}

      {project.invoice_id && (
        <p className="mt-8 text-sm text-zinc-500">
          Invoiced — see <Link href={`/sales/invoices/${project.invoice_id}`} className="underline">the invoice</Link>.
        </p>
      )}
    </div>
  );
}
