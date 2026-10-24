import { afterEach, describe, expect, it } from "vitest";
import {
  applyTheme,
  parseThemeMode,
  THEME_COOKIE,
  THEME_SCRIPT,
  themeFromCookieString,
} from "./theme";

describe("parseThemeMode", () => {
  it("accepts the three modes", () => {
    expect(parseThemeMode("system")).toBe("system");
    expect(parseThemeMode("light")).toBe("light");
    expect(parseThemeMode("dark")).toBe("dark");
  });

  it("falls back to system", () => {
    expect(parseThemeMode(undefined)).toBe("system");
    expect(parseThemeMode("Dark")).toBe("system");
    expect(parseThemeMode("purple")).toBe("system");
  });
});

describe("themeFromCookieString", () => {
  it("finds the theme among other cookies", () => {
    expect(themeFromCookieString(`a=1; ${THEME_COOKIE}=dark; b=2`)).toBe(
      "dark",
    );
    expect(themeFromCookieString(`${THEME_COOKIE}=light`)).toBe("light");
  });

  it("ignores look-alike names and missing cookies", () => {
    expect(themeFromCookieString(`x${THEME_COOKIE}=dark`)).toBe("system");
    expect(themeFromCookieString("")).toBe("system");
  });
});

describe("theme in the document", () => {
  afterEach(() => {
    document.documentElement.className = "";
    document.head.innerHTML = "";
    document.cookie = `${THEME_COOKIE}=; max-age=0; path=/`;
  });

  function addThemeColorMetas() {
    document.head.innerHTML = `
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f9f6">
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a1f19">`;
  }

  function metaColors() {
    return [...document.querySelectorAll('meta[name="theme-color"]')].map((m) =>
      m.getAttribute("content"),
    );
  }

  it("the head script applies a forced mode from the cookie", () => {
    addThemeColorMetas();
    document.cookie = `${THEME_COOKIE}=dark; path=/`;
    new Function(THEME_SCRIPT)();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(metaColors()).toEqual(["#1a1f19", "#1a1f19"]);
  });

  it("the head script leaves system mode to the device", () => {
    document.cookie = `${THEME_COOKIE}=system; path=/`;
    new Function(THEME_SCRIPT)();
    expect(document.documentElement.className).toBe("");
  });

  it("applyTheme switches class, metas and cookie", () => {
    addThemeColorMetas();
    applyTheme("light");
    expect(document.documentElement.className).toBe("light");
    expect(metaColors()).toEqual(["#f7f9f6", "#f7f9f6"]);
    expect(themeFromCookieString(document.cookie)).toBe("light");

    applyTheme("system");
    expect(document.documentElement.className).toBe("");
    expect(metaColors()).toEqual(["#f7f9f6", "#1a1f19"]);
    expect(themeFromCookieString(document.cookie)).toBe("system");
  });
});
