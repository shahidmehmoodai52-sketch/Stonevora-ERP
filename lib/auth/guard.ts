import { createClient } from "@/lib/supabase/server";

export class ForbiddenError extends Error {
  constructor(resource: string, action: string) {
    super(`Missing permission: ${resource}.${action}`);
    this.name = "ForbiddenError";
  }
}

// Defense-in-depth check for the start of every Server Action mutation. This calls
// the same has_permission() Postgres function every RLS policy's `with check`
// clause relies on, so a failure here and a failure at the database layer always
// agree — this just turns a raw RLS-violation error into a clean, typed one before
// the query is even attempted.
export async function requirePermission(
  tenantId: string,
  resource: string,
  action: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    check_tenant_id: tenantId,
    p_resource: resource,
    p_action: action,
  });

  if (error || !data) {
    throw new ForbiddenError(resource, action);
  }
}
