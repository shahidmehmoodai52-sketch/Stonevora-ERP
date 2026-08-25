-- Reusable audit trail: who/what/when/before/after/reason.
-- Later modules attach the same trigger to their own tables with zero new infrastructure.

create table audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  table_name text not null,
  record_id uuid not null,
  action text not null, -- 'insert','update','delete'
  changed_by uuid references profiles (id),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb,
  reason text
);

create function audit_trigger_fn() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);
  insert into audit_log (tenant_id, table_name, record_id, action, changed_by, old_data, new_data, reason)
  values (
    v_tenant_id,
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    lower(TG_OP),
    auth.uid(),
    case when TG_OP in ('update', 'delete') then to_jsonb(old) else null end,
    case when TG_OP in ('update', 'insert') then to_jsonb(new) else null end,
    current_setting('app.audit_reason', true)
  );
  return coalesce(new, old);
end;
$$;

-- Phase 0 demonstration: attach to products and tenant_settings only.
create trigger trg_audit_products
  after insert or update or delete on products
  for each row execute function audit_trigger_fn();

create trigger trg_audit_tenant_settings
  after insert or update or delete on tenant_settings
  for each row execute function audit_trigger_fn();
