import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ArrowLeftIcon } from "@/components/icons";

import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-glow flex min-h-screen flex-col">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 justify-self-start rounded-md px-2 py-2 text-small text-ink hover:bg-white"
        >
          <ArrowLeftIcon />
          <span className="sr-only sm:not-sr-only">Back to Home</span>
        </Link>
        <Logo />
        <span aria-hidden="true" />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-12 pt-6 sm:pt-12">
        {children}
      </main>
      <footer className="flex flex-col items-center justify-between gap-2 px-4 py-4 font-mono text-meta uppercase tracking-wider text-muted sm:flex-row md:px-8">
        <p className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-bright" aria-hidden="true" />
          Sign-in secured by Clerk
        </p>
        <p>© {new Date().getFullYear()} Startup Connect AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
