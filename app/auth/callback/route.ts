import { NextResponse, type NextRequest } from "next/server";
import { afterSignIn } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Google sends the user back here (via Supabase Auth) with a one-time code.
// Exchanging it sets the session cookies; new users then go to /welcome.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const path = await afterSignIn(supabase, data.user.id);
      return NextResponse.redirect(new URL(path, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}
