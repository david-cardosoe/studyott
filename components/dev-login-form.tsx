"use client";

import { useActionState } from "react";
import { devSignIn } from "@/app/(public)/login/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-surface px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function DevLoginForm() {
  const [state, formAction, pending] = useActionState(devSignIn, null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      aria-labelledby="dev-login-title"
    >
      <h2
        id="dev-login-title"
        className="text-sm font-medium text-muted-foreground"
      >
        Local test login (development only)
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue="test1@studyott.local"
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="h-11 text-base"
      >
        {pending ? "Signing in…" : "Sign in with test account"}
      </Button>
    </form>
  );
}
