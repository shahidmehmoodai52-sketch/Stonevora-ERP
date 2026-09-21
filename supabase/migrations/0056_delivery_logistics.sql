-- Dispatch/logistics fields on deliveries: the fourth real gap this
-- session's own 36-part spec audit found -- Part 12 (Dispatch/Logistics)
-- asks for transporter, proof-of-delivery, and export-shipment details,
-- but `deliveries` only ever had `vehicle_info`/`driver_name`, and even
-- those two were never wired into the create-delivery form. This
-- migration adds the remaining fields the spec asks for and, in the same
-- pass, wires up the one genuinely dead piece of pre-existing schema this
-- gap touches: `delivery_status` has always had a 'delivered' value, but
-- nothing in the codebase has ever set it -- dispatch_delivery only ever
-- moves a delivery from 'draft' to 'dispatched'. Proof-of-delivery is the
-- natural, minimal place to finally close that: a new
-- confirm_delivery_pod RPC moves a dispatched delivery to 'delivered' and
-- records who signed for it and any POD notes, the same "one inspection
-- gate, one terminal transition" shape as every other status-machine RPC
-- in this codebase (start/complete/cancel_processing_job,
-- dispatch_delivery itself).
--
-- `incoterm` is a bounded, internationally standardized 11-code set
-- (Incoterms 2020), so it earns a real enum rather than free text --
-- consistent with this codebase's existing convention of enumerating any
-- genuinely bounded value set (account_type, delivery_status, qc_outcome,
-- ...) instead of leaving it to free-text drift. Every other new field
-- (transporter name, container/shipment references, ports, POD
-- particulars) is free text: none of them are a bounded set, and none of
-- them drive any business logic -- they're operational record-keeping,
-- the same role `vehicle_info`/`driver_name` already played.

create type incoterm as enum ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP');

alter table deliveries
  add column transporter_name text,
  add column container_number text,
  add column shipment_reference text,
  add column port_of_loading text,
  add column port_of_discharge text,
  add column incoterm incoterm,
  add column pod_received_by text,
  add column pod_notes text,
  add column pod_received_at timestamptz;

-- ---------------------------------------------------------------------------
-- confirm_delivery_pod: same permission/branch-access shape as
-- dispatch_delivery (sales.edit + has_branch_access), gated on the
-- delivery being 'dispatched' -- not 'draft' (nothing to confirm receipt
-- of yet) and not already 'delivered' (no re-confirmation, matching every
-- other terminal-status RPC in this codebase).
-- ---------------------------------------------------------------------------

create function confirm_delivery_pod(
  p_delivery_id uuid,
  p_pod_received_by text default null,
  p_pod_notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_delivery deliveries%rowtype;
begin
  select * into v_delivery from deliveries where id = p_delivery_id;
  if not found then
    raise exception 'Delivery not found';
  end if;
  if not has_permission(v_delivery.tenant_id, 'sales', 'edit') then
    raise exception 'Missing permission: sales.edit';
  end if;
  if not has_branch_access(v_delivery.tenant_id, v_delivery.branch_id) then
    raise exception 'You do not have access to the branch of this delivery';
  end if;
  if v_delivery.status <> 'dispatched' then
    raise exception 'Delivery must be dispatched before proof of delivery can be recorded (current status: %)', v_delivery.status;
  end if;

  update deliveries
    set status = 'delivered',
        pod_received_by = p_pod_received_by,
        pod_notes = p_pod_notes,
        pod_received_at = now()
    where id = p_delivery_id;
end;
$$;

revoke execute on function confirm_delivery_pod(uuid, text, text) from public, anon;
