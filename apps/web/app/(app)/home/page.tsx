import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SparklesIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { Greeting } from "@/components/ui/greeting";
import { getMe } from "@/lib/me";
import { homeCopy } from "@/lib/roles";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const [me, user] = await Promise.all([getMe(), currentUser()]);
  if (!me.role) {
    redirect("/onboarding");
  }
  const copy = homeCopy[me.role];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <div className="flex flex-col gap-2 border-b border-line pb-6">
        <Greeting firstName={user?.firstName ?? null} />
        <p className="text-small text-muted">{copy.subtitle}</p>
      </div>
      <section className={`${cardStyles} p-6`}>
        <EmptyState
          icon={<SparklesIcon className="h-8 w-8" />}
          title={copy.emptyTitle}
          body={copy.emptyBody}
          action={{ href: "/profile", label: copy.cta }}
        />
      </section>
    </div>
  );
}
