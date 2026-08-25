-- Security advisor fix: several SECURITY DEFINER functions were callable directly
-- via PostgREST RPC (/rest/v1/rpc/<fn>) by anon/authenticated even though they are
-- only meant to run as triggers or as internal RLS-policy helpers.

-- Trigger-only functions: never meant to be called directly. Trigger firing does not
-- require EXECUTE on the function, so revoking here only blocks direct RPC calls.
revoke execute on function audit_trigger_fn() from public, anon, authenticated;
revoke execute on function storage_location_set_path() from public, anon, authenticated;
revoke execute on function handle_new_auth_user() from public, anon, authenticated;

-- Onboarding RPC: must stay callable by signed-in users (that's its whole purpose),
-- but has no legitimate anonymous caller — it already raises if auth.uid() is null,
-- this just removes the anon code path entirely.
revoke execute on function create_tenant_for_user(text, text) from public, anon;

-- RLS-policy helpers: must remain executable by `authenticated` (every tenant-scoped
-- table's policies call these, and policy evaluation runs as the querying role), but
-- have no legitimate direct anonymous caller.
revoke execute on function is_tenant_member(uuid) from public, anon;
revoke execute on function has_permission(uuid, text, text) from public, anon;
