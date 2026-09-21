-- Photo/image upload for blocks, slabs, and products: the sixth real gap
-- this session's own 36-part spec audit found -- multiple spec sections
-- reference photo capture (block/slab condition photos, product catalog
-- images) but this codebase has never used Supabase Storage anywhere.
-- This migration adds the one storage bucket and one metadata table this
-- needs, deliberately generic across both entity kinds instead of two
-- separate photo tables -- "a photo attached to an entity" is the same
-- shape whether the entity is a product or a block/slab, matching this
-- codebase's established preference for one reusable mechanism over
-- parallel near-duplicates (product_lookup_values' generic attribute
-- catalog, audit_trigger_fn() reused unchanged by every new table, are
-- the precedent).
--
-- Storage path convention: {tenant_id}/{entity_type}/{entity_id}/{uuid}.
-- {ext} -- tenant_id leads the path specifically so storage.foldername()
-- can be used directly in RLS policies, the same "derive the tenant from
-- the path itself" pattern the Supabase docs' own private-bucket example
-- uses, rather than trusting a client-supplied tenant claim.
--
-- entity_type is deliberately just ('product', 'inventory_unit') -- an
-- inventory_unit covers both blocks and slabs/remnants (they're the same
-- table, distinguished only by unit_type), so no separate 'block'/'slab'
-- variant is needed. inventory_batches (Tile Manufacturing) was
-- considered and left out: no screen in this app currently shows an
-- individual batch outside its own QC/detail flow in a way that would
-- benefit from a photo the way an individual physical block does, and
-- the task only asked for "blocks, slabs, products" -- a real, narrower
-- boundary, not an oversight.
--
-- Private bucket (not public): a tenant's block/product photos are
-- exactly the kind of asset that shouldn't be guessable-URL-accessible
-- to the whole internet, matching every other piece of tenant data in
-- this schema being RLS-gated rather than open by default. Photos are
-- served via short-lived signed URLs generated server-side (the
-- request-scoped Supabase client, so signed-URL generation itself goes
-- through the same SELECT RLS policy below), never a public bucket URL.
--
-- Permission gating mirrors the resource each entity_type already uses
-- for edits elsewhere in this codebase: 'product'.'edit' for product
-- photos (the same permission ProductForm's own update action requires),
-- 'production'.'edit' for inventory_unit photos (the same permission
-- Factory's own processing-job edit actions require). Viewing a photo
-- requires only tenant membership -- a photo is no more sensitive than
-- the record it documents, and every screen that can show a photo
-- gallery already gates the underlying entity's own view access via its
-- normal RLS/permission checks before this table is ever queried.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entity-photos', 'entity-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']);

create table entity_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  entity_type text not null check (entity_type in ('product', 'inventory_unit')),
  entity_id uuid not null,
  storage_path text not null unique,
  caption text,
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_entity_photos_entity on entity_photos (tenant_id, entity_type, entity_id);

alter table entity_photos enable row level security;

create policy entity_photos_select on entity_photos for select
  using (is_tenant_member(tenant_id));

create policy entity_photos_insert on entity_photos for insert
  with check (
    is_tenant_member(tenant_id)
    and (
      (entity_type = 'product' and has_permission(tenant_id, 'product', 'edit'))
      or (entity_type = 'inventory_unit' and has_permission(tenant_id, 'production', 'edit'))
    )
  );

create policy entity_photos_delete on entity_photos for delete
  using (
    is_tenant_member(tenant_id)
    and (
      (entity_type = 'product' and has_permission(tenant_id, 'product', 'edit'))
      or (entity_type = 'inventory_unit' and has_permission(tenant_id, 'production', 'edit'))
    )
  );

-- No update policy: a wrong caption or wrong file is deleted and
-- re-uploaded, not edited in place -- kept deliberately as small a
-- surface as the feature needs, matching journal_entries' own
-- insert-and-reverse-only precedent for a similarly minimal write shape.

create trigger entity_photos_audit after insert or update or delete on entity_photos
  for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- storage.objects RLS: same permission shape as the entity_photos table
-- above, derived entirely from the object's own path via
-- storage.foldername() rather than any client-supplied claim, per the
-- Supabase-documented private-bucket pattern.
-- ---------------------------------------------------------------------------

create policy entity_photos_storage_select on storage.objects for select
  to authenticated
  using (
    bucket_id = 'entity-photos'
    and is_tenant_member((storage.foldername(name))[1]::uuid)
  );

create policy entity_photos_storage_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'entity-photos'
    and is_tenant_member((storage.foldername(name))[1]::uuid)
    and (
      ((storage.foldername(name))[2] = 'product' and has_permission((storage.foldername(name))[1]::uuid, 'product', 'edit'))
      or ((storage.foldername(name))[2] = 'inventory_unit' and has_permission((storage.foldername(name))[1]::uuid, 'production', 'edit'))
    )
  );

create policy entity_photos_storage_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'entity-photos'
    and is_tenant_member((storage.foldername(name))[1]::uuid)
    and (
      ((storage.foldername(name))[2] = 'product' and has_permission((storage.foldername(name))[1]::uuid, 'product', 'edit'))
      or ((storage.foldername(name))[2] = 'inventory_unit' and has_permission((storage.foldername(name))[1]::uuid, 'production', 'edit'))
    )
  );
