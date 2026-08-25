"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

function readProductFields(formData: FormData) {
  const costPriceRaw = String(formData.get("costPrice") ?? "").trim();
  const marginRaw = String(formData.get("standardMarginPct") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const purchaseUomId = String(formData.get("purchaseUomId") ?? "") || null;
  const salesUomId = String(formData.get("salesUomId") ?? "") || null;

  return {
    sku: String(formData.get("sku") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    inventory_tracking_mode: String(formData.get("inventoryTrackingMode") ?? "simple") as
      | "simple"
      | "batch"
      | "unit",
    base_uom_id: String(formData.get("baseUomId") ?? ""),
    purchase_uom_id: purchaseUomId,
    sales_uom_id: salesUomId,
    category_id: categoryId,
    cost_price: costPriceRaw ? Number(costPriceRaw) : null,
    standard_margin_pct: marginRaw ? Number(marginRaw) : null,
  };
}

export async function createProductAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "product", "create");

  const fields = readProductFields(formData);
  if (!fields.sku || !fields.name || !fields.base_uom_id) {
    return { error: "SKU, name and stock UOM are required" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("products")
    .insert({ tenant_id: tenant.tenantId, created_by: user?.id, updated_by: user?.id, ...fields })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create product" };

  revalidatePath("/products");
  redirect(`/products/${data.id}`);
}

export async function updateProductAction(
  productId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "product", "edit");

  const fields = readProductFields(formData);
  if (!fields.sku || !fields.name || !fields.base_uom_id) {
    return { error: "SKU, name and stock UOM are required" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("products")
    .update({ updated_by: user?.id, ...fields })
    .eq("id", productId);

  if (error) return { error: error.message };

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "product", "delete");

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return { error: error.message };

  revalidatePath("/products");
  redirect("/products");
}
