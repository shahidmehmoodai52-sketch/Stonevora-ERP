-- Fix: projects.tenant_id and project_materials.tenant_id were created
-- without 'on delete cascade' in migration 0046, inconsistent with every
-- other tenant-scoped table's convention (tenant_id always cascades;
-- other FKs never do). Caught during this migration's own test-data
-- cleanup when a tenant delete failed on a leftover projects row.
alter table projects drop constraint projects_tenant_id_fkey;
alter table projects add constraint projects_tenant_id_fkey
  foreign key (tenant_id) references tenants (id) on delete cascade;

alter table project_materials drop constraint project_materials_tenant_id_fkey;
alter table project_materials add constraint project_materials_tenant_id_fkey
  foreign key (tenant_id) references tenants (id) on delete cascade;
