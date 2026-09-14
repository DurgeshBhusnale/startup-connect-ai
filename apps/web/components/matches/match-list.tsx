"use client";

import { useState, useTransition } from "react";

import { takeMatchAction } from "@/app/(app)/matches/actions";

import { MatchActions } from "./match-actions";
import { MatchCard } from "./match-card";

import type { AppRole, MatchItem } from "@/lib/api-types";
import type { ReactNode } from "react";

type Notice = { matchId: string; name: string; error: string | null } | null;

type MatchListProps = {
  matches: MatchItem[];
  role: AppRole;
  empty: ReactNode;
};

export function MatchList({ matches, role, empty }: MatchListProps) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<Notice>(null);
  const [isUndoing, startUndo] = useTransition();
  const visible = matches.filter((match) => !hidden.has(match.match_id));

  const hide = (matchId: string, name: string) => {
    setHidden((current) => new Set(current).add(matchId));
    setNotice({ matchId, name, error: null });
  };

  const unhide = (matchId: string) => {
    setHidden((current) => {
      const next = new Set(current);
      next.delete(matchId);
      return next;
    });
  };

  const undo = () => {
    if (!notice) return;
    const current = notice;
    startUndo(async () => {
      const result = await takeMatchAction(current.matchId, "restore");
      if (result.ok) {
        unhide(current.matchId);
        setNotice(null);
      } else {
        setNotice({ ...current, error: result.error });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {notice ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-small text-ink shadow-card"
        >
          {notice.error ? (
            <span className="text-alert-red">{notice.error}</span>
          ) : (
            <span>
              Removed {notice.name} from your matches. Your feedback helps tune future matches.
            </span>
          )}
          {hidden.has(notice.matchId) ? (
            <button
              type="button"
              onClick={undo}
              disabled={isUndoing}
              className="rounded-md font-medium text-emerald-deep hover:underline disabled:opacity-60"
            >
              {isUndoing ? "Restoring…" : "Undo"}
            </button>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        empty
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((match, index) => (
            <li key={match.match_id}>
              <MatchCard
                match={match}
                footer={
                  <MatchActions
                    key={`${match.state.connection}-${match.state.saved_at ?? ""}`}
                    matchId={match.match_id}
                    role={role}
                    partnerName={match.to_profile.display_name}
                    partnerHeadline={match.to_profile.headline}
                    initialState={match.state}
                    position={index}
                    onHide={() => hide(match.match_id, match.to_profile.display_name)}
                    onHideFailed={(error) => {
                      unhide(match.match_id);
                      setNotice({ matchId: match.match_id, name: match.to_profile.display_name, error });
                    }}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
