import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { ThemeSync } from "@/components/theme-sync";
import { getCurrentUser, getUserSettings } from "@/lib/auth";

// Every signed-in page. proxy.ts already sends signed-out visitors to /login
// and new users to /welcome; this re-checks both as the authoritative gate.
// The header is outside the gate so it is part of the static shell.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <Suspense
        fallback={<p className="p-6 text-muted-foreground">Loading…</p>}
      >
        <SignedInGate>{children}</SignedInGate>
      </Suspense>
    </>
  );
}

async function SignedInGate({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const settings = await getUserSettings(user.id);
  if (settings.onboarded_at === null) redirect("/welcome");

  return (
    <>
      <ThemeSync mode={settings.theme_mode} />
      {children}
    </>
  );
}
