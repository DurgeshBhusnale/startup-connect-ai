import Link from "next/link";

import { LockIcon, ShieldCheckIcon } from "@/components/icons";

import type { ReactNode } from "react";

type AuthTab = "sign-in" | "sign-up";

const tabs: Record<AuthTab, { href: string; label: string }> = {
  "sign-up": { href: "/sign-up", label: "Sign up" },
  "sign-in": { href: "/sign-in", label: "Sign in" },
};

type AuthCardProps = {
  badge: string;
  badgeAside: string;
  title: string;
  subtitle: string;
  align?: "left" | "center";
  leadingIcon?: ReactNode;
  activeTab?: AuthTab;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthCard({
  badge,
  badgeAside,
  title,
  subtitle,
  align = "left",
  leadingIcon,
  activeTab,
  footer,
  children,
}: AuthCardProps) {
  const tabOrder: AuthTab[] = activeTab === "sign-in" ? ["sign-in", "sign-up"] : ["sign-up", "sign-in"];

  return (
    <section
      aria-labelledby="auth-card-title"
      className="w-full max-w-auth-card overflow-hidden rounded-lg border border-line bg-white shadow-card"
    >
      <div className="px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between gap-4 font-mono text-meta uppercase tracking-wider">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald/5 px-2 py-1 text-emerald-deep">
            <span className="h-2 w-2 rounded-full bg-emerald-bright" aria-hidden="true" />
            {badge}
          </span>
          <span className="inline-flex items-center gap-1 text-muted">
            <LockIcon className="h-4 w-4" />
            {badgeAside}
          </span>
        </div>

        <div className={align === "center" ? "text-center" : undefined}>
          {leadingIcon ? (
            <span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-emerald-deep">
              {leadingIcon}
            </span>
          ) : null}
          <h1 id="auth-card-title" className="mt-6">
            {title}
          </h1>
          <p className="mt-2 text-small text-muted">{subtitle}</p>
        </div>

        {activeTab ? (
          <nav aria-label="Account" className="mt-6 grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
            {tabOrder.map((tab) => {
              const active = tab === activeTab;
              return (
                <Link
                  key={tab}
                  href={tabs[tab].href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-2 text-center text-small font-medium text-ink transition ${
                    active ? "bg-white shadow-card" : "hover:bg-white/60"
                  }`}
                >
                  {tabs[tab].label}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="mt-6">{children}</div>
      </div>

      {footer ? (
        <div className="border-t border-line bg-slate-50 px-6 py-4 text-center sm:px-8">{footer}</div>
      ) : null}
    </section>
  );
}

export function PrivacyNote() {
  return (
    <p className="flex items-center justify-center gap-2 font-mono text-meta text-muted">
      <ShieldCheckIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
      Your data is only used to compute matches. Never sold.
    </p>
  );
}
