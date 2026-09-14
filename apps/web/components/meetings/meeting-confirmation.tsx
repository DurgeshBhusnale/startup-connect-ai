"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CalendarIcon, CircleCheckIcon, DownloadIcon, GlobeIcon } from "@/components/icons";
import { googleCalendarUrl, meetingDay, meetingIcs, meetingTimeRange } from "@/lib/meetings";
import { buttonStyles, cardStyles } from "@/lib/ui";

import type { MeetingItem } from "@/lib/api-types";

type MeetingConfirmationProps = {
  meeting: MeetingItem;
  myName: string;
  partnerName: string;
  matchId: string;
  justBooked: boolean;
  onBookAnother: (() => void) | null;
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="font-mono text-meta uppercase tracking-wider text-muted sm:w-1/3">{label}</dt>
      <dd className="min-w-0 text-small text-ink">{children}</dd>
    </div>
  );
}

export function MeetingConfirmation({
  meeting,
  myName,
  partnerName,
  matchId,
  justBooked,
  onBookAnother,
}: MeetingConfirmationProps) {
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  const title = `${myName} × ${partnerName} · Startup Connect AI`;

  useEffect(() => {
    const url = URL.createObjectURL(
      new Blob([meetingIcs(meeting, title)], { type: "text/calendar;charset=utf-8" }),
    );
    setIcsUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [meeting, title]);

  return (
    <section
      aria-labelledby="meeting-confirmed-heading"
      className={`${cardStyles} flex flex-col gap-6 p-6`}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-bright/15 text-emerald-deep"
        >
          <CircleCheckIcon className="h-6 w-6" />
        </span>
        <h2 id="meeting-confirmed-heading" className="text-h2" role={justBooked ? "status" : undefined}>
          {justBooked ? "Meeting confirmed" : "Your upcoming meeting"}
        </h2>
        <p className="text-small text-muted">
          We’ll remind you both in the app 24 hours and 1 hour before it starts.
        </p>
      </div>

      <dl className="divide-y divide-line rounded-md border border-line">
        <DetailRow label="Date">{meetingDay(meeting.scheduled_at)}</DetailRow>
        <DetailRow label="Time">{meetingTimeRange(meeting)}</DetailRow>
        <DetailRow label="Duration">{meeting.duration_minutes} min</DetailRow>
        <DetailRow label="Attendees">
          {myName}, {partnerName}
        </DetailRow>
        {meeting.video_url ? (
          <DetailRow label="Video call">
            <a
              href={meeting.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 break-all rounded-md font-medium text-emerald-deep hover:underline"
            >
              <GlobeIcon className="h-4 w-4 shrink-0" />
              Join link
            </a>
          </DetailRow>
        ) : null}
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a
          href={googleCalendarUrl(meeting, title)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles.secondary}
        >
          <CalendarIcon className="h-4 w-4" />
          Add to Google Calendar
        </a>
        {icsUrl ? (
          <a href={icsUrl} download="startup-connect-meeting.ics" className={buttonStyles.secondary}>
            <DownloadIcon className="h-4 w-4" />
            Download .ics
          </a>
        ) : null}
        <Link href={`/matches/${matchId}`} className={`${buttonStyles.primary} sm:ml-auto`}>
          Back to match
        </Link>
      </div>

      {onBookAnother ? (
        <button
          type="button"
          onClick={onBookAnother}
          className={`${buttonStyles.ghost} self-center`}
        >
          Book another time
        </button>
      ) : null}
    </section>
  );
}
