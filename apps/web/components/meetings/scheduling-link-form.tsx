"use client";

import { useId, useState, useTransition } from "react";

import { removeSchedulingLink, saveSchedulingLink } from "@/app/(app)/matches/meeting-actions";
import { CAL_LINK_HINT, toCalLink } from "@/lib/meetings";
import { buttonStyles } from "@/lib/ui";

type SchedulingLinkFormProps = {
  initialLink: string | null;
  /** Called after a save or removal succeeds. */
  onChange?: (calLink: string | null) => void;
  compact?: boolean;
};

const smallButton =
  "inline-flex shrink-0 items-center justify-center rounded-md border border-line bg-white px-3 py-2 text-small font-medium text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

export function SchedulingLinkForm({ initialLink, onChange, compact = false }: SchedulingLinkFormProps) {
  const inputId = useId();
  const hintId = useId();
  const [link, setLink] = useState(initialLink);
  const [editing, setEditing] = useState(initialLink === null);
  const [value, setValue] = useState(initialLink ? `cal.com/${initialLink}` : "");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    if (!toCalLink(value)) {
      setError(CAL_LINK_HINT);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveSchedulingLink(value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLink(result.data.cal_link);
      setEditing(false);
      setStatus("Booking link saved.");
      onChange?.(result.data.cal_link);
    });
  };

  const remove = () => {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      const result = await removeSchedulingLink();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLink(null);
      setValue("");
      setEditing(true);
      setStatus("Booking link removed.");
      onChange?.(null);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {link && !editing ? (
        <div className="flex flex-col gap-3 rounded-md bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-meta uppercase tracking-wider text-muted">Cal.com link</p>
            <a
              href={`https://cal.com/${link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all rounded-md text-small font-medium text-emerald-deep hover:underline"
            >
              cal.com/{link}
            </a>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setStatus(null);
              }}
              disabled={isPending}
              className={smallButton}
            >
              Change
            </button>
            <button type="button" onClick={remove} disabled={isPending} className={smallButton}>
              {isPending ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={save} noValidate className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-small font-medium text-ink">
            Cal.com booking link
          </label>
          <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-2 sm:flex-row"}>
            <input
              id={inputId}
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="cal.com/yourname/30min"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={hintId}
              className="min-w-0 flex-1 rounded-md border border-muted px-3 py-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-emerald/30"
            />
            <button type="submit" disabled={isPending} className={buttonStyles.primary}>
              {isPending ? "Saving…" : "Save link"}
            </button>
            {link ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setValue(`cal.com/${link}`);
                  setError(null);
                }}
                className={buttonStyles.ghost}
              >
                Cancel
              </button>
            ) : null}
          </div>
          <p id={hintId} className="text-meta text-muted">
            Free on cal.com. Matches you’re connected with book time on this calendar.
          </p>
        </form>
      )}
      {error ? (
        <p role="alert" className="text-meta text-alert-red">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-meta text-emerald-deep">
          {status}
        </p>
      ) : null}
    </div>
  );
}
