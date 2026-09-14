import Link from "next/link";

import { ArrowLeftIcon, CalendarIcon, ClockIcon, LockIcon } from "@/components/icons";
import { MeetingOutcomeForm } from "@/components/meetings/meeting-outcome-form";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryButton } from "@/components/ui/retry-button";
import { firstNameOf } from "@/lib/feedback";
import { getMeetingOutcomeContext } from "@/lib/meetings-api";
import { meetingDay, meetingTimeRange } from "@/lib/meetings";
import { cardStyles, eyebrowStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Meeting outcome" };

type OutcomePageProps = {
  params: Promise<{ meetingId: string }>;
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

export default async function MeetingOutcomePage({ params }: OutcomePageProps) {
  const { meetingId } = await params;
  const result = await getMeetingOutcomeContext(meetingId);

  if (result.status !== "ok") {
    return (
      <div className="mx-auto flex max-w-onboarding flex-col gap-6">
        <BackLink href="/notifications" label="Notifications" />
        <section className={`${cardStyles} flex flex-col items-center gap-4 p-6`}>
          {result.status === "missing" ? (
            <EmptyState
              icon={<LockIcon className="h-8 w-8" />}
              title="Meeting not found"
              body="This meeting doesn’t exist or isn’t one of yours."
              action={{ href: "/matches", label: "Back to matches" }}
            />
          ) : (
            <>
              <EmptyState
                icon={<LockIcon className="h-8 w-8" />}
                title="Couldn’t load this meeting"
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
  const { meeting, partner } = context;
  const first = firstNameOf(partner.display_name);
  const backHref = context.match_id ? `/matches/${context.match_id}` : "/matches";
  const backLabel = context.match_id ? "Back to match" : "Back to matches";

  return (
    <div className="mx-auto flex max-w-onboarding flex-col gap-6">
      <BackLink href={backHref} label={backLabel} />
      <header className="flex flex-col gap-2">
        <p className={eyebrowStyles}>Meeting outcome</p>
        <h1 className="font-heading text-h1 text-ink">How did your meeting with {first} go?</h1>
      </header>

      <section className={`${cardStyles} flex items-center gap-4 p-4`} aria-label="Meeting">
        <ProfileAvatar name={partner.display_name} />
        <div className="min-w-0">
          <p className="text-small font-medium text-ink">{partner.display_name}</p>
          <p className="truncate text-meta text-muted">{partner.headline}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-4 w-4 text-muted" />
              {meetingDay(meeting.scheduled_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-4 w-4 text-muted" />
              {meetingTimeRange(meeting)}
            </span>
          </p>
        </div>
      </section>

      {context.can_submit ? (
        <MeetingOutcomeForm
          meetingId={meeting.meeting_id}
          partnerFirstName={first}
          initialOutcome={context.my_outcome}
          initialNotes={context.my_notes}
          backHref={backHref}
          backLabel={backLabel}
        />
      ) : (
        <section className={`${cardStyles} flex flex-col items-center gap-4 p-6`}>
          <EmptyState
            icon={<ClockIcon className="h-8 w-8" />}
            title="This meeting hasn’t happened yet"
            body="You can log how it went once the meeting has started. We’ll remind you afterwards."
            action={{ href: backHref, label: backLabel }}
          />
        </section>
      )}
    </div>
  );
}
