import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Per-request client, RLS-scoped to whichever user's session cookie is present.
// Use this in Server Components and Server Actions for all reads/writes — this is
// the client whose queries are subject to Row-Level Security with the real user JWT.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render (no request/response cycle to
            // write cookies to) — session refresh already happened in middleware.
          }
        },
      },
    }
  );
}
