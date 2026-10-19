import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { DevLoginForm } from "@/components/dev-login-form";
import { GoogleIcon } from "@/components/google-icon";
import { isDevLoginEnabled } from "@/lib/dev-login";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  auth: "Sign-in didn't finish. Please try again.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/brand/mascot.svg"
            alt=""
            width={88}
            height={88}
            priority
            unoptimized
          />
          <h1 className="text-3xl font-semibold tracking-tight">StudyOtt</h1>
          <p className="text-muted-foreground">
            Time your study sessions and watch the hours add up.
          </p>
        </div>

        <Suspense>
          <LoginError searchParams={searchParams} />
        </Suspense>

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-input bg-surface px-4 text-base font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <GoogleIcon className="size-5" />
            Continue with Google
          </button>
        </form>

        {isDevLoginEnabled() && (
          <div className="border-t border-border pt-6">
            <DevLoginForm />
          </div>
        )}
      </div>
    </main>
  );
}

async function LoginError({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
    >
      {message}
    </p>
  );
}
