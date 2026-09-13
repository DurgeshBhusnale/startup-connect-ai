import Link from "next/link";

import { buttonStyles } from "@/lib/ui";

export function CtaBand() {
  return (
    <section className="px-4 py-16 md:px-6">
      <div className="cta-glow mx-auto flex max-w-content flex-col gap-8 overflow-hidden rounded-lg bg-ink p-8 md:flex-row md:items-center md:justify-between md:p-12">
        <div className="max-w-2xl">
          <p className="font-mono text-meta uppercase tracking-wider text-emerald-bright">
            Get started today
          </p>
          <h2 className="mt-2 text-h2 text-white md:text-h1">
            Ready to find the investors and mentors who actually fit?
          </h2>
          <p className="mt-3 text-small text-white/70">
            Join the founders, angels, and mentors building India’s next generation of startups.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Link href="/sign-up" className={buttonStyles.inverse}>
            Start matching free
          </Link>
          <Link href="#demo" className={buttonStyles.outlineInverse}>
            See a sample match
          </Link>
        </div>
      </div>
    </section>
  );
}
