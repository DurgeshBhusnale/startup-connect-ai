import Link from "next/link";

import { buttonStyles } from "@/lib/ui";

type CtaLink = { href: string; label: string };

type CtaBandProps = {
  eyebrow?: string;
  title?: string;
  body?: string;
  primary?: CtaLink;
  secondary?: CtaLink;
};

export function CtaBand({
  eyebrow = "Get started today",
  title = "Ready to find the investors and mentors who actually fit?",
  body = "Join the founders, angels, and mentors building India’s next generation of startups.",
  primary = { href: "/sign-up", label: "Start matching free" },
  secondary = { href: "#demo", label: "See a sample match" },
}: CtaBandProps) {
  return (
    <section className="px-4 py-16 md:px-6">
      <div className="cta-glow mx-auto flex max-w-content flex-col gap-8 overflow-hidden rounded-lg bg-ink p-8 md:flex-row md:items-center md:justify-between md:p-12">
        <div className="max-w-2xl">
          <p className="font-mono text-meta uppercase tracking-wider text-emerald-bright">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-h2 text-white md:text-h1">{title}</h2>
          <p className="mt-3 text-small text-white/70">{body}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Link href={primary.href} className={buttonStyles.inverse}>
            {primary.label}
          </Link>
          <Link href={secondary.href} className={buttonStyles.outlineInverse}>
            {secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
