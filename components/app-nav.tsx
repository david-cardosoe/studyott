"use client";

import { Menu } from "@base-ui/react/menu";
import { Menu as MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/history", label: "Weekly History" },
  { href: "/lifetime", label: "Lifetime Overview" },
  { href: "/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** The four top tabs; below 640px they collapse into a menu button. */
export function AppNav() {
  const pathname = usePathname();
  const current = TABS.find((tab) => isActive(pathname, tab.href));

  return (
    <nav aria-label="Main">
      <ul className="hidden items-center gap-1 sm:flex">
        {TABS.map((tab) => {
          const active = tab === current;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  focusRing,
                  active
                    ? "bg-nav-active text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <Menu.Root modal={false}>
        <Menu.Trigger
          className={cn(
            "flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted data-popup-open:bg-muted sm:hidden",
            focusRing,
          )}
        >
          <MenuIcon className="size-5" aria-hidden />
          <span>
            <span className="sr-only">Menu: </span>
            {current?.label ?? "Menu"}
          </span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={6} className="z-40">
            <Menu.Popup className="flex min-w-56 flex-col gap-1 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-lg transition-[opacity,transform] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              {TABS.map((tab) => {
                const active = tab === current;
                return (
                  <Menu.LinkItem
                    key={tab.href}
                    closeOnClick
                    render={<Link href={tab.href} />}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center rounded-lg px-3 text-base outline-none data-highlighted:bg-muted",
                      active &&
                        "bg-nav-active font-medium data-highlighted:bg-nav-active",
                    )}
                  >
                    {tab.label}
                  </Menu.LinkItem>
                );
              })}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </nav>
  );
}
