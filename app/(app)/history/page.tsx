import type { Metadata } from "next";

export const metadata: Metadata = { title: "Weekly History" };

export default function HistoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2 px-4 py-8">
      <h1 className="text-2xl font-semibold">Weekly History</h1>
      <p className="text-muted-foreground">
        Every week you studied will show up here, newest first.
      </p>
    </main>
  );
}
