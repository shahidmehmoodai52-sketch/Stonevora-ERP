"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

function parseAdjustmentLines(formData: FormData) {
  const lines: {
    productId: string;
    direction: string;
    quantity: string;
    uomId: string;
    unitCost: string;
    locationId: string;
    batchId: string;
  }[] = [];
  let i = 0;
  while (formData.has(`lines[${i}][productId]`)) {
    lines.push({
      productId: String(formData.get(`lines[${i}][productId]`) ?? ""),
      direction: String(formData.get(`lines[${i}][direction]`) ?? "increase"),
      quantity: String(formData.get(`lines[${i}][quantity]`) ?? ""),
      uomId: String(formData.get(`lines[${i}][uomId]`) ?? ""),
      unitCost: String(formData.get(`lines[${i}][unitCost]`) ?? ""),
      locationId: String(formData.get(`lines[${i}][locationId]`) ?? ""),
      batchId: String(formData.get(`lines[${i}][batchId]`) ?? ""),
    });
    i += 1;
  }
  // Number(l.quantity) > 0, not the bare string -- "0" is a truthy string,
  // and stock_adjustment_lines.quantity_change has a check (<> 0) constraint,
  // so a zero-quantity line must never reach the insert at all.
  return lines.filter((l) => l.productId && Number(l.quantity) > 0);
}

// Created as a draft, exactly like sales_orders/purchase_orders -- an
// adjustment changes real stock and its own schema models a draft status,
// so (unlike the GRN receive-and-post-in-one-step flow, where "receiving"
// already implies the goods physically arrived) this stays a two-step
// create-then-post flow: a supervisor can review before the stock change
// becomes irreversible.
export async function createStockAdjustmentAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "warehouse", "create");

  const adjustmentNumber = String(formData.get("adjustmentNumber") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const reasonCode = String(formData.get("reasonCode") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const lines = parseAdjustmentLines(formData);

  if (!adjustmentNumber || !branchId || !warehouseId || !reasonCode) {
    return { error: "Adjustment number, branch, warehouse and reason are required" };
  }
  if (lines.length === 0) return { error: "At least one line item is required" };

  const supabase = await createClient();
  const { data: adjustment, error } = await supabase
    .from("stock_adjustments")
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      adjustment_number: adjustmentNumber,
      reason_code: reasonCode as
        | "damage"
        | "shrinkage"
        | "theft"
        | "found"
        | "count_correction"
        | "other",
      notes: notes || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !adjustment) return { error: error?.message ?? "Failed to create stock adjustment" };

  const { error: linesError } = await supabase.from("stock_adjustment_lines").insert(
    lines.map((l) => ({
      tenant_id: tenant.tenantId,
      stock_adjustment_id: adjustment.id,
      product_id: l.productId,
      quantity_change: l.direction === "decrease" ? -Math.abs(Number(l.quantity)) : Math.abs(Number(l.quantity)),
      uom_id: l.uomId,
      unit_cost: l.unitCost ? Number(l.unitCost) : null,
      location_id: l.locationId || null,
      batch_id: l.batchId || null,
    }))
  );
  if (linesError) return { error: linesError.message };

  revalidatePath("/inventory/adjustments");
  redirect(`/inventory/adjustments/${adjustment.id}`);
}

export async function postStockAdjustmentAction(stockAdjustmentId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_stock_adjustment", { p_stock_adjustment_id: stockAdjustmentId });
  if (error) return { error: error.message };
  revalidatePath(`/inventory/adjustments/${stockAdjustmentId}`);
  return { success: true };
}
