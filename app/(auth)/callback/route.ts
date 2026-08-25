import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the redirect Supabase Auth sends back after email confirmation /
// magic-link / OAuth sign-in: exchanges the one-time code for a real session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
