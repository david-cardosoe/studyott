import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lifetime Overview" };

export default function LifetimePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2 px-4 py-8">
      <h1 className="text-2xl font-semibold">Lifetime Overview</h1>
      <p className="text-muted-foreground">
        Your total study time and per-subject totals will live here.
      </p>
    </main>
  );
}
