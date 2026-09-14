import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getMe } from "@/lib/me";
import { getNotificationSummary } from "@/lib/notifications-api";
import { roleLabels } from "@/lib/roles";

import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [me, user, summary] = await Promise.all([
    getMe(),
    currentUser(),
    getNotificationSummary(),
  ]);
  if (!me.onboarded || !me.role) {
    redirect("/onboarding");
  }

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Your account";

  return (
    <AppShell
      displayName={displayName}
      roleLabel={roleLabels[me.role]}
      role={me.role}
      badges={{
        unreadNotifications: summary.unread_count,
        pendingIntros: summary.pending_intros,
      }}
    >
      {children}
    </AppShell>
  );
}
