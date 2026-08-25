-- Product Master audit finding (natural stone + tile industry research): the
-- Phase 0 inventory_units/inventory_batches placeholders were missing fields the
-- master spec explicitly requires:
--   - inventory_units had no parent-child link, so a slab could not be traced back
--     to its parent block, and a remnant could not be traced to its parent slab —
--     the exact "Botticino Marble = 5000 sqft" flattening the spec warns against.
--   - inventory_batches had shade_code but no caliber_code; the tile industry
--     treats caliber (dimensional/size consistency grouping) as a distinct
--     attribute from shade (color consistency grouping), and the spec's own
--     example ("Batch B-2026-45, Shade S-03, Caliber 03") names both.
-- These tables still have no UI/workflow (deferred to the Block/Slab Factory and
-- Tile Manufacturing phases) — this migration only corrects the placeholder schema
-- so it isn't redesigned later; no existing data is affected (both tables are
-- currently empty in every tenant).

create type inventory_unit_type as enum ('block', 'slab', 'remnant');

alter table inventory_units
  add column unit_type inventory_unit_type not null default 'slab',
  add column parent_unit_id uuid references inventory_units (id),
  add column sequence_number int,
  add column actual_area numeric(12, 4),
  add column qr_code_value text,
  add column photo_url text,
  add column cost numeric(18, 4),
  add column selling_price numeric(18, 4);

create index idx_inventory_units_parent_unit_id on inventory_units (parent_unit_id);

alter table inventory_batches
  add column caliber_code text;
