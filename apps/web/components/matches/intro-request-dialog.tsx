"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

import { draftIntro, sendIntro } from "@/app/(app)/matches/actions";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  LockIcon,
  RefreshIcon,
  SparklesIcon,
  XIcon,
} from "@/components/icons";
import { INTRO_MESSAGE_MAX, INTRO_MESSAGE_MIN, firstNameOf, initialsOf } from "@/lib/feedback";
import { buttonStyles } from "@/lib/ui";

import type { ConnectionStatus } from "@/lib/api-types";
import type { MouseEvent } from "react";

type DraftStatus = "idle" | "loading" | "ai" | "unavailable" | "scratch";

type IntroRequestDialogProps = {
  open: boolean;
  matchId: string;
  partnerName: string;
  partnerHeadline: string;
  /** Called with the new connection status once an intro was sent, otherwise null. */
  onClose: (sentStatus: ConnectionStatus | null) => void;
};

export function IntroRequestDialog({
  open,
  matchId,
  partnerName,
  partnerHeadline,
  onClose,
}: IntroRequestDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftRequestedRef = useRef(false);
  const titleId = useId();
  const messageId = useId();
  const counterId = useId();
  const [message, setMessage] = useState("");
  const [originalDraft, setOriginalDraft] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<ConnectionStatus | null>(null);
  const [isSending, startSending] = useTransition();
  const first = firstNameOf(partnerName);
  const isDrafting = draftStatus === "loading";

  const loadDraft = useCallback(
    (nextAttempt: number) => {
      setAttempt(nextAttempt);
      setDraftStatus("loading");
      setError(null);
      void draftIntro(matchId, nextAttempt).then((result) => {
        if (result.ok && result.data.source === "llm" && result.data.draft) {
          setMessage(result.data.draft);
          setOriginalDraft(result.data.draft);
          setDraftStatus("ai");
        } else {
          // PRD S5 AC4: without a draft the founder writes their own message.
          setDraftStatus("unavailable");
        }
      });
    },
    [matchId],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      if (!draftRequestedRef.current) {
        draftRequestedRef.current = true;
        loadDraft(0);
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, loadDraft]);

  const requestClose = () => onClose(sent);

  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) requestClose();
  };

  const writeFromScratch = () => {
    setMessage("");
    setOriginalDraft(null);
    setDraftStatus("scratch");
    textareaRef.current?.focus();
  };

  const submit = () => {
    const trimmed = message.trim();
    if (trimmed.length < INTRO_MESSAGE_MIN) {
      setError(`Write at least ${INTRO_MESSAGE_MIN} characters so ${first} knows why you’d like to connect.`);
      textareaRef.current?.focus();
      return;
    }
    setError(null);
    startSending(async () => {
      const result = await sendIntro(matchId, trimmed, originalDraft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(result.data.status);
    });
  };

  const remaining = INTRO_MESSAGE_MAX - message.length;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) requestClose();
      }}
      onClick={closeOnBackdrop}
      className="w-full max-w-modal rounded-xl bg-white p-0 text-ink shadow-card backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink font-heading text-base text-white"
          >
            {initialsOf(partnerName)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-h3">
              Request intro to {partnerName}
            </h2>
            <p className="mt-1 text-small text-muted">{partnerHeadline}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-muted hover:bg-slate-50 hover:text-ink"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {sent ? (
          <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald/10 text-emerald">
              <CircleCheckIcon className="h-8 w-8" />
            </span>
            <p className="text-h3 text-ink">
              {sent === "accepted" ? `You’re connected with ${first}` : "Intro request sent"}
            </p>
            <p className="max-w-empty text-small text-muted">
              {sent === "accepted"
                ? `${first} had already accepted this match, so you’re now a mutual match. We’ve let them know.`
                : `${first} will see your message in their intro queue. We’ll notify you when they respond.`}
            </p>
            <button type="button" onClick={requestClose} className={`${buttonStyles.primary} mt-2`}>
              Done
            </button>
          </div>
        ) : (
          <>
            {draftStatus === "ai" ? (
              <p className="flex items-start gap-2 rounded-md bg-emerald/10 px-4 py-3 text-small text-emerald-deep">
                <SparklesIcon className="mt-px h-4 w-4 shrink-0" />
                <span>
                  <strong className="font-semibold">AI draft</strong> based on your match signals.
                  Edit anything before sending.
                </span>
              </p>
            ) : isDrafting ? (
              <p
                role="status"
                className="flex items-center gap-2 rounded-md bg-slate-50 px-4 py-3 text-small text-muted"
              >
                <RefreshIcon className="h-4 w-4 animate-spin" />
                Drafting a message from your match signals…
              </p>
            ) : draftStatus === "unavailable" ? (
              <p className="rounded-md bg-slate-50 px-4 py-3 text-small text-muted">
                The AI draft isn’t available right now. Write your own intro below.
              </p>
            ) : null}

            <div>
              <label
                htmlFor={messageId}
                className="font-mono text-meta uppercase tracking-wider text-muted"
              >
                Your message
              </label>
              <textarea
                ref={textareaRef}
                id={messageId}
                rows={9}
                maxLength={INTRO_MESSAGE_MAX}
                value={message}
                disabled={isDrafting}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write a short intro about why you’d like to connect"
                aria-describedby={counterId}
                aria-invalid={error ? true : undefined}
                className="mt-2 w-full resize-y rounded-md border border-muted bg-white px-3 py-3 text-base text-ink placeholder:text-muted disabled:bg-slate-50"
              />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p id={counterId} className="font-mono text-meta text-muted">
                  {message.length}/{INTRO_MESSAGE_MAX} characters
                  {remaining > 100 ? " · plenty of room" : ` · ${remaining} left`}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => loadDraft(attempt + 1)}
                    disabled={isDrafting || isSending}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-small font-medium text-emerald-deep hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshIcon className={`h-4 w-4 ${isDrafting ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                  <span aria-hidden="true" className="text-muted">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={writeFromScratch}
                    disabled={isDrafting || isSending}
                    className="rounded-md px-2 py-2 text-small font-medium text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Write from scratch
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
              >
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={submit}
                disabled={isSending || isDrafting}
                className={buttonStyles.primary}
              >
                {isSending ? "Sending…" : "Send intro request"}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <button type="button" onClick={requestClose} className={buttonStyles.ghost}>
                Cancel
              </button>
            </div>

            <p className="flex items-start gap-2 text-meta text-muted">
              <LockIcon className="h-4 w-4 shrink-0" />
              Only {first} sees this message, in their intro queue. We’ll notify you when they
              respond.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
