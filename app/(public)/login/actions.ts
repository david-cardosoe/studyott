"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pathAfterSignIn } from "@/lib/auth";
import { isDevLoginEnabled } from "@/lib/dev-login";
import type { ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  // Supabase only redirects to URLs on its allow list, so a forged Origin
  // header can't send the code anywhere else.
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=auth");
  redirect(data.url);
}

const devLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

/** Local email/password login for development and Playwright only. */
export async function devSignIn(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Checked here too, not just when rendering the form: actions are public endpoints.
  if (!isDevLoginEnabled()) {
    return { ok: false, error: "Test login is turned off." };
  }
  const parsed = devLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter an email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: "Wrong email or password." };
  }
  redirect(await pathAfterSignIn(supabase, data.user.id));
}
