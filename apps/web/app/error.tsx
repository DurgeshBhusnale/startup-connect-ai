"use client";

import { buttonStyles, cardStyles } from "@/lib/ui";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ reset }: ErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className={`${cardStyles} max-w-empty p-8 text-center`}>
        <h1 className="text-h2">Something went wrong</h1>
        <p className="mt-2 text-small text-muted">
          We couldn’t load this page. Check your connection and try again.
        </p>
        <button type="button" onClick={reset} className={`${buttonStyles.primary} mt-6`}>
          Try again
        </button>
      </div>
    </main>
  );
}
