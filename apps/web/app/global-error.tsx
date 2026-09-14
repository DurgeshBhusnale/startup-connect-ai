"use client";

import "./globals.css";

import { ErrorFallback } from "@/components/ui/error-fallback";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Replaces the root layout when it fails, so it renders its own html and body.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <ErrorFallback error={error} reset={reset} homeHref="/" />
        </main>
      </body>
    </html>
  );
}
