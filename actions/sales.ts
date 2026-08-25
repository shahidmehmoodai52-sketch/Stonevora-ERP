"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

export async function createCustomerAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "create");

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) return { error: "Code and name are required" };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    tenant_id: tenant.tenantId,
    code,
    name,
    customer_type: String(formData.get("customerType") ?? "retail") as
      | "retail"
      | "dealer"
      | "contractor"
      | "project"
      | "corporate"
      | "international",
    phone: String(formData.get("phone") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    price_list_id: String(formData.get("priceListId") ?? "") || null,
    credit_limit: formData.get("creditLimit") ? Number(formData.get("creditLimit")) : null,
  });
  if (error) return { error: error.message };

  revalidatePath("/sales/customers");
  return { success: true };
}

export async function createPriceListAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "create");

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) return { error: "Code and name are required" };

  const supabase = await createClient();
  const { error } = await supabase.from("price_lists").insert({
    tenant_id: tenant.tenantId,
    code,
    name,
    currency_id: String(formData.get("currencyId") ?? "") || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/sales/price-lists");
  return { success: true };
}

export async function createPriceListItemAction(
  priceListId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "create");

  const productId = String(formData.get("productId") ?? "");
  const price = Number(formData.get("price") ?? 0);
  if (!productId || !price) return { error: "Product and price are required" };

  const supabase = await createClient();
  const { error } = await supabase.from("price_list_items").insert({
    tenant_id: tenant.tenantId,
    price_list_id: priceListId,
    product_id: productId,
    price,
  });
  if (error) return { error: error.message };

  revalidatePath(`/sales/price-lists/${priceListId}`);
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

export async function createSalesOrderAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "create");

  const soNumber = String(formData.get("soNumber") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "") || null;
  const priceListId = String(formData.get("priceListId") ?? "") || null;
  const lines = parseLines(formData);

  if (!soNumber || !customerId || !branchId) {
    return { error: "SO number, customer and branch are required" };
  }
  if (lines.length === 0) return { error: "At least one line item is required" };

  const supabase = await createClient();
  const { data: so, error } = await supabase
    .from("sales_orders")
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      customer_id: customerId,
      warehouse_id: warehouseId,
      price_list_id: priceListId,
      so_number: soNumber,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !so) return { error: error?.message ?? "Failed to create sales order" };

  const { error: linesError } = await supabase.from("sales_order_lines").insert(
    lines.map((l) => ({
      tenant_id: tenant.tenantId,
      sales_order_id: so.id,
      product_id: l.productId,
      quantity: Number(l.quantity),
      uom_id: l.uomId,
      unit_price: Number(l.unitPrice || 0),
    }))
  );
  if (linesError) return { error: linesError.message };

  revalidatePath("/sales/orders");
  redirect(`/sales/orders/${so.id}`);
}

export async function confirmSalesOrderAction(salesOrderId: string): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "edit");

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_sales_order", {
    p_sales_order_id: salesOrderId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/sales/orders/${salesOrderId}`);
  return { success: true };
}

export async function createDeliveryAction(
  salesOrderId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "create");

  const deliveryNumber = String(formData.get("deliveryNumber") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  if (!deliveryNumber || !branchId || !warehouseId) {
    return { error: "Delivery number, branch and warehouse are required" };
  }

  const lineIds = formData.getAll("lineId").map(String);
  const quantities = formData.getAll("lineQuantity").map(String);
  const productIds = formData.getAll("lineProductId").map(String);
  if (lineIds.length === 0) return { error: "Select at least one line to deliver" };

  const supabase = await createClient();
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      sales_order_id: salesOrderId,
      delivery_number: deliveryNumber,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !delivery) return { error: error?.message ?? "Failed to create delivery" };

  const rows = lineIds
    .map((id, i) => ({
      tenant_id: tenant.tenantId,
      delivery_id: delivery.id,
      sales_order_line_id: id,
      product_id: productIds[i],
      quantity: Number(quantities[i]),
    }))
    .filter((r) => r.quantity > 0);

  if (rows.length === 0) return { error: "Enter a quantity for at least one line" };

  const { error: linesError } = await supabase.from("delivery_lines").insert(rows);
  if (linesError) return { error: linesError.message };

  const { error: dispatchError } = await supabase.rpc("dispatch_delivery", {
    p_delivery_id: delivery.id,
  });
  if (dispatchError) return { error: dispatchError.message };

  revalidatePath(`/sales/orders/${salesOrderId}`);
  return { success: true };
}

export async function generateInvoiceAction(
  deliveryId: string,
  salesOrderId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "create");

  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  if (!invoiceNumber) return { error: "Invoice number is required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_sales_invoice_from_delivery", {
    p_delivery_id: deliveryId,
    p_invoice_number: invoiceNumber,
  });
  if (error) return { error: error.message };

  revalidatePath(`/sales/orders/${salesOrderId}`);
  revalidatePath("/sales/invoices");
  return { success: true };
}
