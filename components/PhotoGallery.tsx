"use client";

import { useState, useTransition } from "react";
import { ActionForm, type SimpleActionResult } from "./ActionForm";

type Photo = { id: string; url: string; caption: string | null };

// Shared by the product detail page and the block detail page (see
// actions/photos.ts) -- a photo gallery is the same shape regardless of
// which entity it's attached to. Deliberately has no offlineActionKey:
// the existing offline queue only serializes text/number/select fields
// (see lib/offline/sync.ts's own formDataToEntries comment), and a File
// would silently corrupt if queued the same way -- so uploads here
// simply require a live connection, the same boundary every other
// file-free screen in this app already has by construction.
export function PhotoGallery({
  photos,
  uploadAction,
  deleteAction,
  canEdit,
}: {
  photos: Photo[];
  uploadAction: (formData: FormData) => Promise<SimpleActionResult>;
  deleteAction: (photoId: string) => Promise<SimpleActionResult>;
  canEdit: boolean;
}) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Photos</h2>
      {photos.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="relative overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs expire; not eligible for next/image's static optimization */}
              <img src={p.url} alt={p.caption ?? "Photo"} className="aspect-square w-full object-cover" />
              {canEdit && (
                <button
                  type="button"
                  disabled={pending && pendingDeleteId === p.id}
                  onClick={() => {
                    setPendingDeleteId(p.id);
                    startTransition(async () => {
                      const result = await deleteAction(p.id);
                      setDeleteError("error" in result ? result.error : null);
                    });
                  }}
                  className="absolute right-1 top-1 rounded bg-zinc-900/70 px-2 py-1 text-xs text-white hover:bg-zinc-900/90"
                >
                  {pending && pendingDeleteId === p.id ? "…" : "Remove"}
                </button>
              )}
              {p.caption && <p className="p-1 text-xs text-zinc-500">{p.caption}</p>}
            </div>
          ))}
        </div>
      )}
      {photos.length === 0 && <p className="mb-4 text-sm text-zinc-500">No photos yet.</p>}
      {deleteError && <p className="mb-4 text-sm text-red-600">{deleteError}</p>}

      {canEdit && (
        <ActionForm action={uploadAction} submitLabel="Upload photo" pendingLabel="Uploading…" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">File</label>
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Caption (optional)</label>
            <input name="caption" className="input" />
          </div>
        </ActionForm>
      )}
    </div>
  );
}
