import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { devSignIn, testPassword } from "./helpers";

// A brand-new (not onboarded) user, created through the local Auth API the
// same way a first sign-in would: the database trigger adds the profile,
// settings and default subjects. `pnpm db:reset` clears these users.
function supabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function createNewUser() {
  const supabase = supabaseClient();
  const email = `e2e-${crypto.randomUUID()}@studyott.local`;
  const { error } = await supabase.auth.signUp({
    email,
    password: testPassword(),
    options: { data: { full_name: "Otto Tester" } },
  });
  if (error) throw error;
  return email;
}

test.use({ timezoneId: "America/Denver" });

test("first sign-in goes through Welcome once", async ({ page }) => {
  const email = await createNewUser();
  await devSignIn(page, email);

  await expect(page).toHaveURL(/\/welcome$/);

  // Until onboarded, every signed-in page leads to Welcome.
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(
    page.getByText(/You're @otto_\d{4}\. Want a different username\?/),
  ).toBeVisible();

  const username = page.getByLabel("Username");
  await expect(username).toHaveValue(/^otto_\d{4}$/);
  await expect(page.getByText("This is your current username.")).toBeVisible();

  // Live checks: bad format, reserved, then a free name.
  await username.fill("9lives");
  await expect(page.getByText(/^3 to 20 characters/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

  await username.fill("admin");
  await expect(page.getByText("That username isn't available.")).toBeVisible();

  await username.fill("test1");
  await expect(page.getByText("That username is taken.")).toBeVisible();

  const newName = `otter_${Date.now().toString(36).slice(-6)}`;
  await username.fill(newName.toUpperCase());
  await expect(page.getByText("Available!")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  // One-time: the Welcome page now sends the user Home.
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/$/);

  // Saved as that user: lowercase username, browser timezone, onboarded.
  const supabase = supabaseClient();
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email,
    password: testPassword(),
  });
  if (error) throw error;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", auth.user.id)
    .single();
  const { data: settings } = await supabase
    .from("user_settings")
    .select("timezone, onboarded_at")
    .eq("user_id", auth.user.id)
    .single();
  expect(profile?.username).toBe(newName);
  expect(settings?.timezone).toBe("America/Denver");
  expect(settings?.onboarded_at).not.toBeNull();
});
