import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonStyles, cardStyles } from "@/lib/ui";

export function LegalPlaceholder({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-line bg-white px-4 py-3 md:px-6">
        <div className="mx-auto max-w-content">
          <Logo />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 py-12 md:px-6">
        <h1>{title}</h1>
        <div className={`${cardStyles} mt-6 p-6`}>
          <p className="text-base text-ink">
            We’re finalising our {title} and will publish it here before our beta opens.
          </p>
          <p className="mt-3 text-small text-muted">
            Until then, our commitment is simple: your profile data is used only to compute
            matches, and it is never sold.
          </p>
          <Link href="/" className={`${buttonStyles.secondary} mt-6`}>
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
