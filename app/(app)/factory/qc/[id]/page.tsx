import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";
import { uploadEntityPhotoAction, deleteEntityPhotoAction } from "@/actions/photos";
import { PhotoGallery } from "@/components/PhotoGallery";
import { QcInspectionForm } from "./QcInspectionForm";

export default async function QcInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: unit }, permissionSet] = await Promise.all([
    supabase
      .from("inventory_units")
      .select("id, unit_code, unit_type, status, actual_length, actual_width, actual_thickness, actual_area, usable_area, quality_grade, products(sku, name), processing_jobs(job_number)")
      .eq("id", id)
      .single(),
    fetchPermissionSet(tenant.tenantId),
  ]);

  if (!unit) notFound();

  const { data: photoRows } = await supabase
    .from("entity_photos")
    .select("id, storage_path, caption")
    .eq("entity_type", "inventory_unit")
    .eq("entity_id", id)
    .order("created_at", { ascending: false });

  const photos = await Promise.all(
    (photoRows ?? []).map(async (p) => {
      const { data } = await supabase.storage.from("entity-photos").createSignedUrl(p.storage_path, 3600);
      return { id: p.id, url: data?.signedUrl ?? "", caption: p.caption };
    })
  );
  const canEdit = hasPermission(permissionSet, "production", "edit");
  const revalidatePathValue = `/factory/qc/${id}`;

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{unit.unit_code}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {unit.unit_type} · {unit.products?.sku} — {unit.products?.name} · Job {unit.processing_jobs?.job_number} ·{" "}
        <span className="font-medium">{unit.status}</span>
      </p>

      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-zinc-500">Dimensions</dt>
          <dd>{unit.actual_length} × {unit.actual_width} × {unit.actual_thickness}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Area / usable</dt>
          <dd>{unit.actual_area} / {unit.usable_area}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Grade at cutting</dt>
          <dd>{unit.quality_grade ?? "—"}</dd>
        </div>
      </dl>

      {["pending_qc", "needs_rework", "on_hold"].includes(unit.status) ? (
        <QcInspectionForm inventoryUnitId={unit.id} />
      ) : (
        <p className="text-sm text-zinc-500">Already inspected — current status: {unit.status}.</p>
      )}

      <div className="mt-8">
        <PhotoGallery
          photos={photos}
          uploadAction={uploadEntityPhotoAction.bind(null, "inventory_unit", id, revalidatePathValue)}
          deleteAction={deleteEntityPhotoAction.bind(null, revalidatePathValue)}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
