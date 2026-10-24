import Image from "next/image";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-backdrop-filter:bg-surface/80">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-1.5">
        <Link
          href="/"
          className="flex h-11 items-center gap-2 rounded-lg pr-2 text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Image
            src="/brand/mascot.svg"
            alt=""
            width={32}
            height={32}
            unoptimized
          />
          StudyOtt
        </Link>
        <AppNav />
      </div>
    </header>
  );
}
