import Link from "next/link";

import { ArrowLeftRightIcon, CircleCheckIcon, SparklesIcon } from "@/components/icons";
import { FitBadge } from "@/components/ui/fit-badge";
import { buttonStyles, cardStyles, eyebrowStyles } from "@/lib/ui";

type ProfilePanelProps = {
  initials: string;
  tone: "ink" | "emerald";
  label: string;
  name: string;
  meta: string;
  rows: ReadonlyArray<readonly [string, string]>;
};

function ProfilePanel({ initials, tone, label, name, meta, rows }: ProfilePanelProps) {
  return (
    <div className="rounded-md border border-line p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-heading text-base text-white ${
            tone === "ink" ? "bg-ink" : "bg-emerald-deep"
          }`}
          aria-hidden="true"
        >
          {initials}
        </span>
        <div>
          <p
            className={`font-mono text-meta uppercase tracking-wider ${
              tone === "ink" ? "text-muted" : "text-emerald-deep"
            }`}
          >
            {label}
          </p>
          <p className="font-heading text-h4 text-ink">{name}</p>
          <p className="text-meta text-muted">{meta}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-small">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="text-right font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const reasons = [
  "Cheque size ₹40L within ₹25L–₹75L window",
  "3 mutual portfolio contacts",
  "Active deployment mode",
] as const;

export function DemoMatch() {
  return (
    <section id="demo" className="mx-auto max-w-content scroll-mt-24 px-4 py-16 md:px-6">
      <div className="text-center">
        <p className={eyebrowStyles}>Demo preview</p>
        <h2 className="mt-2">See how AI matching looks in practice</h2>
        <p className="mx-auto mt-2 max-w-2xl text-small text-muted">
          A sample match between two demo profiles. Founders see exactly why investors and mentors
          are suggested, while investors only get pre-filtered, thesis-aligned deals.
        </p>
      </div>

      <div className={`${cardStyles} mx-auto mt-8 max-w-3xl p-4 md:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-slate-50 px-4 py-3">
          <p className="flex flex-wrap items-center gap-2 text-small">
            <span className="h-2 w-2 rounded-full bg-emerald-bright" aria-hidden="true" />
            <span className="font-medium text-ink">Active fundraise · ₹40L target</span>
            <span className="font-mono text-meta text-muted">Round ID: #IN-8821</span>
          </p>
          <FitBadge value={78} />
        </div>

        <div className="mt-4 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          <ProfilePanel
            initials="RS"
            tone="ink"
            label="Founder profile"
            name="Riya Sharma"
            meta="Fintech SaaS, Pune"
            rows={[
              ["Stage & ask", "₹40L seed"],
              ["Business model", "B2B recurring"],
              ["Runway", "14 months"],
              ["Pedigree", "Accelerator alumni"],
            ]}
          />
          <span
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-emerald/30 text-emerald-deep"
            aria-hidden="true"
          >
            <ArrowLeftRightIcon />
          </span>
          <ProfilePanel
            initials="AK"
            tone="emerald"
            label="Angel investor"
            name="Aditya Kumar"
            meta="Fintech + SaaS focus"
            rows={[
              ["Ticket window", "₹25L – ₹75L"],
              ["Portfolio size", "18 investments"],
              ["Operator record", "Ex-CPO, fintech"],
              ["Hubs", "Pune / Bengaluru"],
            ]}
          />
        </div>

        <div className="mt-4 rounded-md border border-line bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-mono text-meta uppercase tracking-wider text-emerald-deep">
              <SparklesIcon />
              Reasoning ledger
            </p>
            <p className="text-meta text-muted">Sample explanation</p>
          </div>
          <blockquote className="mt-3 font-heading text-base italic text-ink">
            “Sector match (Fintech), stage match (Seed), ask within investor’s cheque range,
            geographic overlap in Pune.”
          </blockquote>
          <ul className="mt-4 grid gap-2 text-small text-ink sm:grid-cols-3">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <CircleCheckIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-meta text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-bright" aria-hidden="true" />
            Intro slot open this Thursday
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/sign-up" className={buttonStyles.secondary}>
              Inspect deck telemetry
            </Link>
            <Link href="/sign-up" className={buttonStyles.primary}>
              Request warm intro
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
