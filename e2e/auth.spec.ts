import { expect, test } from "@playwright/test";
import { devSignIn } from "./helpers";

test("signed-out visitors are sent to /login", async ({ page }) => {
  for (const path of ["/", "/welcome", "/history"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { name: "StudyOtt" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("sign in, land on Home, sign out", async ({ page }) => {
  // test1 is onboarded in the seed, so sign-in goes straight to Home.
  await devSignIn(page, "test1@studyott.local");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  // Signed-in users skip /login and /welcome.
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/$/);

  // Sign out lives in Settings.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The session is really gone.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("test1@studyott.local");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in with test account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText(
    "Wrong email or password.",
  );
  await expect(page).toHaveURL(/\/login$/);
});
