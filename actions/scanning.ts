"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

// generate_product_barcode/generate_inventory_unit_qr_code are idempotent --
// calling again on an already-coded row is a no-op that returns the existing
// value -- so these actions don't need to guard against double-clicking.
export async function generateProductBarcodeAction(productId: string): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "product", "edit");

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_product_barcode", { p_product_id: productId });
  if (error) return { error: error.message };

  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function generateInventoryUnitQrCodeAction(inventoryUnitId: string): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "product", "edit");

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_inventory_unit_qr_code", {
    p_inventory_unit_id: inventoryUnitId,
  });
  if (error) return { error: error.message };

  revalidatePath("/factory/blocks");
  return { success: true };
}

export type ScannedMatch = { match_type: string; id: string; label: string; secondary: string | null };

// A plain lookup, not a mutation -- resolve_scanned_code is SECURITY INVOKER
// and read-only, so this returns the matches directly rather than the usual
// {error}|{success} shape, for a manual "type the code" convenience screen.
// Camera-based scanning is a separate, later pass (see PHASES.md).
export async function resolveScannedCodeAction(
  formData: FormData
): Promise<{ error: string } | { matches: ScannedMatch[] }> {
  const tenant = await requireActiveTenant();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter a code to look up" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_scanned_code", {
    p_tenant_id: tenant.tenantId,
    p_code: code,
  });
  if (error) return { error: error.message };
  return { matches: data ?? [] };
}
