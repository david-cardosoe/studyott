import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser, isOnboarded } from "@/lib/auth";

// Every signed-in page. proxy.ts already sends signed-out visitors to /login;
// this re-checks the session and sends new users to the one-time Welcome page.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Loading…</p>}>
      <SignedInGate>{children}</SignedInGate>
    </Suspense>
  );
}

async function SignedInGate({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!(await isOnboarded(user.id))) redirect("/welcome");

  // Placeholder header; Phase 3 replaces it with the tab nav.
  return (
    <>
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-1">
        <span className="text-lg font-semibold">StudyOtt</span>
        <SignOutButton />
      </header>
      {children}
    </>
  );
}
