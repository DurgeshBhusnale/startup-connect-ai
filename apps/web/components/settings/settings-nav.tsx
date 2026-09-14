"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

import { BellIcon, ChevronDownIcon, ShieldCheckIcon, UserIcon } from "@/components/icons";
import { cardStyles } from "@/lib/ui";

import type { IconComponent } from "@/components/icons";

type SettingsItem = { href: string; label: string; icon: IconComponent };

// Billing (SHOULD tier) joins this list when payments ship.
const items: readonly SettingsItem[] = [
  { href: "/settings/account", label: "Account", icon: UserIcon },
  { href: "/settings/notifications", label: "Notifications", icon: BellIcon },
  { href: "/settings/privacy", label: "Privacy & Data", icon: ShieldCheckIcon },
];

export function SettingsNav() {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const active = items.find((item) => pathname.startsWith(item.href)) ?? items[0];

  const links = (onNavigate?: () => void) =>
    items.map((item) => {
      const isActive = item.href === active?.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive ? "page" : undefined}
          className={`flex items-center gap-3 rounded-md border-l-4 px-3 py-3 text-small font-medium ${
            isActive
              ? "border-emerald-deep bg-emerald/10 text-ink"
              : "border-transparent text-ink hover:bg-slate-50"
          }`}
        >
          <item.icon className="h-4 w-4 text-muted" />
          {item.label}
        </Link>
      );
    });

  return (
    <>
      <details ref={detailsRef} className={`${cardStyles} group lg:hidden`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-small [&::-webkit-details-marker]:hidden">
          <span>
            <span className="font-mono text-meta uppercase tracking-wider text-muted">Section: </span>
            <span className="font-medium text-ink">{active?.label}</span>
          </span>
          <ChevronDownIcon className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <nav aria-label="Settings sections" className="flex flex-col gap-1 border-t border-line p-2">
          {links(() => {
            if (detailsRef.current) detailsRef.current.open = false;
          })}
        </nav>
      </details>
      <nav aria-label="Settings sections" className={`${cardStyles} hidden flex-col gap-1 p-2 lg:flex`}>
        {links()}
      </nav>
    </>
  );
}
