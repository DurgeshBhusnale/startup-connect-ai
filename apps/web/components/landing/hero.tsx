import Link from "next/link";

import { ArrowRightIcon, CircleCheckIcon } from "@/components/icons";
import { FitBadge } from "@/components/ui/fit-badge";
import { buttonStyles, cardStyles } from "@/lib/ui";

const heroStats = [
  { value: "3 min", label: "To build your profile" },
  { value: "8", label: "Ranked matches a week" },
  { value: "100%", label: "Matches with a reason" },
] as const;

const telemetryCells = [
  { label: "Target sector", value: "Fintech SaaS · Seed", accent: false },
  { label: "Vector overlap", value: "91.4% cosine fit", accent: true },
  { label: "Cheque fit", value: "Optimal", accent: true },
] as const;

export function Hero() {
  return (
    <section className="mx-auto grid max-w-content gap-12 px-4 py-12 md:px-6 lg:grid-cols-2 lg:items-center lg:py-16">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/5 px-3 py-1 text-meta font-medium text-emerald-deep">
          <CircleCheckIcon className="h-4 w-4" />
          Now onboarding founders, angels &amp; mentors across India
        </p>
        <h1 className="mt-6 text-h1 md:text-hero">
          The right investor. The right mentor. <span className="text-emerald">Matched by AI</span>,
          explained clearly.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Startup Connect AI helps early-stage founders find the mentors and investors who actually
          fit — with fit scores and reasoning, not endless directories.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/sign-up" className={buttonStyles.primary}>
            Get started free
            <ArrowRightIcon />
          </Link>
          <Link href="#demo" className={buttonStyles.ghost}>
            See how matching works
            <ArrowRightIcon />
          </Link>
        </div>
        <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
          {heroStats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse gap-1">
              <dt className="text-meta text-muted">{stat.label}</dt>
              <dd className="font-heading text-h3 text-ink">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <figure aria-label="Sample match preview" className={`${cardStyles} p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-mono text-meta uppercase tracking-wider text-ink">
            <span className="h-px w-6 bg-ink" aria-hidden="true" />
            Match telemetry
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/5 px-2 py-1 font-mono text-meta uppercase text-emerald-deep">
            <span className="h-2 w-2 rounded-full bg-emerald-bright" aria-hidden="true" />
            Sample pipeline
          </span>
        </div>
        <dl className="mt-6 grid gap-4 rounded-md border border-line p-4 sm:grid-cols-3">
          {telemetryCells.map((cell) => (
            <div key={cell.label}>
              <dt className="text-meta text-muted">{cell.label}</dt>
              <dd
                className={`mt-1 text-small font-medium ${
                  cell.accent ? "font-mono uppercase text-emerald-deep" : "text-ink"
                }`}
              >
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex items-center justify-between text-meta">
          <span className="text-muted">Algorithm conviction index</span>
          <span className="font-mono font-medium text-emerald-deep">9.4 / 10</span>
        </div>
        <svg viewBox="0 0 300 60" className="mt-2 h-16 w-full" aria-hidden="true">
          <path
            d="M0 46 C 30 45, 50 41, 80 39 S 130 31, 160 32 S 210 23, 240 19 S 280 13, 300 10 L 300 60 L 0 60 Z"
            className="fill-emerald/10"
          />
          <path
            d="M0 46 C 30 45, 50 41, 80 39 S 130 31, 160 32 S 210 23, 240 19 S 280 13, 300 10"
            className="fill-none stroke-emerald"
            strokeWidth={2}
          />
        </svg>
        <figcaption className="mt-4 flex items-center justify-between gap-3 rounded-md border border-line bg-slate-50 p-3">
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-heading text-small text-white">
              R
            </span>
            <span>
              <span className="block text-small font-medium text-ink">Riya Sharma</span>
              <span className="block text-meta text-muted">Fintech SaaS · ₹40L Seed</span>
            </span>
          </span>
          <FitBadge value={78} />
        </figcaption>
      </figure>
    </section>
  );
}
