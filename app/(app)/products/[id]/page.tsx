import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";
import { updateProductAction, deleteProductAction } from "@/actions/products";
import { generateProductBarcodeAction } from "@/actions/scanning";
import { uploadEntityPhotoAction, deleteEntityPhotoAction } from "@/actions/photos";
import { PostButton } from "@/components/PostButton";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ProductForm } from "../ProductForm";
import { DeleteProductButton } from "./DeleteProductButton";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: product }, { data: uoms }, { data: categories }, permissionSet] =
    await Promise.all([
      supabase.from("products_secure").select("*").eq("id", id).single(),
      supabase.from("uom").select("id, code, name").order("code"),
      supabase
        .from("product_categories")
        .select("id, name")
        .eq("tenant_id", tenant.tenantId)
        .order("name"),
      fetchPermissionSet(tenant.tenantId),
    ]);

  if (!product) notFound();

  const canEditFinancials =
    hasPermission(permissionSet, "product", "view_cost") ||
    hasPermission(permissionSet, "product", "view_profit");
  const canDelete = hasPermission(permissionSet, "product", "delete");
  const canEditProduct = hasPermission(permissionSet, "product", "edit");

  const { data: photoRows } = await supabase
    .from("entity_photos")
    .select("id, storage_path, caption")
    .eq("entity_type", "product")
    .eq("entity_id", id)
    .order("created_at", { ascending: false });

  const photos = await Promise.all(
    (photoRows ?? []).map(async (p) => {
      const { data } = await supabase.storage.from("entity-photos").createSignedUrl(p.storage_path, 3600);
      return { id: p.id, url: data?.signedUrl ?? "", caption: p.caption };
    })
  );
  const revalidatePathValue = `/products/${id}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {product.name}
        </h1>
        {canDelete && (
          <DeleteProductButton productId={id} action={deleteProductAction} />
        )}
      </div>
      <div className="mb-6 flex items-center gap-3 text-sm">
        {product.barcode ? (
          <span className="text-zinc-600 dark:text-zinc-400">
            Barcode: <span className="font-mono text-zinc-900 dark:text-zinc-50">{product.barcode}</span>
          </span>
        ) : (
          <PostButton
            id={id}
            action={generateProductBarcodeAction}
            label="Generate barcode"
            pendingLabel="Generating…"
          />
        )}
      </div>
      <ProductForm
        action={updateProductAction.bind(null, id)}
        uoms={uoms ?? []}
        categories={categories ?? []}
        canEditFinancials={canEditFinancials}
        submitLabel="Save changes"
        initialValues={{
          sku: product.sku ?? "",
          name: product.name ?? "",
          inventoryTrackingMode: product.inventory_tracking_mode ?? "simple",
          baseUomId: product.base_uom_id ?? "",
          purchaseUomId: product.purchase_uom_id ?? "",
          salesUomId: product.sales_uom_id ?? "",
          categoryId: product.category_id ?? "",
          costPrice: product.cost_price !== null ? String(product.cost_price) : "",
          standardMarginPct:
            product.standard_margin_pct !== null ? String(product.standard_margin_pct) : "",
        }}
      />

      <div className="mt-8">
        <PhotoGallery
          photos={photos}
          uploadAction={uploadEntityPhotoAction.bind(null, "product", id, revalidatePathValue)}
          deleteAction={deleteEntityPhotoAction.bind(null, revalidatePathValue)}
          canEdit={canEditProduct}
        />
      </div>
    </div>
  );
}
