"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { takeMatchAction } from "@/app/(app)/matches/actions";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  MessageSquareIcon,
  XIcon,
} from "@/components/icons";
import { firstNameOf, rejectReasons } from "@/lib/feedback";
import { buttonStyles } from "@/lib/ui";

import { IntroRequestDialog } from "./intro-request-dialog";

import type {
  AppRole,
  ConnectionStatus,
  MatchActionType,
  MatchState,
  RejectReason,
} from "@/lib/api-types";
import type { ReactNode } from "react";

const quietButton =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-small font-medium text-muted transition hover:bg-slate-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60";
const menuItem = "rounded-md px-3 py-2 text-left text-small hover:bg-slate-50";

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "emerald";
}) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-small font-medium ${
        tone === "emerald" ? "bg-emerald/10 text-emerald-deep" : "bg-slate-100 text-ink"
      }`}
    >
      {children}
    </span>
  );
}

type MatchActionsProps = {
  matchId: string;
  role: AppRole;
  partnerName: string;
  partnerHeadline: string;
  initialState: MatchState;
  position?: number;
  layout?: "row" | "stacked";
  /** Match List removes the card as soon as a "Not a fit" reason is picked (M9 AC2). */
  onHide?: () => void;
  onHideFailed?: (error: string) => void;
};

export function MatchActions({
  matchId,
  role,
  partnerName,
  partnerHeadline,
  initialState,
  position,
  layout = "row",
  onHide,
  onHideFailed,
}: MatchActionsProps) {
  const router = useRouter();
  const menuId = useId();
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

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

  const run = (action: MatchActionType, reason: RejectReason | null = null) => {
    setError(null);
    setMenuOpen(false);
    if (action === "reject") onHide?.();
    startTransition(async () => {
      const result = await takeMatchAction(matchId, action, reason, position ?? null);
      if (!result.ok) {
        if (action === "reject" && onHideFailed) {
          onHideFailed(result.error);
        } else {
          setError(result.error);
        }
        return;
      }
      setState(result.data);
    });
  };

  const closeDialog = (sentStatus: ConnectionStatus | null) => {
    setDialogOpen(false);
    if (sentStatus) {
      setState((current) => ({ ...current, connection: sentStatus }));
      router.refresh();
    }
  };

  const first = firstNameOf(partnerName);
  const isFounder = role === "founder";
  const { connection } = state;
  const saved = state.saved_at !== null;
  const canHide = connection !== "accepted" && !(isFounder && connection === "pending");
  const stacked = layout === "stacked";

  if (state.rejected && !onHide) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 text-small text-muted">
        Hidden from your matches.
        <button
          type="button"
          onClick={() => run("restore")}
          disabled={isPending}
          className="rounded-md font-medium text-emerald-deep hover:underline"
        >
          Undo
        </button>
        {error ? (
          <p role="alert" className="w-full text-meta text-alert-red">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  let primary: ReactNode;
  if (connection === "accepted") {
    primary = (
      <>
        <StatusPill tone="emerald">
          <CheckIcon className="h-4 w-4" />
          Mutual match
        </StatusPill>
        <Link href={`/messages/${matchId}`} className={buttonStyles.primary}>
          <MessageSquareIcon className="h-4 w-4" />
          Message
        </Link>
        <Link href={`/matches/${matchId}/schedule`} className={buttonStyles.secondary}>
          <CalendarIcon className="h-4 w-4" />
          Schedule a meeting
        </Link>
      </>
    );
  } else if (isFounder && connection === "pending") {
    primary = <StatusPill>Intro requested</StatusPill>;
  } else if (isFounder && connection === "declined") {
    primary = <StatusPill>Intro declined</StatusPill>;
  } else if (isFounder) {
    primary = (
      <button type="button" onClick={() => setDialogOpen(true)} className={buttonStyles.primary}>
        Request intro
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    );
  } else if (connection === "interested") {
    primary = <StatusPill>Accepted · awaiting their intro</StatusPill>;
  } else {
    primary = (
      <button
        type="button"
        onClick={() => run("accept")}
        disabled={isPending}
        className={buttonStyles.primary}
      >
        {connection === "pending" ? "Accept intro" : "Accept match"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {isFounder && connection === "interested" ? (
        <p className="text-small text-emerald-deep">{first} is interested in connecting.</p>
      ) : null}
      {!isFounder && connection === "pending" ? (
        <p className="text-small text-emerald-deep">{first} requested an intro.</p>
      ) : null}

      <div className={stacked ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2"}>
        {primary}
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => run(saved ? "unsave" : "save")}
          disabled={isPending}
          className={buttonStyles.secondary}
        >
          <BookmarkIcon className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          {saved ? "Saved" : "Save"}
        </button>
        {canHide ? (
          <div className="relative">
            <button
              ref={toggleRef}
              type="button"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((isOpen) => !isOpen)}
              disabled={isPending}
              className={`${quietButton} ${stacked ? "w-full" : ""}`}
            >
              <XIcon className="h-4 w-4" />
              Not a fit
            </button>
            {menuOpen ? (
              <div
                id={menuId}
                ref={menuRef}
                role="group"
                aria-label="Why isn’t this a fit?"
                className={`absolute z-20 mt-2 flex w-max flex-col rounded-lg border border-line bg-white p-2 shadow-card ${
                  stacked ? "left-0" : "right-0"
                }`}
              >
                <p className="px-3 py-1 font-mono text-meta uppercase tracking-wider text-muted">
                  Why not a fit?
                </p>
                {rejectReasons.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => run("reject", option.value)}
                    className={`${menuItem} text-ink`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => run("reject")}
                  className={`${menuItem} text-muted`}
                >
                  Skip reason
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-meta text-alert-red">
          {error}
        </p>
      ) : null}

      {isFounder ? (
        <IntroRequestDialog
          open={dialogOpen}
          matchId={matchId}
          partnerName={partnerName}
          partnerHeadline={partnerHeadline}
          onClose={closeDialog}
        />
      ) : null}
    </div>
  );
}
