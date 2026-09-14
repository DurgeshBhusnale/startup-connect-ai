import Link from "next/link";
import { Suspense } from "react";

import { ArrowLeftIcon, LockIcon, MapPinIcon } from "@/components/icons";
import {
  MatchExplanationPanel,
  MatchExplanationSkeleton,
} from "@/components/matches/match-explanation-panel";
import { MatchOverview } from "@/components/matches/match-overview";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { FitBadge } from "@/components/ui/fit-badge";
import { RetryButton } from "@/components/ui/retry-button";
import { getMatchDetail } from "@/lib/matches-api";
import { cardStyles } from "@/lib/ui";

import type { ProfileTab } from "@/components/profile/profile-tabs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Match detail" };

const tabs: readonly ProfileTab[] = [
  { key: "overview", label: "Overview" },
  { key: "explain", label: "Explain this match" },
];

function BackLink() {
  return (
    <Link
      href="/matches"
      className="inline-flex items-center gap-2 self-start rounded-md text-small font-medium text-emerald-deep hover:underline"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Matches
    </Link>
  );
}

type MatchDetailPageProps = {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function MatchDetailPage({ params, searchParams }: MatchDetailPageProps) {
  const [{ matchId }, { tab }] = await Promise.all([params, searchParams]);
  const result = await getMatchDetail(matchId);

  if (result.status !== "ok") {
    return (
      <div className="mx-auto flex max-w-content flex-col gap-6">
        <BackLink />
        <section className={`${cardStyles} flex flex-col items-center gap-4 p-6`}>
          {result.status === "private" ? (
            <EmptyState
              icon={<LockIcon className="h-8 w-8" />}
              title="This profile is private"
              body="Profiles are only visible to people who have been matched with each other."
              action={{ href: "/matches", label: "Back to matches" }}
            />
          ) : (
            <>
              <EmptyState
                icon={<LockIcon className="h-8 w-8" />}
                title="Couldn’t load this match"
                body="Something went wrong on our side. Try again in a moment."
              />
              <RetryButton />
            </>
          )}
        </section>
      </div>
    );
  }

  const { detail } = result;
  const profile = detail.to_profile;
  const activeTab = tab === "explain" ? "explain" : "overview";
  const firstName = profile.display_name.split(/\s+/)[0] || profile.display_name;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <BackLink />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <aside className={`${cardStyles} flex flex-col items-center p-6 text-center`}>
          <ProfileAvatar name={profile.display_name} />
          <h1 className="mt-4 text-h2">{profile.display_name}</h1>
          <p className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-meta text-ink">
            {profile.headline}
          </p>
          {profile.location ? (
            <p className="mt-2 flex items-center gap-1 text-small text-muted">
              <MapPinIcon className="h-4 w-4" />
              {profile.location}
            </p>
          ) : null}
          <div className="mt-4">
            <FitBadge value={Math.round(detail.fit_score * 100)} />
          </div>
          {profile.bio ? <p className="mt-4 text-small text-ink">{profile.bio}</p> : null}
          {profile.facts.length > 0 ? (
            <ul className="mt-6 w-full divide-y divide-line rounded-md border border-line text-left">
              {profile.facts.map((fact) => (
                <li key={fact} className="px-4 py-3 text-small text-ink">
                  {fact}
                </li>
              ))}
            </ul>
          ) : null}
          {activeTab === "overview" ? (
            <Link
              href={`/matches/${detail.match_id}?tab=explain`}
              scroll={false}
              className="mt-6 rounded-md text-small font-medium text-emerald-deep hover:underline"
            >
              Why this match?
            </Link>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <ProfileTabs
            tabs={tabs}
            active={activeTab}
            basePath={`/matches/${detail.match_id}`}
            label="Match sections"
          />
          {activeTab === "overview" ? (
            <MatchOverview details={detail.details} badges={detail.badges} />
          ) : (
            <Suspense fallback={<MatchExplanationSkeleton />}>
              <MatchExplanationPanel
                matchId={detail.match_id}
                firstName={firstName}
                fitScore={detail.fit_score}
                updatedAt={detail.updated_at}
                scoring={detail.scoring}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
