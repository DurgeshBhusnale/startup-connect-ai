"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { respondToIntro } from "@/app/(app)/intros/actions";
import { ArrowRightIcon, CircleCheckIcon, MapPinIcon } from "@/components/icons";
import { TrustBadge } from "@/components/profile/trust-badge";
import { FitBadge } from "@/components/ui/fit-badge";
import { firstNameOf, initialsOf, rejectReasons } from "@/lib/feedback";
import { buttonStyles, cardStyles } from "@/lib/ui";

import type { IntroQueueItem, RejectReason } from "@/lib/api-types";

const LONG_MESSAGE = 220;
const HIGH_FIT = 0.8;
const requestedFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const menuItem = "rounded-md px-3 py-2 text-left text-small hover:bg-slate-50";

export function IntroCard({ item }: { item: IntroQueueItem }) {
  const [status, setStatus] = useState<"pending" | "accepted" | "declined">("pending");
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const menuId = useId();
  const messageId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const profile = item.founder;
  const first = firstNameOf(profile.display_name);
  const isLong = item.message.length > LONG_MESSAGE;

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector("button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const respond = (action: "accept" | "decline", reason: RejectReason | null = null) => {
    setMenuOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await respondToIntro(item.intro_id, action, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(result.data.status === "accepted" ? "accepted" : "declined");
    });
  };

  if (status === "declined") {
    return (
      <div role="status" className="rounded-lg border border-line bg-white px-6 py-4 text-small text-muted">
        Declined the intro from {profile.display_name}.
      </div>
    );
  }

  return (
    <article
      aria-label={`Intro request from ${profile.display_name}`}
      className={`${cardStyles} flex flex-col gap-4 p-6 ${
        item.fit_score >= HIGH_FIT ? "border-l-4 border-l-emerald-bright" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink font-heading text-base text-white"
          >
            {initialsOf(profile.display_name)}
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-h4 text-ink">{profile.display_name}</h2>
            <p className="mt-1 text-small text-muted">{profile.headline}</p>
            <TrustBadge trust={profile.trust} className="mt-1" />
            {profile.location ? (
              <p className="mt-1 flex items-center gap-1 text-meta text-muted">
                <MapPinIcon className="h-4 w-4" />
                {profile.location}
              </p>
            ) : null}
          </div>
        </div>
        <FitBadge value={Math.round(item.fit_score * 100)} />
      </div>

      <figure className="rounded-md bg-slate-50 p-4">
        <blockquote
          id={messageId}
          className={`whitespace-pre-line text-small italic text-ink ${
            isLong && !expanded ? "line-clamp-4" : ""
          }`}
        >
          {item.message}
        </blockquote>
        {isLong ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={messageId}
            onClick={() => setExpanded((isExpanded) => !isExpanded)}
            className="mt-2 rounded-md text-small font-medium text-emerald-deep hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        ) : null}
        <figcaption className="mt-2 font-mono text-meta text-muted">
          Requested {requestedFormat.format(new Date(item.requested_at))}
        </figcaption>
      </figure>

      {profile.facts.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Startup facts">
          {profile.facts.map((fact) => (
            <li key={fact} className="rounded bg-slate-100 px-2 py-1 font-mono text-meta text-ink">
              {fact}
            </li>
          ))}
        </ul>
      ) : null}

      {status === "accepted" ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-md bg-emerald/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-center gap-2 text-small font-medium text-emerald-deep">
            <CircleCheckIcon className="h-4 w-4 shrink-0" />
            You’re connected with {first}. We’ve let them know.
          </p>
          <Link
            href={`/matches/${item.match_id}`}
            className="rounded-md text-small font-medium text-emerald-deep hover:underline"
          >
            View match
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/matches/${item.match_id}`}
            className="inline-flex items-center gap-1 self-start rounded-md text-small font-medium text-emerald-deep hover:underline"
          >
            View full profile
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-end gap-2">
            <div className="relative">
              <button
                ref={toggleRef}
                type="button"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((isOpen) => !isOpen)}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-md px-4 py-3 text-small font-medium text-muted hover:bg-slate-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                Decline
              </button>
              {menuOpen ? (
                <div
                  id={menuId}
                  ref={menuRef}
                  role="group"
                  aria-label="Reason for declining"
                  className="absolute bottom-full right-0 z-20 mb-2 flex w-max flex-col rounded-lg border border-line bg-white p-2 shadow-card"
                >
                  <p className="px-3 py-1 font-mono text-meta uppercase tracking-wider text-muted">
                    Reason (optional)
                  </p>
                  {rejectReasons.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => respond("decline", option.value)}
                      className={`${menuItem} text-ink`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => respond("decline")}
                    className={`${menuItem} text-muted`}
                  >
                    Decline without a reason
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => respond("accept")}
              disabled={isPending}
              className={buttonStyles.primary}
            >
              {isPending ? "Saving…" : "Accept intro"}
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-small text-alert-red">
          {error}
        </p>
      ) : null}
    </article>
  );
}
