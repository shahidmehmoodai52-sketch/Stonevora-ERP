"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

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

export async function createReservationAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "create");

  const reservationNumber = String(formData.get("reservationNumber") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const lines = parseLines(formData);

  if (!reservationNumber || !customerId || !branchId || !warehouseId) {
    return { error: "Reservation number, customer, branch and warehouse are required" };
  }
  if (lines.length === 0) return { error: "At least one line item is required" };

  const supabase = await createClient();
  const { data: reservation, error } = await supabase
    .from("stock_reservations")
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      customer_id: customerId,
      reservation_number: reservationNumber,
      notes: notes || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !reservation) return { error: error?.message ?? "Failed to create reservation" };

  const { error: linesError } = await supabase.from("stock_reservation_lines").insert(
    lines.map((l) => ({
      tenant_id: tenant.tenantId,
      stock_reservation_id: reservation.id,
      product_id: l.productId,
      quantity: Number(l.quantity),
      uom_id: l.uomId,
      unit_price: Number(l.unitPrice || 0),
    }))
  );
  if (linesError) return { error: linesError.message };

  revalidatePath("/reservations");
  redirect(`/reservations/${reservation.id}`);
}

export async function activateStockReservationAction(
  stockReservationId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireActiveTenant();
  const holdHours = Number(formData.get("holdHours") ?? "");
  if (!Number.isFinite(holdHours) || holdHours <= 0) {
    return { error: "Hold hours must be greater than zero" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_stock_reservation", {
    p_stock_reservation_id: stockReservationId,
    p_hold_hours: holdHours,
  });
  if (error) return { error: error.message };

  revalidatePath(`/reservations/${stockReservationId}`);
  return { success: true };
}

export async function releaseStockReservationAction(stockReservationId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_stock_reservation", {
    p_stock_reservation_id: stockReservationId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/reservations/${stockReservationId}`);
  return { success: true };
}

export async function convertReservationToSalesOrderAction(
  stockReservationId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "sales", "edit");

  const soNumber = String(formData.get("soNumber") ?? "").trim();
  if (!soNumber) return { error: "SO number is required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("convert_reservation_to_sales_order", {
    p_stock_reservation_id: stockReservationId,
    p_so_number: soNumber,
  });
  if (error) return { error: error.message };

  revalidatePath(`/reservations/${stockReservationId}`);
  revalidatePath("/sales/orders");
  return { success: true };
}
