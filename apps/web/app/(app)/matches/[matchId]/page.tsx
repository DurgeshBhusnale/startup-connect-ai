import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ArrowLeftIcon, CalendarIcon, LockIcon, MapPinIcon } from "@/components/icons";
import { MatchActions } from "@/components/matches/match-actions";
import {
  MatchExplanationPanel,
  MatchExplanationSkeleton,
} from "@/components/matches/match-explanation-panel";
import { MatchOverview } from "@/components/matches/match-overview";
import { MessageThread } from "@/components/messages/message-thread";
import { PostTimeline } from "@/components/posts/post-timeline";
import { AskPinBanner } from "@/components/profile/ask-pin-banner";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { TrustBadge } from "@/components/profile/trust-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FitBadge } from "@/components/ui/fit-badge";
import { RetryButton } from "@/components/ui/retry-button";
import { getMatchDetail } from "@/lib/matches-api";
import { getMe } from "@/lib/me";
import { meetingShortDay, meetingTimeRange } from "@/lib/meetings";
import { getConversation } from "@/lib/messages-api";
import { getProfileEndorsements } from "@/lib/endorsements-api";
import { getProfilePosts } from "@/lib/posts-api";
import { cardStyles } from "@/lib/ui";

import type { ProfileTab } from "@/components/profile/profile-tabs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Match detail" };

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
  searchParams: Promise<{ tab?: string; cursor?: string }>;
};

export default async function MatchDetailPage({ params, searchParams }: MatchDetailPageProps) {
  const [{ matchId }, { tab, cursor }, me] = await Promise.all([params, searchParams, getMe()]);
  if (!me.role) {
    redirect("/onboarding");
  }
  const role = me.role;
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
  // Founders' posts (M4) appear on an Updates tab, visible only through this match.
  const hasUpdates = detail.details.kind === "founder";
  // S6 AC1: mutual matches get a Messages tab with their conversation.
  const canMessage = detail.state.connection === "accepted";
  const tabs: readonly ProfileTab[] = [
    { key: "overview", label: "Overview" },
    ...(hasUpdates ? [{ key: "activity", label: "Updates" }] : []),
    ...(canMessage ? [{ key: "messages", label: "Messages" }] : []),
    { key: "explain", label: "Explain this match" },
  ];
  const activeTab =
    tab === "explain"
      ? "explain"
      : tab === "activity" && hasUpdates
        ? "activity"
        : tab === "messages" && canMessage
          ? "messages"
          : "overview";
  const [posts, conversation, endorsements] = await Promise.all([
    activeTab === "activity" ? getProfilePosts(profile.profile_id, cursor) : Promise.resolve(null),
    activeTab === "messages" ? getConversation(detail.match_id) : Promise.resolve(null),
    hasUpdates && (activeTab === "overview" || activeTab === "activity")
      ? getProfileEndorsements(profile.profile_id)
      : Promise.resolve(null),
  ]);
  const firstName = profile.display_name.split(/\s+/)[0] || profile.display_name;
  const endorse = endorsements
    ? { profileId: profile.profile_id, firstName, data: endorsements }
    : undefined;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <BackLink />
      <AskPinBanner text={profile.ask_pin} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <aside className={`${cardStyles} flex flex-col items-center p-6 text-center`}>
          <ProfileAvatar name={profile.display_name} />
          <h1 className="mt-4 text-h2">{profile.display_name}</h1>
          <p className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-meta text-ink">
            {profile.headline}
          </p>
          <TrustBadge trust={profile.trust} variant="pill" className="mt-2" />
          {profile.location ? (
            <p className="mt-2 flex items-center gap-1 text-small text-muted">
              <MapPinIcon className="h-4 w-4" />
              {profile.location}
            </p>
          ) : null}
          <div className="mt-4">
            <FitBadge value={Math.round(detail.fit_score * 100)} />
          </div>
          <div className="mt-6 w-full text-left">
            <MatchActions
              matchId={detail.match_id}
              role={role}
              partnerName={profile.display_name}
              partnerHeadline={profile.headline}
              initialState={detail.state}
              layout="stacked"
            />
          </div>
          {detail.upcoming_meeting ? (
            <Link
              href={`/matches/${detail.match_id}/schedule`}
              className="mt-4 flex w-full items-center gap-3 rounded-md bg-slate-50 p-3 text-left hover:bg-slate-100"
            >
              <CalendarIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
              <span className="min-w-0">
                <span className="block font-mono text-meta uppercase tracking-wider text-muted">
                  Upcoming meeting
                </span>
                <span className="block text-small text-ink">
                  {meetingShortDay(detail.upcoming_meeting.scheduled_at)} ·{" "}
                  {meetingTimeRange(detail.upcoming_meeting)}
                </span>
              </span>
            </Link>
          ) : null}
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
            <MatchOverview
              details={detail.details}
              badges={detail.badges}
              endorse={endorse}
            />
          ) : activeTab === "activity" ? (
            posts ? (
              <PostTimeline
                posts={posts.items}
                nextCursor={posts.next_cursor}
                editable={false}
                basePath={`/matches/${detail.match_id}?tab=activity`}
                isFirstPage={!cursor}
                endorse={endorse}
                emptyTitle="No updates yet"
                emptyBody={`${firstName} hasn’t shared any updates yet.`}
              />
            ) : (
              <section className={`${cardStyles} p-6`}>
                <p className="text-small text-ink">Couldn’t load updates right now. Refresh to try again.</p>
              </section>
            )
          ) : activeTab === "messages" ? (
            conversation?.status === "ok" ? (
              <div className="flex flex-col gap-2">
                <div className={`${cardStyles} flex h-[36rem] flex-col overflow-hidden`}>
                  <MessageThread
                    thread={conversation.thread}
                    initialMessages={conversation.messages}
                    hasMore={conversation.hasMore}
                    variant="embedded"
                  />
                </div>
                <Link
                  href={`/messages/${detail.match_id}`}
                  className="self-end rounded-md text-small font-medium text-emerald-deep hover:underline"
                >
                  Open in Messages
                </Link>
              </div>
            ) : (
              <section className={`${cardStyles} flex flex-col items-start gap-4 p-6`}>
                <p className="text-small text-ink">Couldn’t load this conversation right now.</p>
                <RetryButton />
              </section>
            )
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
