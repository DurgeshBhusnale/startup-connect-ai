"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: ErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <ErrorFallback error={error} reset={reset} homeHref="/" />
    </main>
  );
}
