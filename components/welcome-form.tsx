"use client";

import { useActionState, useEffect, useState } from "react";
import { completeWelcome } from "@/app/welcome/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { USERNAME_PATTERN, type UsernameStatus } from "@/lib/username";

type Status = UsernameStatus | "yours" | "checking";

const STATUS_TEXT: Record<Status, string> = {
  yours: "This is your current username.",
  checking: "Checking…",
  available: "Available!",
  taken: "That username is taken.",
  reserved: "That username isn't available.",
  invalid:
    "3 to 20 characters: letters, numbers and _, starting with a letter.",
};

const CHECK_DELAY_MS = 350;

export function WelcomeForm({ username }: { username: string }) {
  const [state, formAction, pending] = useActionState(completeWelcome, null);
  const [value, setValue] = useState(username);
  const [checked, setChecked] = useState<{
    name: string;
    status: UsernameStatus;
  } | null>(null);

  const name = value.trim().toLowerCase();
  const localStatus: Status | null =
    name === username
      ? "yours"
      : !USERNAME_PATTERN.test(name)
        ? "invalid"
        : null;
  const status: Status =
    localStatus ?? (checked?.name === name ? checked.status : "checking");

  // Live availability check, debounced; only for names that pass the format.
  useEffect(() => {
    if (localStatus) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const { data, error } = await createClient().rpc("username_available", {
        p_username: name,
      });
      if (!stale && !error)
        setChecked({ name, status: data as UsernameStatus });
    }, CHECK_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [name, localStatus]);

  const blocked =
    status === "invalid" || status === "taken" || status === "reserved";
  const statusTone = blocked
    ? "text-destructive"
    : status === "available"
      ? "text-accent-text"
      : "text-muted-foreground";

  return (
    <form
      action={(formData) => {
        // The browser's timezone becomes the user's default (changeable in Settings).
        formData.set(
          "timezone",
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
        formAction(formData);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <div className="flex h-11 items-center rounded-lg border border-input bg-surface px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="text-muted-foreground" aria-hidden="true">
            @
          </span>
          <input
            id="username"
            name="username"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            required
            aria-invalid={blocked}
            aria-describedby="username-status"
            className="h-full w-full min-w-0 bg-transparent pl-0.5 text-base text-foreground outline-none"
          />
        </div>
        <p
          id="username-status"
          aria-live="polite"
          className={`text-sm ${statusTone}`}
        >
          {STATUS_TEXT[status]}
        </p>
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending || blocked}
        className="h-11 text-base"
      >
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
