import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service-role client. Bypasses Row-Level Security entirely — never import this
// from client code, and use it only for operations that must legitimately act
// outside any single tenant's scope (e.g. platform-level maintenance). Tenant
// onboarding does NOT use this client: create_tenant_for_user is a security-definer
// RPC called through the normal RLS-scoped server client instead, so no service-role
// key needs to be involved in the request path a regular user triggers.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
