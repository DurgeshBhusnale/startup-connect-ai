"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { nudgeToSchedule, recordMeeting } from "@/app/(app)/matches/meeting-actions";
import { CalendarIcon } from "@/components/icons";
import { firstNameOf } from "@/lib/feedback";
import { buttonStyles, cardStyles } from "@/lib/ui";

import { CalBookingEmbed } from "./cal-booking-embed";
import { MeetingConfirmation } from "./meeting-confirmation";
import { SchedulingLinkForm } from "./scheduling-link-form";

import type { MeetingItem, SchedulingContext } from "@/lib/api-types";

type MeetingSchedulerProps = {
  context: SchedulingContext;
  myName: string;
  myEmail: string;
};

const DEFAULT_MINUTES = 30;

export function MeetingScheduler({ context, myName, myEmail }: MeetingSchedulerProps) {
  const router = useRouter();
  const partnerName = context.partner.display_name;
  const first = firstNameOf(partnerName);
  const [meeting, setMeeting] = useState<MeetingItem | null>(context.upcoming_meeting);
  const [justBooked, setJustBooked] = useState(false);
  const [rebooking, setRebooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudgeStatus, setNudgeStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const bookingLink = context.host === "partner" ? context.partner_cal_link : null;

  if (meeting && !rebooking) {
    return (
      <MeetingConfirmation
        meeting={meeting}
        myName={myName}
        partnerName={partnerName}
        matchId={context.match_id}
        justBooked={justBooked}
        onBookAnother={bookingLink ? () => setRebooking(true) : null}
      />
    );
  }

  const nudge = () => {
    setNudgeStatus(null);
    setError(null);
    startTransition(async () => {
      const result = await nudgeToSchedule(context.match_id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNudgeStatus(
        result.data.status === "sent"
          ? `We’ve let ${first} know.`
          : `${first} was already notified in the last day.`,
      );
    });
  };

  if (bookingLink) {
    return (
      <section aria-labelledby="pick-time-heading" className={`${cardStyles} flex flex-col gap-4 p-4 sm:p-6`}>
        <div className="flex flex-col gap-1">
          <h2 id="pick-time-heading" className="text-h3">
            Pick a time on {first}’s calendar
          </h2>
          <p className="text-small text-muted">
            Times show in your time zone. Your name and email are filled in for the booking.
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-small text-alert-red">
            {error}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-md border border-line">
          <CalBookingEmbed
            calLink={bookingLink}
            name={myName}
            email={myEmail}
            onBooked={(booking) => {
              setError(null);
              const scheduledAt = new Date(booking.startTime).toISOString();
              const endsAt = booking.endTime
                ? new Date(booking.endTime).toISOString()
                : new Date(Date.parse(scheduledAt) + DEFAULT_MINUTES * 60_000).toISOString();
              const local: MeetingItem = {
                meeting_id: booking.uid ?? scheduledAt,
                scheduled_at: scheduledAt,
                ends_at: endsAt,
                duration_minutes: Math.max(
                  1,
                  Math.round((Date.parse(endsAt) - Date.parse(scheduledAt)) / 60_000),
                ),
                title: booking.title,
                video_url: booking.videoCallUrl?.startsWith("https://") ? booking.videoCallUrl : null,
                status: "scheduled",
                host_is_me: false,
                booked_by_me: true,
              };
              // Show the confirmation right away; the booking already exists on Cal.com.
              setMeeting(local);
              setJustBooked(true);
              setRebooking(false);
              if (!booking.uid) {
                setError("Booked on Cal.com, but we couldn’t save it here. Check your Cal.com email.");
                return;
              }
              const uid = booking.uid;
              startTransition(async () => {
                const result = await recordMeeting(
                  context.match_id,
                  { ...booking, uid },
                  "partner",
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMeeting({ ...local, meeting_id: result.data.meeting_id });
                router.refresh();
              });
            }}
          />
        </div>
        {rebooking && meeting ? (
          <button type="button" onClick={() => setRebooking(false)} className={`${buttonStyles.ghost} self-start`}>
            Back to your upcoming meeting
          </button>
        ) : null}
      </section>
    );
  }

  // Neither calendar is bookable from this side: share mine, or ask for theirs.
  return (
    <section aria-labelledby="no-calendar-heading" className={`${cardStyles} flex flex-col gap-6 p-6`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-ink"
        >
          <CalendarIcon className="h-6 w-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="no-calendar-heading" className="text-h3">
            {first} hasn’t linked a calendar yet
          </h2>
          <p className="text-small text-muted">
            {context.my_cal_link
              ? `Share your booking link and ${first} can pick a time that works.`
              : `Add your Cal.com link so ${first} can book with you, or ask them to add theirs.`}
          </p>
        </div>
      </div>

      {context.my_cal_link ? null : (
        <SchedulingLinkForm initialLink={null} onChange={() => router.refresh()} />
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={nudge}
          disabled={isPending}
          className={context.my_cal_link ? buttonStyles.primary : buttonStyles.secondary}
        >
          {isPending
            ? "Sending…"
            : context.my_cal_link
              ? `Share my booking link with ${first}`
              : `Ask ${first} to add a link`}
        </button>
        {nudgeStatus ? (
          <p role="status" className="text-small text-emerald-deep">
            {nudgeStatus}
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-small text-alert-red">
          {error}
        </p>
      ) : null}
    </section>
  );
}
