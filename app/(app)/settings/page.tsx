import type { Metadata } from "next";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemePicker } from "@/components/theme-picker";
import { getCurrentUser, getUserSettings } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Profile, preferences, subjects and your data will live here.
        </p>
      </div>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <Suspense
          fallback={<p className="h-[76px] text-muted-foreground">Loading…</p>}
        >
          <Theme />
        </Suspense>
      </section>
      <div>
        <SignOutButton />
      </div>
    </main>
  );
}

async function Theme() {
  const user = await getCurrentUser();
  const { theme_mode } = await getUserSettings(user.id);
  return <ThemePicker initial={theme_mode} />;
}
