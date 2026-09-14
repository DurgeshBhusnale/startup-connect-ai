import Link from "next/link";
import { redirect } from "next/navigation";

import { InboxIcon } from "@/components/icons";
import { IntroCard } from "@/components/intros/intro-card";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryButton } from "@/components/ui/retry-button";
import { getIntroQueue } from "@/lib/intros-api";
import { getMe } from "@/lib/me";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Intro queue" };

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full border px-4 py-2 text-small font-medium ${
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}

type IntrosPageProps = {
  searchParams: Promise<{ sector?: string }>;
};

export default async function IntrosPage({ searchParams }: IntrosPageProps) {
  const [me, { sector }] = await Promise.all([getMe(), searchParams]);
  if (!me.role) {
    redirect("/onboarding");
  }
  if (me.role === "founder") {
    redirect("/matches");
  }

  const result = await getIntroQueue();
  const items = result.status === "ok" ? result.items : [];
  const sectorCounts = new Map<string, number>();
  for (const item of items) {
    sectorCounts.set(item.sector, (sectorCounts.get(item.sector) ?? 0) + 1);
  }
  const activeSector = sector && sectorCounts.has(sector) ? sector : null;
  const visible = activeSector ? items.filter((item) => item.sector === activeSector) : items;
  const edit =
    me.role === "investor"
      ? { href: "/onboarding/investor", label: "Edit thesis" }
      : { href: "/onboarding/mentor", label: "Edit expertise" };

  return (
    <div className="mx-auto flex max-w-feed flex-col gap-6">
      <div className="flex flex-col gap-2 border-b border-line pb-6">
        <h1 className="font-heading text-h1 text-ink">Pending intros ({items.length})</h1>
        <p className="text-small text-muted">
          Founders who want to connect with you. Ranked by fit.
        </p>
      </div>

      {sectorCounts.size > 1 ? (
        <nav aria-label="Filter by sector" className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip href="/intros" active={!activeSector} label={`All (${items.length})`} />
          {[...sectorCounts.entries()].map(([name, count]) => (
            <FilterChip
              key={name}
              href={`/intros?sector=${encodeURIComponent(name)}`}
              active={activeSector === name}
              label={`${name} (${count})`}
            />
          ))}
        </nav>
      ) : null}

      {result.status === "unavailable" ? (
        <section className={`${cardStyles} flex flex-col items-center gap-4 p-6`}>
          <EmptyState
            icon={<InboxIcon className="h-8 w-8" />}
            title="Couldn’t load your intro queue"
            body="Something went wrong on our side. Try again in a moment."
          />
          <RetryButton />
        </section>
      ) : visible.length === 0 ? (
        <section className={`${cardStyles} flex flex-col items-center p-6`}>
          <EmptyState
            icon={<InboxIcon className="h-8 w-8" />}
            title="No pending intros right now"
            body="New requests will appear here as founders find you."
            action={{ href: "/matches", label: "Browse matches" }}
          />
          <Link
            href={edit.href}
            className="-mt-6 mb-6 rounded-md text-small font-medium text-emerald-deep hover:underline"
          >
            {edit.label}
          </Link>
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((item) => (
            <li key={item.intro_id}>
              <IntroCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
