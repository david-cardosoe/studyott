import { expect, test, type Page } from "@playwright/test";
import { devSignIn } from "./helpers";

// test2 is only used here, and only by the desktop project, because these
// tests change a saved setting.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes a saved setting");
});

const LIGHT_BG = "rgb(247, 249, 246)";
const DARK_BG = "rgb(26, 31, 25)";

async function bodyBackground(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

/** The background as first painted: checked before any React code runs. */
async function firstPaintBackground(page: Page, path: string) {
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto(path);
  const bg = await bodyBackground(page);
  await page.unroute("**/_next/static/**/*.js");
  return bg;
}

async function pickTheme(page: Page, name: "System" | "Light" | "Dark") {
  await page.goto("/settings");
  await page.getByRole("radio", { name }).check({ force: true });
  await expect(page.getByRole("radio", { name })).toBeChecked();
  // Wait for the save: the setting is read back on a fresh load.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("radio", { name })).toBeChecked();
  }).toPass();
}

test("System follows the device", async ({ page }) => {
  await devSignIn(page, "test2@studyott.local");
  await pickTheme(page, "System");

  await page.emulateMedia({ colorScheme: "dark" });
  expect(await firstPaintBackground(page, "/")).toBe(DARK_BG);
  await page.emulateMedia({ colorScheme: "light" });
  expect(await firstPaintBackground(page, "/")).toBe(LIGHT_BG);
});

test("a forced theme paints first, survives sign-out, and syncs", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await devSignIn(page, "test2@studyott.local");
  await pickTheme(page, "Dark");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  // No flash: dark before any JavaScript from the app runs.
  expect(await firstPaintBackground(page, "/history")).toBe(DARK_BG);

  // Signed out, the cookie keeps the last theme.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await firstPaintBackground(page, "/login")).toBe(DARK_BG);

  // A new browser with no cookie gets the saved theme at sign-in.
  await context.clearCookies();
  await devSignIn(page, "test2@studyott.local");
  expect(await firstPaintBackground(page, "/")).toBe(DARK_BG);

  // Back to the default for other runs.
  await pickTheme(page, "System");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  expect(await bodyBackground(page)).toBe(LIGHT_BG);
});

test("a failed save rolls back and shows a toast", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await devSignIn(page, "test2@studyott.local");
  await pickTheme(page, "System");

  // Server actions POST to the page URL; fail that request.
  await page.route("**/settings", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("radio", { name: "Dark" }).check({ force: true });

  const toast = page.getByText("Couldn't save your theme");
  await expect(toast).toBeVisible();
  await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

  // Base UI hides the close button from screen readers (they dismiss with
  // the keyboard), so find it by its label rather than by role.
  await page.getByLabel("Dismiss").click();
  await expect(toast).toBeHidden();
});
