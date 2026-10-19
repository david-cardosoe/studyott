import { expect, type Page } from "@playwright/test";

export function testPassword() {
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) throw new Error("Set TEST_USER_PASSWORD (see .env.example).");
  return password;
}

/** Signs in through the dev-only email/password form on /login. */
export async function devSignIn(
  page: Page,
  email: string,
  password = testPassword(),
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in with test account" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
