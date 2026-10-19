"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { errorKey, errorMessage, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/username";

const welcomeSchema = z.object({
  username: usernameSchema,
  // Postgres checks it against pg_timezone_names; this only bounds the input.
  timezone: z.string().trim().max(64).optional(),
});

/** Saves the username and browser timezone, marks the user onboarded, goes Home. */
export async function completeWelcome(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = welcomeSchema.safeParse({
    username: formData.get("username"),
    timezone: formData.get("timezone") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: errorMessage({ message: "username_invalid" }) };
  }
  const { username, timezone } = parsed.data;
  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ username })
    .eq("user_id", user.id);
  if (profileError) {
    return { ok: false, error: errorMessage(profileError) };
  }

  const onboarded_at = new Date().toISOString();
  let { error: settingsError } = await supabase
    .from("user_settings")
    .update(timezone ? { timezone, onboarded_at } : { onboarded_at })
    .eq("user_id", user.id);
  if (errorKey(settingsError) === "timezone_invalid") {
    // A browser zone Postgres doesn't know: keep the default (UTC); the user
    // can pick one in Settings. Don't block onboarding on it.
    ({ error: settingsError } = await supabase
      .from("user_settings")
      .update({ onboarded_at })
      .eq("user_id", user.id));
  }
  if (settingsError) {
    return { ok: false, error: errorMessage(settingsError) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
