import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasServiceRoleKey = Boolean(serviceRoleKey);

export function adminClient() {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Creates a real confirmed auth user (via the admin API — this is test setup only,
// never how the app itself creates users) and returns a signed-in client for them.
export async function createSignedInTestUser(email: string, password: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Failed to create test user");

  const client = createSupabaseClient<Database>(url, anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { userId: data.user.id, client };
}

export async function deleteTestUser(userId: string) {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}
