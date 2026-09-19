"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "project", "create");

  const projectNumber = String(formData.get("projectNumber") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();

  if (!projectNumber || !customerId || !branchId) {
    return { error: "Project number, customer and branch are required" };
  }

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      customer_id: customerId,
      warehouse_id: warehouseId,
      project_number: projectNumber,
      description: description || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !project) return { error: error?.message ?? "Failed to create project" };

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function addProjectMaterialAction(
  projectId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireActiveTenant();
  const inventoryUnitId = String(formData.get("inventoryUnitId") ?? "");
  if (!inventoryUnitId) return { error: "Select a slab or remnant to add" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_project_material", {
    p_project_id: projectId,
    p_inventory_unit_id: inventoryUnitId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function removeProjectMaterialAction(
  projectId: string,
  inventoryUnitId: string
): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_project_material", {
    p_project_id: projectId,
    p_inventory_unit_id: inventoryUnitId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function completeProjectAction(
  projectId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "project", "edit");

  const laborCost = Number(formData.get("laborCost") ?? "");
  const overheadCost = formData.get("overheadCost") ? Number(formData.get("overheadCost")) : 0;
  if (!Number.isFinite(laborCost) || laborCost < 0) {
    return { error: "Labor cost is required and must be zero or greater" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_project", {
    p_project_id: projectId,
    p_labor_cost: laborCost,
    p_overhead_cost: overheadCost,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function cancelProjectAction(projectId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_project", { p_project_id: projectId });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

function parseMaterialPrices(formData: FormData) {
  const prices: { inventoryUnitId: string; unitPrice: string }[] = [];
  let i = 0;
  while (formData.has(`prices[${i}][inventoryUnitId]`)) {
    prices.push({
      inventoryUnitId: String(formData.get(`prices[${i}][inventoryUnitId]`) ?? ""),
      unitPrice: String(formData.get(`prices[${i}][unitPrice]`) ?? ""),
    });
    i += 1;
  }
  return prices.filter((p) => p.inventoryUnitId);
}

export async function generateProjectInvoiceAction(
  projectId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "project", "edit");
  await requirePermission(tenant.tenantId, "sales", "create");

  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  if (!invoiceNumber) return { error: "Invoice number is required" };

  const prices = parseMaterialPrices(formData);
  if (prices.some((p) => !p.unitPrice)) {
    return { error: "A unit price is required for every material" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_project_invoice", {
    p_project_id: projectId,
    p_invoice_number: invoiceNumber,
    p_material_prices: prices.map((p) => ({
      inventory_unit_id: p.inventoryUnitId,
      unit_price: Number(p.unitPrice),
    })),
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/sales/invoices");
  return { success: true };
}
