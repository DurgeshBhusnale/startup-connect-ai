import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { BellIcon, SearchIcon } from "@/components/icons";

import { BottomTabs, Breadcrumb, MobileNav, SidebarNav } from "./app-nav";

import type { ReactNode } from "react";

type AppShellProps = {
  displayName: string;
  roleLabel: string;
  children: ReactNode;
};

function initialsFor(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "SC";
}

export function AppShell({ displayName, roleLabel, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-sidebar shrink-0 flex-col bg-ink lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="px-6 py-6">
          <Logo tone="light" href="/home" />
        </div>
        <SidebarNav />
        <div className="mt-auto p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-deep text-meta font-semibold text-white"
              aria-hidden="true"
            >
              {initialsFor(displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-small font-medium text-white">{displayName}</p>
              <p className="text-meta text-white/60">{roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-white">
          <div className="flex items-center justify-between gap-4 px-4 py-2 lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <MobileNav displayName={displayName} roleLabel={roleLabel} />
              <Link href="/home" className="rounded-md leading-tight">
                <span className="block font-heading text-base font-semibold text-ink">
                  Startup Connect
                </span>
                <span className="block font-mono text-meta uppercase tracking-wider text-emerald-deep">
                  AI Platform
                </span>
              </Link>
            </div>
            <Breadcrumb />
            <div className="flex items-center gap-2">
              <Link
                href="/search"
                className="hidden items-center gap-2 rounded-md border border-line bg-slate-50 px-3 py-2 text-small text-muted hover:border-muted md:flex"
              >
                <SearchIcon />
                Find investors, founders…
              </Link>
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="flex h-12 w-12 items-center justify-center rounded-md text-ink hover:bg-slate-50"
              >
                <BellIcon className="h-6 w-6" />
              </Link>
              <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      <BottomTabs />
    </div>
  );
}
