// Theme modes (user_settings.theme_mode). The saved mode is mirrored in a
// cookie that an inline <head> script reads, so the right theme is applied
// before first paint without the root layout reading cookies on the server.
// No class on <html> means "follow the device" (see app/globals.css).

export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_COOKIE = "studyott-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Matches --background in app/globals.css; used for <meta name="theme-color">.
export const THEME_COLORS = { light: "#f7f9f6", dark: "#1a1f19" } as const;

export function parseThemeMode(value: unknown): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode)
    ? (value as ThemeMode)
    : "system";
}

/** Reads the theme cookie from a `document.cookie`-style string. */
export function themeFromCookieString(cookie: string): ThemeMode {
  const match = cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  return parseThemeMode(match?.[1]);
}

// Runs in <head> during HTML parsing. Keep it tiny and ES5. A forced mode
// also pins the theme-color meta tags (they otherwise follow the device);
// those may come after the script, so it fixes them again once parsed.
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(!m)return;var t=m[1];document.documentElement.classList.add(t);var f=function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.setAttribute("content",${JSON.stringify(THEME_COLORS)}[t])})};f();document.addEventListener("DOMContentLoaded",f)}catch(e){}})()`;

/** Shows a mode on the client: the <html> class and theme-color tags. */
export function showTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (mode !== "system") root.classList.add(mode);

  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const forDark = (meta.getAttribute("media") ?? "").includes("dark");
    const color =
      mode === "system"
        ? THEME_COLORS[forDark ? "dark" : "light"]
        : THEME_COLORS[mode];
    meta.setAttribute("content", color);
  });
}

/** Shows a mode and remembers it in the cookie for the next page load. */
export function applyTheme(mode: ThemeMode) {
  showTheme(mode);
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
}

/** Cookie options for setting the theme cookie from the server. */
export const themeCookieOptions = {
  path: "/",
  maxAge: THEME_COOKIE_MAX_AGE,
  sameSite: "lax",
  // The inline script must read it, so it can't be httpOnly. Not a secret.
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
} as const;
