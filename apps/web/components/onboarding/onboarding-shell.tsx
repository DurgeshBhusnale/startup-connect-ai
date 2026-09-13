import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonStyles } from "@/lib/ui";

import type { ReactNode } from "react";

export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-2 md:px-6">
          <Logo href="/home" />
          <div className="flex items-center gap-2">
            <Link href="/home" className={buttonStyles.ghost}>
              Exit
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </div>
        </div>
      </header>
      <main id="main" className="flex-1 px-4 py-8 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-2 px-4 py-4 text-meta text-muted sm:flex-row md:px-6">
          <p>© {new Date().getFullYear()} Startup Connect AI. All rights reserved.</p>
          <Link href="/privacy" className="rounded-md hover:text-ink">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
