"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

export async function createProcessingJobAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "production", "create");

  const jobNumber = String(formData.get("jobNumber") ?? "").trim();
  const inputUnitId = String(formData.get("inputUnitId") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const stage = String(formData.get("stage") ?? "cutting");
  const machine = String(formData.get("machine") ?? "").trim();
  const operatorId = String(formData.get("operatorId") ?? "") || null;
  const expectedSlabCount = formData.get("expectedSlabCount") ? Number(formData.get("expectedSlabCount")) : null;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!jobNumber || !inputUnitId || !branchId || !warehouseId) {
    return { error: "Job number, input block, branch and warehouse are required" };
  }

  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("processing_jobs")
    .insert({
      tenant_id: tenant.tenantId,
      job_number: jobNumber,
      input_unit_id: inputUnitId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      stage: stage as "cutting" | "squaring" | "polishing" | "other",
      machine: machine || null,
      operator_id: operatorId,
      expected_slab_count: expectedSlabCount,
      notes: notes || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !job) return { error: error?.message ?? "Failed to create processing job" };

  revalidatePath("/factory/jobs");
  redirect(`/factory/jobs/${job.id}`);
}

export async function startProcessingJobAction(processingJobId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_processing_job", { p_processing_job_id: processingJobId });
  if (error) return { error: error.message };
  revalidatePath(`/factory/jobs/${processingJobId}`);
  return { success: true };
}

export async function cancelProcessingJobAction(processingJobId: string): Promise<ActionResult> {
  await requireActiveTenant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_processing_job", { p_processing_job_id: processingJobId });
  if (error) return { error: error.message };
  revalidatePath(`/factory/jobs/${processingJobId}`);
  return { success: true };
}

type OutputLineInput = {
  unitType: string;
  length: string;
  width: string;
  thickness: string;
  dimensionUomId: string;
  areaUomId: string;
  qualityGrade: string;
  usableArea: string;
};

// Presence-checked on `length` -- every real output row has one, so this
// never hits the "gap in the middle" trap the return-line editors ran into
// (see actions/sales.ts's parseReturnLines comment): there's no optional
// "selected" toggle here to gate identifying fields behind.
function parseOutputLines(formData: FormData): OutputLineInput[] {
  const lines: OutputLineInput[] = [];
  let i = 0;
  while (formData.has(`lines[${i}][length]`)) {
    lines.push({
      unitType: String(formData.get(`lines[${i}][unitType]`) ?? "slab"),
      length: String(formData.get(`lines[${i}][length]`) ?? ""),
      width: String(formData.get(`lines[${i}][width]`) ?? ""),
      thickness: String(formData.get(`lines[${i}][thickness]`) ?? ""),
      dimensionUomId: String(formData.get(`lines[${i}][dimensionUomId]`) ?? ""),
      areaUomId: String(formData.get(`lines[${i}][areaUomId]`) ?? ""),
      qualityGrade: String(formData.get(`lines[${i}][qualityGrade]`) ?? ""),
      usableArea: String(formData.get(`lines[${i}][usableArea]`) ?? ""),
    });
    i += 1;
  }
  return lines.filter((l) => l.length && l.width && l.thickness && l.dimensionUomId && l.areaUomId);
}

// The output line list may legitimately be empty -- a block that turned out
// fully unusable (e.g. an internal crack found once opened) is completed as
// 100% waste, not blocked by an artificial "at least one output" rule; the
// RPC itself enforces that (never an invented client-side minimum).
export async function completeProcessingJobAction(
  processingJobId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "production", "edit");

  const lines = parseOutputLines(formData);
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_processing_job", {
    p_processing_job_id: processingJobId,
    p_slabs: lines.map((l) => ({
      unit_type: l.unitType,
      length: Number(l.length),
      width: Number(l.width),
      thickness: Number(l.thickness),
      dimension_uom_id: l.dimensionUomId,
      area_uom_id: l.areaUomId,
      quality_grade: l.qualityGrade || null,
      usable_area: l.usableArea ? Number(l.usableArea) : null,
    })),
  });
  if (error) return { error: error.message };

  revalidatePath(`/factory/jobs/${processingJobId}`);
  revalidatePath("/factory/qc");
  return { success: true };
}

export async function recordProcessingCostsAction(
  processingJobId: string,
  formData: FormData
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "production", "edit");

  const processingCost = Number(formData.get("processingCost") ?? "");
  const overheadCost = formData.get("overheadCost") ? Number(formData.get("overheadCost")) : 0;
  if (!Number.isFinite(processingCost) || processingCost < 0) {
    return { error: "Processing cost is required and must be zero or greater" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_processing_costs", {
    p_processing_job_id: processingJobId,
    p_processing_cost: processingCost,
    p_overhead_cost: overheadCost,
  });
  if (error) return { error: error.message };

  revalidatePath(`/factory/jobs/${processingJobId}`);
  return { success: true };
}

export async function recordQcInspectionAction(
  inventoryUnitId: string,
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
  const { error } = await supabase.rpc("record_qc_inspection", {
    p_inventory_unit_id: inventoryUnitId,
    p_outcome: outcome,
    p_confirmed_grade: confirmedGrade || undefined,
    p_defects: defects || undefined,
    p_notes: notes || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/factory/qc");
  revalidatePath(`/factory/qc/${inventoryUnitId}`);
  return { success: true };
}
