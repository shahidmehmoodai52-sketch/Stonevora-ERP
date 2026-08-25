"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

export async function recordCustomerPaymentAction(
  customerId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "create");

  const amount = Number(formData.get("amount") ?? 0);
  const branchId = String(formData.get("branchId") ?? "");
  const salesInvoiceId = String(formData.get("salesInvoiceId") ?? "") || null;
  if (!amount || !branchId) return { error: "Amount and branch are required" };

  const supabase = await createClient();
  const { error } = await supabase.from("customer_payments").insert({
    tenant_id: tenant.tenantId,
    branch_id: branchId,
    customer_id: customerId,
    sales_invoice_id: salesInvoiceId,
    amount,
    method: String(formData.get("method") ?? "") || null,
    reference: String(formData.get("reference") ?? "") || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/sales/customers/${customerId}`);
  if (salesInvoiceId) revalidatePath(`/sales/invoices/${salesInvoiceId}`);
  return { success: true };
}

export async function recordSupplierPaymentAction(
  supplierId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "purchasing", "create");

  const amount = Number(formData.get("amount") ?? 0);
  const branchId = String(formData.get("branchId") ?? "");
  const purchaseInvoiceId = String(formData.get("purchaseInvoiceId") ?? "") || null;
  if (!amount || !branchId) return { error: "Amount and branch are required" };

  const supabase = await createClient();
  const { error } = await supabase.from("supplier_payments").insert({
    tenant_id: tenant.tenantId,
    branch_id: branchId,
    supplier_id: supplierId,
    purchase_invoice_id: purchaseInvoiceId,
    amount,
    method: String(formData.get("method") ?? "") || null,
    reference: String(formData.get("reference") ?? "") || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/purchasing/suppliers/${supplierId}`);
  return { success: true };
}
