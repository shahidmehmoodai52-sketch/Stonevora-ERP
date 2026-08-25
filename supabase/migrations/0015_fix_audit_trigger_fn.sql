-- Bug fix: audit_trigger_fn assumed every audited table has an `id` column, but
-- tenant_settings' primary key is `tenant_id` — direct field access (new.id) throws
-- "record new has no field id" at runtime for that table. Use a jsonb key lookup
-- instead, which returns null rather than erroring when the key is absent, and fall
-- back to tenant_id for single-row-per-tenant tables.

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
    case when TG_OP in ('update', 'delete') then to_jsonb(old) else null end,
    case when TG_OP in ('update', 'insert') then to_jsonb(new) else null end,
    current_setting('app.audit_reason', true)
  );
  return coalesce(new, old);
end;
$$;
