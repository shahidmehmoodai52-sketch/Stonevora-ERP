-- Bug fix: TG_OP is uppercase ('INSERT'/'UPDATE'/'DELETE'), but the CASE branches
-- compared it against lowercase literals ('insert'/'update'/'delete'), so the
-- comparison was always false and old_data/new_data were silently stored as NULL
-- on every row (caught by directly querying audit_log after a real update, per the
-- Phase 0 verification plan). Compare against TG_OP's actual case instead.

create or replace function audit_trigger_fn() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid;
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);
  insert into audit_log (tenant_id, table_name, record_id, action, changed_by, old_data, new_data, reason)
  values (
    v_tenant_id,
    TG_TABLE_NAME,
    coalesce((v_row ->> 'id')::uuid, (v_row ->> 'tenant_id')::uuid),
    lower(TG_OP),
    auth.uid(),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) else null end,
    current_setting('app.audit_reason', true)
  );
  return coalesce(new, old);
end;
$$;
