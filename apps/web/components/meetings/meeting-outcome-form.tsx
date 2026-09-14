"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { submitMeetingOutcome } from "@/app/(app)/matches/meeting-actions";
import { CalendarIcon, CircleCheckIcon, ClockIcon, XIcon } from "@/components/icons";
import { OUTCOME_NOTES_MAX } from "@/lib/meetings";
import { buttonStyles, cardStyles } from "@/lib/ui";

import type { IconComponent } from "@/components/icons";
import type { OutcomeChoice } from "@/lib/api-types";

const OPTIONS: readonly {
  value: OutcomeChoice;
  title: string;
  body: string;
  icon: IconComponent;
  tone: string;
}[] = [
  {
    value: "great_fit",
    title: "Great fit — moving forward",
    body: "You want to keep talking or take next steps.",
    icon: CircleCheckIcon,
    tone: "bg-emerald-bright/15 text-emerald-deep",
  },
  {
    value: "not_a_fit",
    title: "Not a fit — thanks for meeting",
    body: "A good conversation, but not the right match.",
    icon: XIcon,
    tone: "bg-slate-100 text-ink",
  },
  {
    value: "undecided",
    title: "Undecided / diligencing",
    body: "Still thinking it over or doing more homework.",
    icon: ClockIcon,
    tone: "bg-alert-amber/10 text-alert-amber",
  },
  {
    value: "cancelled",
    title: "Meeting didn’t happen",
    body: "Cancelled or missed. This doesn’t count against anyone.",
    icon: CalendarIcon,
    tone: "bg-slate-100 text-muted",
  },
];

type MeetingOutcomeFormProps = {
  meetingId: string;
  partnerFirstName: string;
  initialOutcome: OutcomeChoice | null;
  initialNotes: string | null;
  backHref: string;
  backLabel: string;
};

export function MeetingOutcomeForm({
  meetingId,
  partnerFirstName,
  initialOutcome,
  initialNotes,
  backHref,
  backLabel,
}: MeetingOutcomeFormProps) {
  const notesId = useId();
  const hintId = useId();
  const groupName = useId();
  const [outcome, setOutcome] = useState<OutcomeChoice | null>(initialOutcome);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState<OutcomeChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (saved) {
    const choice = OPTIONS.find((option) => option.value === saved);
    return (
      <section
        aria-labelledby="outcome-saved-heading"
        className={`${cardStyles} flex flex-col items-center gap-4 p-6 text-center`}
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-bright/15 text-emerald-deep"
        >
          <CircleCheckIcon className="h-6 w-6" />
        </span>
        <h2 id="outcome-saved-heading" role="status" className="text-h2">
          Thanks, outcome saved
        </h2>
        <p className="text-small text-muted">
          You logged “{choice?.title}”. You can come back to this page to change it.
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={() => setSaved(null)} className={buttonStyles.secondary}>
            Edit outcome
          </button>
          <Link href={backHref} className={buttonStyles.primary}>
            {backLabel}
          </Link>
        </div>
      </section>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!outcome) {
      setError("Pick how the meeting went.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitMeetingOutcome(meetingId, outcome, notes);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(result.data.outcome);
    });
  };

  return (
    <form onSubmit={submit} noValidate className={`${cardStyles} flex flex-col gap-6 p-6`}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-h4 font-medium text-ink">How did it go?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const checked = outcome === option.value;
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition focus-within:ring-2 focus-within:ring-emerald/30 ${
                  checked ? "border-ink bg-slate-50" : "border-line bg-white hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={option.value}
                  checked={checked}
                  onChange={() => {
                    setOutcome(option.value);
                    setError(null);
                  }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${option.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-small font-medium text-ink">{option.title}</span>
                  <span className="mt-1 block text-meta text-muted">{option.body}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    checked ? "border-ink bg-ink" : "border-muted bg-white"
                  }`}
                >
                  {checked ? <span className="h-1 w-1 rounded-full bg-white" /> : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={notesId} className="text-small font-medium text-ink">
            Notes <span className="font-normal text-muted">(optional)</span>
          </label>
          <span className="font-mono text-meta text-muted" aria-live="polite">
            {notes.length}/{OUTCOME_NOTES_MAX}
          </span>
        </div>
        <textarea
          id={notesId}
          rows={4}
          maxLength={OUTCOME_NOTES_MAX}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          aria-describedby={hintId}
          placeholder="What stood out? Next steps, open questions…"
          className="w-full resize-y rounded-md border border-muted px-3 py-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-emerald/30"
        />
        <p id={hintId} className="text-meta text-muted">
          Only visible to you, never shared with {partnerFirstName}.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-small text-alert-red">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Link href={backHref} className={buttonStyles.ghost}>
          Skip for now
        </Link>
        <button type="submit" disabled={isPending} className={buttonStyles.primary}>
          {isPending ? "Saving…" : initialOutcome ? "Update outcome" : "Save outcome"}
        </button>
      </div>
    </form>
  );
}
