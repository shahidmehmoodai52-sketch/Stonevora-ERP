import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";
import { uploadEntityPhotoAction, deleteEntityPhotoAction } from "@/actions/photos";
import { PhotoGallery } from "@/components/PhotoGallery";

export default async function BlockDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: block }, { data: uoms }, permissionSet] = await Promise.all([
    supabase
      .from("inventory_units")
      .select(
        "id, unit_code, unit_type, status, actual_length, actual_width, actual_thickness, dimension_uom_id, volume, volume_uom_id, cost, quarry_source, quality_grade, products(sku, name)"
      )
      .eq("id", id)
      .single(),
    supabase.from("uom").select("id, code"),
    fetchPermissionSet(tenant.tenantId),
  ]);

  if (!block || block.unit_type !== "block") notFound();

  const uomCodeById = new Map((uoms ?? []).map((u) => [u.id, u.code]));

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
  const revalidatePathValue = `/factory/blocks/${id}`;

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{block.unit_code}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {block.products?.sku} — {block.products?.name} · <span className="font-medium">{block.status}</span>
      </p>

      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-zinc-500">Dimensions</dt>
          <dd>
            {block.actual_length} × {block.actual_width} × {block.actual_thickness}{" "}
            {block.dimension_uom_id ? uomCodeById.get(block.dimension_uom_id) : ""}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Volume</dt>
          <dd>
            {block.volume} {block.volume_uom_id ? uomCodeById.get(block.volume_uom_id) : ""}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Quarry source</dt>
          <dd>{block.quarry_source ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Grade</dt>
          <dd>{block.quality_grade ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Cost</dt>
          <dd>{block.cost ?? "—"}</dd>
        </div>
      </dl>

      <PhotoGallery
        photos={photos}
        uploadAction={uploadEntityPhotoAction.bind(null, "inventory_unit", id, revalidatePathValue)}
        deleteAction={deleteEntityPhotoAction.bind(null, revalidatePathValue)}
        canEdit={canEdit}
      />
    </div>
  );
}
