"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { endorseClaim, revokeEndorsement } from "@/app/(app)/matches/endorsement-actions";
import { ShieldCheckIcon } from "@/components/icons";
import { buttonStyles } from "@/lib/ui";

import type { EndorsementItemKind } from "@/lib/api-types";

type EndorseControlProps = {
  profileId: string;
  itemId: string;
  itemKind: EndorsementItemKind;
  claimLabel: string;
  claimValue: string;
  founderFirstName: string;
  /** The viewer's own endorsement of this claim, if any. */
  mineId: string | null;
  canEndorse: boolean;
};

// S8 AC1–AC2: endorse a specific claim after confirming, or undo your own endorsement.
export function EndorseControl({
  profileId,
  itemId,
  itemKind,
  claimLabel,
  claimValue,
  founderFirstName,
  mineId,
  canEndorse,
}: EndorseControlProps) {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mine, setMine] = useState(mineId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await endorseClaim(profileId, itemId, itemKind);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMine(result.data.endorsement_id);
      dialogRef.current?.close();
      router.refresh();
    });
  };

  const undo = () => {
    if (!mine) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeEndorsement(mine);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMine(null);
      router.refresh();
    });
  };

  if (!mine && !canEndorse) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mine ? (
        <>
          <span className="inline-flex items-center gap-1 text-meta font-medium text-emerald-deep">
            <ShieldCheckIcon className="h-4 w-4" />
            You endorsed this
          </span>
          <button
            type="button"
            onClick={undo}
            disabled={isPending}
            className="rounded-md text-meta font-medium text-muted hover:text-ink hover:underline disabled:opacity-60"
          >
            {isPending ? "Removing…" : "Undo"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            dialogRef.current?.showModal();
          }}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-meta font-medium text-ink hover:bg-slate-50"
        >
          <ShieldCheckIcon className="h-4 w-4 text-emerald-deep" />
          Endorse this claim
        </button>
      )}
      {error && !dialogRef.current?.open ? (
        <p role="alert" className="w-full text-meta text-alert-red">
          {error}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-full max-w-modal rounded-xl border border-line p-0 text-left shadow-card backdrop:bg-ink/50"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-h3 text-ink">
            Endorse this claim?
          </h2>
          <div className="rounded-md bg-slate-50 p-4">
            <p className="font-mono text-meta uppercase tracking-wider text-muted">{claimLabel}</p>
            <p className="mt-1 break-words text-base font-semibold text-ink">{claimValue}</p>
          </div>
          <p className="text-small text-ink">
            Your name will appear next to this claim for everyone who can see {founderFirstName}’s
            profile. Only endorse what you’ve seen first-hand.
          </p>
          <p className="text-meta text-muted">
            If {founderFirstName} edits this claim, your endorsement is removed and we’ll let you
            know. You can undo it any time.
          </p>
          {error ? (
            <p role="alert" className="text-small text-alert-red">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={buttonStyles.ghost}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={isPending}
              className={buttonStyles.primary}
            >
              <ShieldCheckIcon className="h-4 w-4" />
              {isPending ? "Endorsing…" : "Endorse"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
