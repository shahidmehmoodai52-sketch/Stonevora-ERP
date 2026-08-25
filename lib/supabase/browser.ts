import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Client-side client for reads/subscriptions only — never used for privileged
// writes, which always go through Server Actions using lib/supabase/server.ts.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
