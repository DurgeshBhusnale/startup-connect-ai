"use client";

import { useId, useState, useTransition } from "react";

import { saveNotificationPreferences } from "@/app/(app)/settings/actions";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { notificationTopicKeys } from "@/lib/privacy";
import { buttonStyles } from "@/lib/ui";

import type { AppRole, NotificationPreferences } from "@/lib/api-types";

const topicCopy: Record<
  keyof NotificationPreferences,
  { title: string; body: string; roles: readonly AppRole[] }
> = {
  new_matches: {
    title: "New matches",
    body: "When a refresh finds new people who fit.",
    roles: ["founder", "investor", "mentor"],
  },
  intro_requests: {
    title: "Intro requests",
    body: "When a founder asks you for an intro.",
    roles: ["investor", "mentor"],
  },
  mutual_matches: {
    title: "Mutual matches",
    body: "When an intro is accepted and you’re connected.",
    roles: ["founder", "investor", "mentor"],
  },
  interest: {
    title: "Interest from investors and mentors",
    body: "When someone accepts your match before you request an intro.",
    roles: ["founder"],
  },
  meetings: {
    title: "Meetings",
    body: "When a meeting is booked, before it starts, or when a match wants to schedule.",
    roles: ["founder", "investor", "mentor"],
  },
};

type NotificationPreferencesFormProps = {
  role: AppRole;
  initial: NotificationPreferences;
};

export function NotificationPreferencesForm({ role, initial }: NotificationPreferencesFormProps) {
  const idPrefix = useId();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const topics = notificationTopicKeys.filter((key) => topicCopy[key].roles.includes(role));
  const dirty = notificationTopicKeys.some((key) => draft[key] !== saved[key]);

  const save = () => {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await saveNotificationPreferences(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(result.data);
      setDraft(result.data);
      setStatus("Preferences saved.");
    });
  };

  return (
    <div>
      <ul className="mt-2 divide-y divide-line">
        {topics.map((key) => {
          const labelId = `${idPrefix}-${key}`;
          return (
            <li key={key} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p id={labelId} className="text-small font-medium text-ink">
                  {topicCopy[key].title}
                </p>
                <p className="mt-1 text-small text-muted">{topicCopy[key].body}</p>
              </div>
              <ToggleSwitch
                checked={draft[key]}
                labelledBy={labelId}
                onChange={(next) => {
                  setStatus(null);
                  setDraft((current) => ({ ...current, [key]: next }));
                }}
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p role="status" className="text-small text-emerald-deep">
          {status}
        </p>
        {error ? (
          <p role="alert" className="text-small text-alert-red">
            {error}
          </p>
        ) : null}
        {dirty ? (
          <>
            <button type="button" onClick={() => setDraft(saved)} className={buttonStyles.ghost}>
              Discard
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className={buttonStyles.primary}
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
