-- Tenant onboarding as a single atomic, security-definer RPC. This is the one place
-- allowed to write tenants/roles/role_permissions/user_tenants/user_roles before any
-- user_tenants row exists (the chicken-and-egg case every other RLS policy assumes
-- away). Called via a normal RLS-scoped client authenticated as the requesting user
-- (auth.uid()) — no service-role key needed for this flow.

create function create_tenant_for_user(p_tenant_name text, p_tenant_slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role record;
  v_role_id uuid;
  v_permission record;
  v_grant boolean;
begin
  if v_user_id is null then
    raise exception 'create_tenant_for_user requires an authenticated user';
  end if;

  insert into tenants (name, slug) values (p_tenant_name, p_tenant_slug)
    returning id into v_tenant_id;

  insert into tenant_settings (tenant_id) values (v_tenant_id);

  for v_role in select id, code from role_templates loop
    insert into roles (tenant_id, template_id, code, name)
      select v_tenant_id, rt.id, rt.code, rt.name from role_templates rt where rt.id = v_role.id
      returning id into v_role_id;

    for v_permission in select id, resource, action from permissions loop
      v_grant := case
        when v_role.code in ('owner', 'company_admin') then true
        when v_role.code = 'accountant' then
          v_permission.action in ('view', 'view_cost', 'view_profit', 'view_financial')
          or (v_permission.resource = 'company_settings' and v_permission.action = 'edit')
        when v_role.code = 'inventory_manager' then
          v_permission.resource in ('product', 'warehouse')
          and v_permission.action in ('view', 'create', 'edit', 'delete', 'print', 'export')
        when v_role.code = 'warehouse_staff' then
          v_permission.resource in ('product', 'warehouse')
          and v_permission.action in ('view', 'create', 'edit')
        when v_role.code = 'qc_manager' then
          (v_permission.resource = 'product' and v_permission.action in ('view', 'edit'))
          or (v_permission.resource = 'warehouse' and v_permission.action = 'view')
        when v_role.code = 'salesperson' then
          v_permission.resource in ('product', 'warehouse') and v_permission.action = 'view'
        when v_role.code = 'viewer' then
          v_permission.action = 'view'
        else -- factory_manager, production_manager, purchase_manager, sales_manager,
             -- production_operator, dispatch_staff: baseline view access in Phase 0;
             -- module-specific grants land with each role's dedicated phase.
          v_permission.resource in ('product', 'warehouse') and v_permission.action = 'view'
      end;

      if v_grant then
        insert into role_permissions (role_id, permission_id, tenant_id)
        values (v_role_id, v_permission.id, v_tenant_id);
      end if;
    end loop;
  end loop;

  insert into user_tenants (user_id, tenant_id) values (v_user_id, v_tenant_id);

  insert into user_roles (user_id, tenant_id, role_id)
    select v_user_id, v_tenant_id, r.id from roles r
    where r.tenant_id = v_tenant_id and r.code = 'owner';

  return v_tenant_id;
end;
$$;
