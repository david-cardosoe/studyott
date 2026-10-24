import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { parseThemeMode, THEME_COOKIE, themeCookieOptions } from "@/lib/theme";

export type CurrentUser = { id: string };

/**
 * Runs right after signing in: copies the saved theme into the theme cookie
 * (so the first page paints in it), then returns where to go: /welcome for
 * new users, else Home. Sign-in redirects go straight there, because a server
 * action's redirect that the proxy redirects again leaves the client router on
 * the wrong URL. Takes the client that just signed in, so it sees the new session.
 */
export async function afterSignIn(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<"/" | "/welcome"> {
  const { data } = await supabase
    .from("user_settings")
    .select("onboarded_at, theme_mode")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    (await cookies()).set(THEME_COOKIE, data.theme_mode, themeCookieOptions);
  }
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

/** The user's settings row (the columns the app shell needs). */
export const getUserSettings = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("onboarded_at, theme_mode")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return { ...data, theme_mode: parseThemeMode(data.theme_mode) };
});

/** Whether the user has finished the one-time Welcome page. */
export async function isOnboarded(userId: string): Promise<boolean> {
  return (await getUserSettings(userId)).onboarded_at !== null;
}
