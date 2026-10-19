import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WelcomeForm } from "@/components/welcome-form";
import { getCurrentUser, isOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Welcome" };

// One-time page after the first sign-in (requirements §10). Lives outside
// (app) because that layout redirects un-onboarded users here.
export default function WelcomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/brand/mascot.svg"
            alt=""
            width={72}
            height={72}
            priority
            unoptimized
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to StudyOtt
          </h1>
        </div>
        <Suspense
          fallback={
            <p className="text-center text-muted-foreground">Loading…</p>
          }
        >
          <Welcome />
        </Suspense>
      </div>
    </main>
  );
}

async function Welcome() {
  const user = await getCurrentUser();
  if (await isOnboarded(user.id)) redirect("/");

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", user.id)
    .single();
  if (error) throw error;

  return (
    <>
      <p className="text-center">
        You&apos;re{" "}
        <strong className="font-semibold">@{profile.username}</strong>. Want a
        different username?
      </p>
      <WelcomeForm username={profile.username} />
    </>
  );
}
