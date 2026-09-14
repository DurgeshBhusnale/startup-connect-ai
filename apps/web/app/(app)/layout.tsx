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
  // PRD M10 AC6: during the 30-day grace period the only thing left to do is restore or leave.
  if (me.hard_delete_at) {
    redirect("/account-deletion");
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
        unreadMessages: summary.unread_messages ?? 0,
      }}
    >
      {children}
    </AppShell>
  );
}
