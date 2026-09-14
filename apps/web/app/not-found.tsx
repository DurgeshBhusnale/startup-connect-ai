import Link from "next/link";

import { buttonStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 text-center">
      <p aria-hidden="true" className="font-mono text-hero text-muted">
        404
      </p>
      <h1 className="mt-4 font-heading text-h1 text-ink">Page not found</h1>
      <p className="mt-2 max-w-empty text-base text-muted">
        That page doesn’t exist, or you don’t have access to it. Let’s get you back.
      </p>
      <Link href="/home" className={`${buttonStyles.primary} mt-8`}>
        Back to home
      </Link>
    </main>
  );
}
