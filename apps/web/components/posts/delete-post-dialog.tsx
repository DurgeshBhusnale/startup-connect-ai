"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { deletePost } from "@/app/(app)/profile/post-actions";
import { buttonStyles } from "@/lib/ui";

type DeletePostDialogProps = {
  postId: string;
  onClose: (deleted: boolean) => void;
};

export function DeletePostDialog({ postId, onClose }: DeletePostDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deletePost(postId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose(true);
    });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => onClose(false)}
      className="w-full max-w-modal rounded-xl bg-white p-0 text-ink shadow-card backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-h3">
          Delete this post?
        </h2>
        <p className="text-small text-ink">
          It disappears from your profile right away and is permanently deleted after 30 days.
        </p>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={buttonStyles.secondary}
          >
            Keep post
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-md bg-alert-red px-4 py-3 text-small font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Deleting…" : "Delete post"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
