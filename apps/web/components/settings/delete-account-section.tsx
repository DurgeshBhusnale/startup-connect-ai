"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { deleteAccount } from "@/app/(app)/settings/actions";
import { TrashIcon, TriangleAlertIcon } from "@/components/icons";
import { buttonStyles } from "@/lib/ui";

const dangerButton =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-alert-red px-4 py-3 text-small font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

export function DeleteAccountSection({ email }: { email: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirmed = email !== "" && typed.trim().toLowerCase() === email.toLowerCase();

  const open = () => {
    setTyped("");
    setError(null);
    dialogRef.current?.showModal();
  };

  const close = () => dialogRef.current?.close();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(typed.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.push("/account-deletion");
    });
  };

  return (
    <section
      aria-labelledby="danger-heading"
      className="rounded-lg border border-alert-red bg-alert-red/5 p-6"
    >
      <h2
        id="danger-heading"
        className="flex items-center gap-2 font-mono text-meta uppercase tracking-wider text-alert-red"
      >
        <TriangleAlertIcon className="h-4 w-4" />
        Danger zone
      </h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold text-ink">Delete account</p>
          <p className="mt-1 text-small text-ink">
            Permanently delete your account, profile, and matches. You have 30 days to change your
            mind before everything is erased.
          </p>
        </div>
        <button type="button" onClick={open} className={dangerButton}>
          <TrashIcon className="h-4 w-4" />
          Delete account
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-full max-w-modal rounded-xl bg-white p-0 text-ink shadow-card backdrop:bg-ink/40"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="flex items-center gap-2 text-h3">
            <TriangleAlertIcon className="h-6 w-6 text-alert-red" />
            Delete your account?
          </h2>
          <p className="text-small text-ink">
            This permanently deletes your account, profile, and matches, and cancels any pending
            intro requests. You have 30 days to cancel; after that, we cannot recover your data.
          </p>
          <div>
            <label htmlFor={inputId} className="text-small font-medium text-ink">
              Type <span className="break-all font-mono">{email}</span> to confirm
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              inputMode="email"
              className="mt-2 w-full rounded-md border border-muted bg-white px-3 py-3 text-base text-ink"
            />
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className={buttonStyles.secondary}>
              Keep my account
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!confirmed || isPending}
              className={dangerButton}
            >
              {isPending ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
