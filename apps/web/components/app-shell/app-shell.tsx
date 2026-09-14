import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { BellIcon, SearchIcon } from "@/components/icons";
import { initialsOf } from "@/lib/feedback";

import { BottomTabs, Breadcrumb, MobileNav, SidebarNav } from "./app-nav";
import { OfflineBanner } from "./offline-banner";

import type { NavBadges } from "./app-nav";
import type { AppRole } from "@/lib/api-types";
import type { ReactNode } from "react";

type AppShellProps = {
  displayName: string;
  roleLabel: string;
  role: AppRole;
  badges: NavBadges;
  children: ReactNode;
};

export function AppShell({ displayName, roleLabel, role, badges, children }: AppShellProps) {
  const unread = badges.unreadNotifications;
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-sidebar shrink-0 flex-col bg-ink lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="px-6 py-6">
          <Logo tone="light" href="/home" />
        </div>
        <SidebarNav role={role} badges={badges} />
        <div className="mt-auto p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-deep text-meta font-semibold text-white"
              aria-hidden="true"
            >
              {initialsOf(displayName)}
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
          <OfflineBanner />
          <div className="flex items-center justify-between gap-4 px-4 py-2 lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <MobileNav
                displayName={displayName}
                roleLabel={roleLabel}
                role={role}
                badges={badges}
              />
              <Link href="/home" className="rounded-md leading-tight">
                <span className="block font-heading text-base font-semibold text-ink">
                  Startup Connect
                </span>
                <span className="block font-mono text-meta uppercase tracking-wider text-emerald-deep">
                  AI Platform
                </span>
              </Link>
            </div>
            <Breadcrumb role={role} />
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
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                className="relative flex h-12 w-12 items-center justify-center rounded-md text-ink hover:bg-slate-50"
              >
                <BellIcon className="h-6 w-6" />
                {unread > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-bright ring-2 ring-white"
                  />
                ) : null}
              </Link>
              <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      <BottomTabs role={role} badges={badges} />
    </div>
  );
}
