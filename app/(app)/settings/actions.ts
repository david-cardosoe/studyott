"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { THEME_MODES } from "@/lib/theme";

const themeSchema = z.enum(THEME_MODES);

/** Saves the theme mode. The client has already applied it and set the cookie. */
export async function setThemeMode(mode: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = themeSchema.safeParse(mode);
  if (!parsed.success) {
    return { ok: false, error: "Pick System, Light or Dark." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .update({ theme_mode: parsed.data })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: errorMessage(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
