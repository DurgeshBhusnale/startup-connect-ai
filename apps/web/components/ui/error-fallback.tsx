"use client";

import Link from "next/link";
import { useEffect } from "react";

import { TriangleAlertIcon } from "@/components/icons";
import { buttonStyles } from "@/lib/ui";

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
};

// S-28 500 pattern: shared by the root, app-shell, and global error boundaries.
export function ErrorFallback({ error, reset, homeHref = "/home" }: ErrorFallbackProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-empty flex-col items-center py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-alert-red/10 text-alert-red">
        <TriangleAlertIcon className="h-8 w-8" />
      </span>
      <h1 className="mt-4 font-heading text-h2 text-ink">Something went wrong</h1>
      <p className="mt-2 text-small text-muted">
        An unexpected error stopped this page from loading. Try again, or head back home.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-meta text-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={reset} className={buttonStyles.primary}>
          Try again
        </button>
        <Link href={homeHref} className={buttonStyles.ghost}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
