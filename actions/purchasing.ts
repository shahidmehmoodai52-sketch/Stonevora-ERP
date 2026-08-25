"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

export async function createSupplierAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "purchasing", "create");

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) return { error: "Code and name are required" };

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({
    tenant_id: tenant.tenantId,
    code,
    name,
    contact_name: String(formData.get("contactName") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    payment_terms_days: Number(formData.get("paymentTermsDays") ?? 0),
  });
  if (error) return { error: error.message };

  revalidatePath("/purchasing/suppliers");
  return { success: true };
}

type LineInput = { productId: string; quantity: string; uomId: string; unitPrice: string };

function parseLines(formData: FormData): LineInput[] {
  const lines: LineInput[] = [];
  let i = 0;
  while (formData.has(`lines[${i}][productId]`)) {
    lines.push({
      productId: String(formData.get(`lines[${i}][productId]`) ?? ""),
      quantity: String(formData.get(`lines[${i}][quantity]`) ?? ""),
      uomId: String(formData.get(`lines[${i}][uomId]`) ?? ""),
      unitPrice: String(formData.get(`lines[${i}][unitPrice]`) ?? ""),
    });
    i += 1;
  }
  return lines.filter((l) => l.productId && l.quantity && l.uomId);
}

export async function createPurchaseOrderAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "purchasing", "create");

  const poNumber = String(formData.get("poNumber") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const currencyId = String(formData.get("currencyId") ?? "") || null;
  const lines = parseLines(formData);

  if (!poNumber || !supplierId || !branchId) {
    return { error: "PO number, supplier and branch are required" };
  }
  if (lines.length === 0) return { error: "At least one line item is required" };

  const supabase = await createClient();
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      supplier_id: supplierId,
      po_number: poNumber,
      currency_id: currencyId,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (error || !po) return { error: error?.message ?? "Failed to create purchase order" };

  const { error: linesError } = await supabase.from("purchase_order_lines").insert(
    lines.map((l) => ({
      tenant_id: tenant.tenantId,
      purchase_order_id: po.id,
      product_id: l.productId,
      quantity: Number(l.quantity),
      uom_id: l.uomId,
      unit_price: Number(l.unitPrice || 0),
    }))
  );
  if (linesError) return { error: linesError.message };

  revalidatePath("/purchasing/orders");
  redirect(`/purchasing/orders/${po.id}`);
}

type GrnLineInput = {
  purchaseOrderLineId: string;
  productId: string;
  quantity: string;
  uomId: string;
  unitCost: string;
  locationId: string;
  batchNumber: string;
  lotNumber: string;
  shadeCode: string;
  caliberCode: string;
};

function parseGrnLines(formData: FormData): GrnLineInput[] {
  const lines: GrnLineInput[] = [];
  let i = 0;
  while (formData.has(`lines[${i}][purchaseOrderLineId]`)) {
    lines.push({
      purchaseOrderLineId: String(formData.get(`lines[${i}][purchaseOrderLineId]`) ?? ""),
      productId: String(formData.get(`lines[${i}][productId]`) ?? ""),
      quantity: String(formData.get(`lines[${i}][quantity]`) ?? ""),
      uomId: String(formData.get(`lines[${i}][uomId]`) ?? ""),
      unitCost: String(formData.get(`lines[${i}][unitCost]`) ?? ""),
      locationId: String(formData.get(`lines[${i}][locationId]`) ?? ""),
      batchNumber: String(formData.get(`lines[${i}][batchNumber]`) ?? ""),
      lotNumber: String(formData.get(`lines[${i}][lotNumber]`) ?? ""),
      shadeCode: String(formData.get(`lines[${i}][shadeCode]`) ?? ""),
      caliberCode: String(formData.get(`lines[${i}][caliberCode]`) ?? ""),
    });
    i += 1;
  }
  return lines.filter((l) => l.productId && l.quantity);
}

export async function createGoodsReceiptAction(
  purchaseOrderId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "purchasing", "create");

  const grnNumber = String(formData.get("grnNumber") ?? "").trim();
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const landedCostBasis = String(formData.get("landedCostBasis") ?? "value");
  const freightCost = Number(formData.get("freightCost") ?? 0);
  const dutyCost = Number(formData.get("dutyCost") ?? 0);
  const handlingCost = Number(formData.get("handlingCost") ?? 0);
  const otherCost = Number(formData.get("otherCost") ?? 0);
  const lines = parseGrnLines(formData);

  if (!grnNumber || !warehouseId || !branchId) {
    return { error: "GRN number, warehouse and branch are required" };
  }
  if (lines.length === 0) return { error: "At least one line item is required" };

  const supabase = await createClient();
  const { data: grn, error } = await supabase
    .from("goods_receipts")
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      purchase_order_id: purchaseOrderId,
      grn_number: grnNumber,
      freight_cost: freightCost,
      duty_cost: dutyCost,
      handling_cost: handlingCost,
      other_cost: otherCost,
      landed_cost_basis: landedCostBasis as "value" | "quantity",
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !grn) return { error: error?.message ?? "Failed to create goods receipt" };

  const { error: linesError } = await supabase.from("goods_receipt_lines").insert(
    lines.map((l) => ({
      tenant_id: tenant.tenantId,
      goods_receipt_id: grn.id,
      purchase_order_line_id: l.purchaseOrderLineId,
      product_id: l.productId,
      quantity: Number(l.quantity),
      uom_id: l.uomId,
      unit_cost: Number(l.unitCost || 0),
      location_id: l.locationId || null,
      batch_number: l.batchNumber || null,
      lot_number: l.lotNumber || null,
      shade_code: l.shadeCode || null,
      caliber_code: l.caliberCode || null,
    }))
  );
  if (linesError) return { error: linesError.message };

  const { error: postError } = await supabase.rpc("post_goods_receipt", {
    p_goods_receipt_id: grn.id,
  });
  if (postError) return { error: postError.message };

  revalidatePath(`/purchasing/orders/${purchaseOrderId}`);
  return { success: true };
}
