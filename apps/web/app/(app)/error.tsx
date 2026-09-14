"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";
import { cardStyles } from "@/lib/ui";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Keeps the sidebar and tabs visible when a single app page fails.
export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <section className={`${cardStyles} mx-auto max-w-content p-6`}>
      <ErrorFallback error={error} reset={reset} />
    </section>
  );
}
