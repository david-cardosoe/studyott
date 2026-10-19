"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  // "local" ends this device's session only; other devices stay signed in.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
