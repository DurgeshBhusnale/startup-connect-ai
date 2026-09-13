import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getMe } from "@/lib/me";
import { roleLabels } from "@/lib/roles";

import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [me, user] = await Promise.all([getMe(), currentUser()]);
  if (!me.onboarded || !me.role) {
    redirect("/onboarding");
  }

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Your account";

  return (
    <AppShell displayName={displayName} roleLabel={roleLabels[me.role]}>
      {children}
    </AppShell>
  );
}
