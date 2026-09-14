"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Logo } from "@/components/brand/logo";
import {
  BellIcon,
  CircleUserIcon,
  HomeIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MenuIcon,
  MessageSquareIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  UserIcon,
  XIcon,
} from "@/components/icons";

import type { IconComponent } from "@/components/icons";
import type { AppRole } from "@/lib/api-types";

export type NavBadges = {
  unreadNotifications: number;
  pendingIntros: number;
  unreadMessages: number;
};

type NavItem = {
  href: string;
  label: string;
  icon: IconComponent;
  badge?: keyof NavBadges;
};

function sidebarItemsFor(role: AppRole): readonly NavItem[] {
  return [
    { href: "/home", label: "Home", icon: LayoutDashboardIcon },
    { href: "/profile", label: "My Profile", icon: UserIcon },
    { href: "/matches", label: "Matches", icon: SparklesIcon },
    ...(role === "founder"
      ? []
      : [{ href: "/intros", label: "Intro queue", icon: InboxIcon, badge: "pendingIntros" as const }]),
    { href: "/messages", label: "Messages", icon: MessageSquareIcon, badge: "unreadMessages" },
    { href: "/search", label: "Search", icon: SearchIcon },
    { href: "/notifications", label: "Notifications", icon: BellIcon, badge: "unreadNotifications" },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];
}

function tabItemsFor(role: AppRole): readonly NavItem[] {
  return [
    { href: "/home", label: "Home", icon: HomeIcon },
    { href: "/matches", label: "Matches", icon: SparklesIcon },
    role === "founder"
      ? { href: "/messages", label: "Messages", icon: MessageSquareIcon, badge: "unreadMessages" }
      : { href: "/intros", label: "Queue", icon: InboxIcon, badge: "pendingIntros" },
    { href: "/profile", label: "Profile", icon: CircleUserIcon },
  ];
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function badgeText(count: number): string {
  return count > 99 ? "99+" : String(count);
}

type SidebarNavProps = { role: AppRole; badges: NavBadges; onNavigate?: () => void };

export function SidebarNav({ role, badges, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  return (
    <nav aria-label="App" className="flex flex-col gap-1 px-4">
      {sidebarItemsFor(role).map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.badge ? badges[item.badge] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-small font-medium transition-colors ${
              active ? "bg-slate-100 text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {count > 0 ? (
              <span
                className={`rounded-full px-2 font-mono text-meta ${
                  active ? "bg-ink text-white" : "bg-emerald-bright text-ink"
                }`}
              >
                <span className="sr-only">(</span>
                {badgeText(count)}
                <span className="sr-only"> new)</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Breadcrumb({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const current =
    sidebarItemsFor(role).find((item) => isActive(pathname, item.href))?.label ?? "Home";
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-small lg:flex">
      <span className="text-muted">Workspace</span>
      <span className="text-muted" aria-hidden="true">
        /
      </span>
      <span className="font-heading font-semibold text-ink" aria-current="page">
        {current}
      </span>
    </nav>
  );
}

type MobileNavProps = {
  displayName: string;
  roleLabel: string;
  role: AppRole;
  badges: NavBadges;
};

export function MobileNav({ displayName, roleLabel, role, badges }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="app-drawer"
        onClick={() => setOpen(true)}
        className="flex h-12 w-12 items-center justify-center rounded-md text-ink hover:bg-slate-50"
      >
        <MenuIcon className="h-6 w-6" />
      </button>
      {open ? (
        <div
          id="app-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-50 lg:hidden"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 bg-ink/40"
            onClick={close}
          />
          <div className="relative flex h-full w-sidebar flex-col bg-ink py-4">
            <div className="flex items-center justify-between pb-4 pl-4 pr-2">
              <Logo tone="light" href="/home" />
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close navigation"
                onClick={close}
                className="flex h-12 w-12 items-center justify-center rounded-md text-white hover:bg-white/10"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>
            <SidebarNav role={role} badges={badges} onNavigate={close} />
            <p className="mt-auto px-6 pt-4 text-meta text-white/60">
              {displayName} · {roleLabel}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function BottomTabs({ role, badges }: { role: AppRole; badges: NavBadges }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white lg:hidden"
    >
      {tabItemsFor(role).map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.badge ? badges[item.badge] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-meta ${
              active ? "font-medium text-emerald-deep" : "text-muted"
            }`}
          >
            <span className="relative">
              <item.icon className="h-6 w-6" />
              {count > 0 ? (
                <span className="absolute -right-2 -top-1 rounded-full bg-emerald-bright px-1 font-mono text-meta leading-none text-ink">
                  <span className="sr-only">(</span>
                  {badgeText(count)}
                  <span className="sr-only"> new)</span>
                </span>
              ) : null}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
