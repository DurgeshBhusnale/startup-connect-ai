import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

import { ArrowLeftIcon, CheckIcon, LockIcon, MapPinIcon } from "@/components/icons";
import { MeetingScheduler } from "@/components/meetings/meeting-scheduler";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryButton } from "@/components/ui/retry-button";
import { firstNameOf } from "@/lib/feedback";
import { getSchedulingContext } from "@/lib/meetings-api";
import { cardStyles, eyebrowStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Schedule a meeting" };

type SchedulePageProps = {
  params: Promise<{ matchId: string }>;
};

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 self-start rounded-md text-small font-medium text-emerald-deep hover:underline"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export default async function SchedulePage({ params }: SchedulePageProps) {
  const { matchId } = await params;
  const [result, user] = await Promise.all([getSchedulingContext(matchId), currentUser()]);

  if (result.status !== "ok") {
    return (
      <div className="mx-auto flex max-w-content flex-col gap-6">
        <BackLink href="/matches" label="Matches" />
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
                title="Couldn’t load scheduling"
                body="Something went wrong on our side. Try again in a moment."
              />
              <RetryButton />
            </>
          )}
        </section>
      </div>
    );
  }

  const { context } = result;
  const partner = context.partner;
  const first = firstNameOf(partner.display_name);
  const myName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "You";
  const myEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const matchHref = `/matches/${context.match_id}`;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <BackLink href={matchHref} label="Back to match" />
      <header className="flex flex-col gap-2">
        <p className={eyebrowStyles}>Schedule a meeting</p>
        <h1 className="font-heading text-h1 text-ink">Meet {first}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <aside className={`${cardStyles} flex flex-col items-center p-6 text-center`}>
          <ProfileAvatar name={partner.display_name} />
          <h2 className="mt-4 text-h3">{partner.display_name}</h2>
          <p className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-meta text-ink">
            {partner.headline}
          </p>
          {partner.location ? (
            <p className="mt-2 flex items-center gap-1 text-small text-muted">
              <MapPinIcon className="h-4 w-4" />
              {partner.location}
            </p>
          ) : null}
          {context.can_schedule ? (
            <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald/10 px-3 py-2 text-small font-medium text-emerald-deep">
              <CheckIcon className="h-4 w-4" />
              Mutual match
            </p>
          ) : null}
        </aside>

        <div className="min-w-0">
          {context.can_schedule ? (
            <MeetingScheduler context={context} myName={myName} myEmail={myEmail} />
          ) : (
            <section className={`${cardStyles} flex flex-col items-center gap-4 p-6`}>
              <EmptyState
                icon={<LockIcon className="h-8 w-8" />}
                title="Connect first"
                body={`You can schedule a meeting once you and ${first} are a mutual match.`}
                action={{ href: matchHref, label: "Back to match" }}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
