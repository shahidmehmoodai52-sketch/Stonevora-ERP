"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

type StocktakeLineInput = { productId: string; locationId: string; batchId: string; uomId: string };

function parseStocktakeLines(formData: FormData): StocktakeLineInput[] {
  const lines: StocktakeLineInput[] = [];
  let i = 0;
  while (formData.has(`lines[${i}][productId]`)) {
    lines.push({
      productId: String(formData.get(`lines[${i}][productId]`) ?? ""),
      locationId: String(formData.get(`lines[${i}][locationId]`) ?? ""),
      batchId: String(formData.get(`lines[${i}][batchId]`) ?? ""),
      uomId: String(formData.get(`lines[${i}][uomId]`) ?? ""),
    });
    i += 1;
  }
  return lines.filter((l) => l.productId && l.uomId);
}

// Created as a draft, mirroring stock_adjustments' own create-then-act
// lifecycle -- a count is planned (which products/locations to count) before
// start_stocktake_count snapshots system_quantity and moves it to 'counting'.
export async function createStocktakeAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "warehouse", "create");

  const stocktakeNumber = String(formData.get("stocktakeNumber") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const lines = parseStocktakeLines(formData);

  if (!stocktakeNumber || !branchId || !warehouseId) {
    return { error: "Stocktake number, branch and warehouse are required" };
  }
  if (lines.length === 0) return { error: "At least one line item is required" };

  const supabase = await createClient();
  const { data: stocktake, error } = await supabase
    .from("stocktakes")
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      stocktake_number: stocktakeNumber,
      notes: notes || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !stocktake) return { error: error?.message ?? "Failed to create stocktake" };

  const { error: linesError } = await supabase.from("stocktake_lines").insert(
    lines.map((l) => ({
      tenant_id: tenant.tenantId,
      stocktake_id: stocktake.id,
      product_id: l.productId,
      location_id: l.locationId || null,
      batch_id: l.batchId || null,
      uom_id: l.uomId,
    }))
  );
  if (linesError) return { error: linesError.message };

  revalidatePath("/inventory/stocktakes");
  redirect(`/inventory/stocktakes/${stocktake.id}`);
}

export async function startStocktakeCountAction(stocktakeId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_stocktake_count", { p_stocktake_id: stocktakeId });
  if (error) return { error: error.message };
  revalidatePath(`/inventory/stocktakes/${stocktakeId}`);
  return { success: true };
}

export async function recordStocktakeCountAction(
  stocktakeLineId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireActiveTenant();
  const countedQuantity = String(formData.get("countedQuantity") ?? "");
  if (!countedQuantity) return { error: "Counted quantity is required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stocktake_count", {
    p_stocktake_line_id: stocktakeLineId,
    p_counted_quantity: Number(countedQuantity),
  });
  if (error) return { error: error.message };

  const { data: line } = await supabase
    .from("stocktake_lines")
    .select("stocktake_id")
    .eq("id", stocktakeLineId)
    .single();
  if (line) revalidatePath(`/inventory/stocktakes/${line.stocktake_id}`);
  return { success: true };
}

export async function postStocktakeAction(stocktakeId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_stocktake", { p_stocktake_id: stocktakeId });
  if (error) return { error: error.message };
  revalidatePath(`/inventory/stocktakes/${stocktakeId}`);
  return { success: true };
}

export async function cancelStocktakeAction(stocktakeId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_stocktake", { p_stocktake_id: stocktakeId });
  if (error) return { error: error.message };
  revalidatePath(`/inventory/stocktakes/${stocktakeId}`);
  return { success: true };
}
