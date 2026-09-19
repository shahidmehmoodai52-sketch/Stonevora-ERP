"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

type BomLineInput = { rawMaterialProductId: string; quantity: string; uomId: string };

function parseBomLines(formData: FormData): BomLineInput[] {
  const lines: BomLineInput[] = [];
  let i = 0;
  while (formData.has(`lines[${i}][rawMaterialProductId]`)) {
    lines.push({
      rawMaterialProductId: String(formData.get(`lines[${i}][rawMaterialProductId]`) ?? ""),
      quantity: String(formData.get(`lines[${i}][quantity]`) ?? ""),
      uomId: String(formData.get(`lines[${i}][uomId]`) ?? ""),
    });
    i += 1;
  }
  return lines.filter((l) => l.rawMaterialProductId && l.quantity && l.uomId);
}

export async function createBomAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "product", "create");

  const bomNumber = String(formData.get("bomNumber") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const productId = String(formData.get("productId") ?? "");
  const outputQuantity = Number(formData.get("outputQuantity") ?? "");
  const outputUomId = String(formData.get("outputUomId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const lines = parseBomLines(formData);

  if (!bomNumber || !productId || !outputUomId || !Number.isFinite(outputQuantity) || outputQuantity <= 0) {
    return { error: "BOM number, finished product, output quantity and output UOM are required" };
  }
  if (lines.length === 0) return { error: "At least one raw material line is required" };

  const supabase = await createClient();
  const { data: bom, error } = await supabase
    .from("bill_of_materials")
    .insert({
      tenant_id: tenant.tenantId,
      bom_number: bomNumber,
      name: name || null,
      product_id: productId,
      output_quantity: outputQuantity,
      output_uom_id: outputUomId,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (error || !bom) return { error: error?.message ?? "Failed to create bill of materials" };

  const { error: linesError } = await supabase.from("bill_of_materials_lines").insert(
    lines.map((l) => ({
      tenant_id: tenant.tenantId,
      bom_id: bom.id,
      raw_material_product_id: l.rawMaterialProductId,
      quantity: Number(l.quantity),
      uom_id: l.uomId,
    }))
  );
  if (linesError) return { error: linesError.message };

  revalidatePath("/manufacturing/boms");
  redirect(`/manufacturing/boms/${bom.id}`);
}

export async function createProductionBatchAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "production", "create");

  const batchNumber = String(formData.get("batchNumber") ?? "").trim();
  const bomId = String(formData.get("bomId") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const kilnNumber = String(formData.get("kilnNumber") ?? "").trim();
  const plannedOutputQuantity = Number(formData.get("plannedOutputQuantity") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!batchNumber || !bomId || !branchId || !warehouseId || !Number.isFinite(plannedOutputQuantity) || plannedOutputQuantity <= 0) {
    return { error: "Batch number, BOM, branch, warehouse and a positive planned output quantity are required" };
  }

  const supabase = await createClient();
  const { data: pbatch, error } = await supabase
    .from("production_batches")
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      bom_id: bomId,
      batch_number: batchNumber,
      kiln_number: kilnNumber || null,
      planned_output_quantity: plannedOutputQuantity,
      notes: notes || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !pbatch) return { error: error?.message ?? "Failed to create production batch" };

  revalidatePath("/manufacturing/batches");
  redirect(`/manufacturing/batches/${pbatch.id}`);
}

export async function startProductionBatchAction(productionBatchId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_production_batch", { p_production_batch_id: productionBatchId });
  if (error) return { error: error.message };
  revalidatePath(`/manufacturing/batches/${productionBatchId}`);
  return { success: true };
}

export async function cancelProductionBatchAction(productionBatchId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_production_batch", { p_production_batch_id: productionBatchId });
  if (error) return { error: error.message };
  revalidatePath(`/manufacturing/batches/${productionBatchId}`);
  return { success: true };
}

export async function completeProductionBatchAction(
  productionBatchId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "production", "edit");

  const actualOutputQuantity = Number(formData.get("actualOutputQuantity") ?? "");
  const outputLocationId = String(formData.get("outputLocationId") ?? "");
  const shadeCode = String(formData.get("shadeCode") ?? "").trim();
  const caliberCode = String(formData.get("caliberCode") ?? "").trim();
  const laborCost = formData.get("laborCost") ? Number(formData.get("laborCost")) : 0;
  const overheadCost = formData.get("overheadCost") ? Number(formData.get("overheadCost")) : 0;

  if (!Number.isFinite(actualOutputQuantity) || actualOutputQuantity <= 0 || !outputLocationId) {
    return { error: "Actual output quantity (greater than zero) and an output location are required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_production_batch", {
    p_production_batch_id: productionBatchId,
    p_actual_output_quantity: actualOutputQuantity,
    p_output_location_id: outputLocationId,
    p_shade_code: shadeCode || undefined,
    p_caliber_code: caliberCode || undefined,
    p_labor_cost: laborCost,
    p_overhead_cost: overheadCost,
  });
  if (error) return { error: error.message };

  revalidatePath(`/manufacturing/batches/${productionBatchId}`);
  revalidatePath("/manufacturing/qc");
  return { success: true };
}

export async function recordBatchQcInspectionAction(
  inventoryBatchId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "production", "approve");

  const outcome = String(formData.get("outcome") ?? "");
  if (outcome !== "passed" && outcome !== "rejected") {
    return { error: "Outcome must be passed or rejected" };
  }
  const confirmedGrade = String(formData.get("confirmedGrade") ?? "").trim();
  const defects = String(formData.get("defects") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_batch_qc_inspection", {
    p_inventory_batch_id: inventoryBatchId,
    p_outcome: outcome,
    p_confirmed_grade: confirmedGrade || undefined,
    p_defects: defects || undefined,
    p_notes: notes || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/manufacturing/qc");
  revalidatePath(`/manufacturing/qc/${inventoryBatchId}`);
  return { success: true };
}
