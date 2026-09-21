"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export type ActionResult = { error: string } | { success: true };

const ENTITY_TYPES = ["product", "inventory_unit"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 8 * 1024 * 1024;

const PERMISSION_BY_ENTITY_TYPE: Record<EntityType, [string, string]> = {
  product: ["product", "edit"],
  inventory_unit: ["production", "edit"],
};

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadEntityPhotoAction(
  entityType: string,
  entityId: string,
  revalidatePathValue: string,
  formData: FormData
): Promise<ActionResult> {
  if (!ENTITY_TYPES.includes(entityType as EntityType)) {
    return { error: "Invalid entity type" };
  }
  const type = entityType as EntityType;

  const tenant = await requireActiveTenant();
  const [resource, action] = PERMISSION_BY_ENTITY_TYPE[type];
  await requirePermission(tenant.tenantId, resource, action);

  const supabase = await createClient();

  const tableName = type === "product" ? "products" : "inventory_units";
  const { data: entity } = await supabase.from(tableName).select("id").eq("id", entityId).single();
  if (!entity) return { error: "Entity not found" };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "A photo file is required" };
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return { error: "Only JPEG, PNG, or WEBP images are allowed" };
  if (file.size > MAX_FILE_SIZE) return { error: "Photo must be 8MB or smaller" };

  const caption = String(formData.get("caption") ?? "").trim();
  const extension = EXTENSION_BY_MIME_TYPE[file.type];
  const storagePath = `${tenant.tenantId}/${type}/${entityId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("entity-photos")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("entity_photos").insert({
    tenant_id: tenant.tenantId,
    entity_type: type,
    entity_id: entityId,
    storage_path: storagePath,
    caption: caption || null,
  });
  if (insertError) {
    await supabase.storage.from("entity-photos").remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath(revalidatePathValue);
  return { success: true };
}

export async function deleteEntityPhotoAction(
  revalidatePathValue: string,
  photoId: string
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("entity_photos")
    .select("id, entity_type, storage_path")
    .eq("id", photoId)
    .single();
  if (!photo) return { error: "Photo not found" };

  const [resource, action] = PERMISSION_BY_ENTITY_TYPE[photo.entity_type as EntityType];
  await requirePermission(tenant.tenantId, resource, action);

  const { error: storageError } = await supabase.storage.from("entity-photos").remove([photo.storage_path]);
  if (storageError) return { error: storageError.message };

  const { error: deleteError } = await supabase.from("entity_photos").delete().eq("id", photoId);
  if (deleteError) return { error: deleteError.message };

  revalidatePath(revalidatePathValue);
  return { success: true };
}
