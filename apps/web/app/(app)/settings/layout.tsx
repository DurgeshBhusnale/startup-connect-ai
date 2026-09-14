import { currentUser } from "@clerk/nextjs/server";

import { SettingsNav } from "@/components/settings/settings-nav";
import { initialsOf } from "@/lib/feedback";
import { getMe } from "@/lib/me";
import { roleLabels } from "@/lib/roles";
import { cardStyles } from "@/lib/ui";

import type { ReactNode } from "react";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const [me, user] = await Promise.all([getMe(), currentUser()]);
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Your account";

  return (
    <div className="mx-auto grid max-w-content gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:items-start">
      <aside className="flex flex-col gap-4">
        <div className={`${cardStyles} hidden items-center gap-3 p-4 lg:flex`}>
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink font-heading text-base text-white"
          >
            {initialsOf(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-small font-semibold text-ink">{name}</p>
            {me.role ? <p className="text-meta text-muted">{roleLabels[me.role]}</p> : null}
          </div>
        </div>
        <SettingsNav />
      </aside>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}
