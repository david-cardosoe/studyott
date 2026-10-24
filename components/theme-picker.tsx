"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { setThemeMode } from "@/app/(app)/settings/actions";
import { GENERIC_ERROR } from "@/lib/errors";
import { applyTheme, type ThemeMode } from "@/lib/theme";
import { toast } from "@/lib/toast";

const OPTIONS = [
  { mode: "system", label: "System", Icon: Monitor },
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
] as const;

/** System / Light / Dark. Applies instantly, then saves to the account. */
export function ThemePicker({ initial }: { initial: ThemeMode }) {
  const [mode, setMode] = useState(initial);
  const [, startTransition] = useTransition();

  function choose(next: ThemeMode) {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    applyTheme(next);
    startTransition(async () => {
      const result = await setThemeMode(next).catch(() => ({
        ok: false as const,
        error: GENERIC_ERROR,
      }));
      if (!result.ok) {
        setMode(previous);
        applyTheme(previous);
        toast({ title: "Couldn't save your theme", description: result.error });
      }
    });
  }

  return (
    <fieldset>
      <legend className="mb-2 font-medium">Theme</legend>
      <div className="inline-flex gap-1 rounded-xl border border-border bg-surface p-1">
        {OPTIONS.map(({ mode: value, label, Icon }) => (
          <label
            key={value}
            className={cn(
              "flex h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              mode === value
                ? "bg-nav-active text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={mode === value}
              onChange={() => choose(value)}
              className="sr-only"
            />
            <Icon className="size-4" aria-hidden />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
