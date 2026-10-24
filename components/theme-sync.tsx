"use client";

import { useLayoutEffect } from "react";
import {
  applyTheme,
  showTheme,
  themeFromCookieString,
  type ThemeMode,
} from "@/lib/theme";

/**
 * Keeps the page in the right theme after hydration. With `mode` (the saved
 * setting, on signed-in pages) it also updates the cookie when the theme was
 * changed on another device. Without it, it re-applies the cookie's theme,
 * which React's dev-only Strict Mode remount strips from <html>.
 */
export function ThemeSync({ mode }: { mode?: ThemeMode }) {
  useLayoutEffect(() => {
    const cookieMode = themeFromCookieString(document.cookie);
    if (mode && mode !== cookieMode) applyTheme(mode);
    else showTheme(mode ?? cookieMode);
  }, [mode]);
  return null;
}
