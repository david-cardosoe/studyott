import { expect, test, type Page } from "@playwright/test";
import { devSignIn } from "./helpers";

const TABS = [
  { name: "Home", path: "/" },
  { name: "Weekly History", path: "/history" },
  { name: "Lifetime Overview", path: "/lifetime" },
  { name: "Settings", path: "/settings" },
];

async function expectNoHorizontalScroll(page: Page) {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
}

test("the tabs navigate and mark the current page", async ({
  page,
}, testInfo) => {
  const phone = testInfo.project.name === "phone";
  await devSignIn(page, "test1@studyott.local");
  const nav = page.getByRole("navigation", { name: "Main" });

  for (const tab of TABS) {
    if (phone) {
      // Below 640px the tabs collapse into a menu button.
      await nav.getByRole("button", { name: /^Menu:/ }).click();
      await page.getByRole("menuitem", { name: tab.name }).click();
      await expect(page.getByRole("menu")).toBeHidden();
      await expect(
        nav.getByRole("button", { name: `Menu: ${tab.name}` }),
      ).toBeVisible();
    } else {
      await nav.getByRole("link", { name: tab.name }).click();
      await expect(nav.getByRole("link", { name: tab.name })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: tab.name }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test("the phone menu closes with Escape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone-only menu");
  await devSignIn(page, "test1@studyott.local");
  await page.getByRole("button", { name: /^Menu:/ }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
});

test("the PWA manifest and icons load signed out", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name).toBe("StudyOtt");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const iconRes = await request.get(icon.src);
    expect(iconRes.ok()).toBe(true);
    expect(iconRes.headers()["content-type"]).toBe("image/png");
  }
});
