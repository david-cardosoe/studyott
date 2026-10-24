import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string };

/**
 * Where to go right after signing in: /welcome for new users, else Home.
 * Sign-in redirects go straight there, because a server action's redirect
 * that the proxy redirects again leaves the client router on the wrong URL.
 * Takes the client that just signed in, so it sees the new session.
 */
export async function pathAfterSignIn(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<"/" | "/welcome"> {
  const { data } = await supabase
    .from("user_settings")
    .select("onboarded_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data && data.onboarded_at === null ? "/welcome" : "/";
}

/**
 * The signed-in user, verified with getClaims() (checks the JWT signature).
 * Redirects to /login when there is no valid session. Deduped per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { id: userId };
});

/** Whether the user has finished the one-time Welcome page. */
export const isOnboarded = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("onboarded_at")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data.onboarded_at !== null;
});
