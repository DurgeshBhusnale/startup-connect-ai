import Link from "next/link";

import {
  ArrowRightIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "@/components/icons";
import { CtaBand } from "@/components/landing/cta-band";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { FitBadge } from "@/components/ui/fit-badge";
import { buttonStyles, cardStyles, eyebrowStyles } from "@/lib/ui";

import type { RoleLandingContent } from "@/components/landing/role-landing-content";

function Hero({ content }: { content: RoleLandingContent }) {
  const { preview } = content;

  return (
    <section className="mx-auto grid max-w-content gap-12 px-4 py-12 md:px-6 lg:grid-cols-2 lg:items-center lg:py-16">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/5 px-3 py-1 text-meta font-medium text-emerald-deep">
          <CircleCheckIcon className="h-4 w-4" />
          {content.badge}
        </p>
        <h1 className="mt-6 text-h1 md:text-hero">{content.headline}</h1>
        <p className="mt-4 max-w-xl text-base text-muted">{content.subhead}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/sign-up" className={buttonStyles.primary}>
            {content.primaryCta}
            <ArrowRightIcon />
          </Link>
          <Link href="#how-it-works" className={buttonStyles.ghost}>
            See how matching works
            <ArrowRightIcon />
          </Link>
        </div>
        <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
          {content.heroStats.map((stat) => (
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
            {preview.label}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/5 px-2 py-1 font-mono text-meta uppercase text-emerald-deep">
            <span className="h-2 w-2 rounded-full bg-emerald-bright" aria-hidden="true" />
            Sample profile
          </span>
        </div>
        <dl className="mt-6 grid gap-4 rounded-md border border-line p-4 sm:grid-cols-2">
          {preview.filters.map((filter) => (
            <div key={filter.label}>
              <dt className="text-meta text-muted">{filter.label}</dt>
              <dd className="mt-1 text-small font-medium text-ink">{filter.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex items-center justify-between gap-3 rounded-md border border-line bg-slate-50 p-3">
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-heading text-small text-white">
              {preview.person.initials}
            </span>
            <span>
              <span className="block text-small font-medium text-ink">{preview.person.name}</span>
              <span className="block text-meta text-muted">{preview.person.meta}</span>
            </span>
          </span>
          <FitBadge value={preview.person.fit} />
        </div>
        <figcaption className="mt-3 flex items-start gap-2 text-meta text-muted">
          <SparklesIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
          {preview.reason}
        </figcaption>
      </figure>
    </section>
  );
}

function ValueProps({ content }: { content: RoleLandingContent }) {
  return (
    <section id="why" className="scroll-mt-24 border-y border-line bg-slate-50">
      <div className="mx-auto max-w-content px-4 py-16 md:px-6">
        <p className={eyebrowStyles}>
          {content.role === "investor" ? "Why investors join" : "Why mentors join"}
        </p>
        <h2 className="mt-2">Fewer names. Better reasons.</h2>
        <p className="mt-2 max-w-2xl text-small text-muted">
          Startup Connect AI is not a directory you scroll. It is a short, ranked list you can
          interrogate — and a set of controls that keep the volume where you want it.
        </p>
        <ul className="mt-8 grid gap-6 md:grid-cols-2">
          {content.valueProps.map((prop) => (
            <li key={prop.title} className={`${cardStyles} flex flex-col p-6`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald/10 text-emerald-deep">
                <prop.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4">{prop.title}</h3>
              <p className="mt-2 text-small text-muted">{prop.body}</p>
              <div className="mt-auto pt-6">
                <p className="flex items-center gap-2 rounded-md border border-line bg-slate-50 px-3 py-2 text-meta text-muted">
                  <CircleCheckIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
                  {prop.proof}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Steps({ content }: { content: RoleLandingContent }) {
  return (
    <section id="how-it-works" className="mx-auto max-w-content scroll-mt-24 px-4 py-16 md:px-6">
      <p className={eyebrowStyles}>How it works</p>
      <h2 className="mt-2">Four steps, and you are in the loop for every one.</h2>
      <ol className="mt-8 grid gap-6 md:grid-cols-2">
        {content.steps.map((step, index) => (
          <li key={step.title} className={`${cardStyles} flex flex-col p-6`}>
            <p className="font-mono text-meta uppercase tracking-wider text-emerald-deep">
              Step {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-1">{step.title}</h3>
            <p className="mt-2 text-small text-muted">{step.body}</p>
            <div className="mt-auto pt-6">
              <p className="flex items-center gap-2 rounded-md border border-line bg-slate-50 px-3 py-2 text-meta text-muted">
                <CircleCheckIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
                {step.proof}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Explanation({ content }: { content: RoleLandingContent }) {
  const { explanation } = content;

  return (
    <section id="explained" className="scroll-mt-24 border-y border-line bg-slate-50">
      <div className="mx-auto max-w-content px-4 py-16 md:px-6">
        <div className="text-center">
          <p className={eyebrowStyles}>Explain this match</p>
          <h2 className="mt-2">{explanation.title}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-small text-muted">{explanation.intro}</p>
        </div>

        <div className={`${cardStyles} mx-auto mt-8 max-w-feed p-4 md:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-2 font-mono text-meta uppercase tracking-wider text-emerald-deep">
              <SparklesIcon />
              Reasoning ledger
            </p>
            <FitBadge value={content.preview.person.fit} />
          </div>

          <blockquote className="mt-4 font-heading text-base italic text-ink">
            “{explanation.quote}”
          </blockquote>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {explanation.citations.map((citation) => (
              <li key={citation} className="flex items-start gap-2 text-small text-ink">
                <CircleCheckIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
                {citation}
              </li>
            ))}
          </ul>

          <p className="mt-4 flex items-start gap-2 rounded-md border border-alert-amber/30 bg-alert-amber/5 p-3 text-small text-ink">
            <TriangleAlertIcon className="mt-1 h-4 w-4 shrink-0 text-alert-amber" />
            <span>
              <span className="font-medium">Worth checking: </span>
              {explanation.concern}
            </span>
          </p>

          <p className="mt-4 text-meta text-muted">
            Sample explanation. Every claim cites a field from a real profile — anything the facts
            don’t support is dropped before you see it.
          </p>
        </div>
      </div>
    </section>
  );
}

function Control({ content }: { content: RoleLandingContent }) {
  return (
    <section className="mx-auto max-w-content px-4 py-16 md:px-6">
      <div className="grid gap-8 md:grid-cols-2 md:items-start">
        <div>
          <p className={eyebrowStyles}>Control</p>
          <h2 className="mt-2">{content.control.title}</h2>
          <p className="mt-3 max-w-xl text-small text-muted">{content.control.body}</p>
          <div className="mt-6">
            <Link href="/privacy" className={buttonStyles.secondary}>
              Read the privacy policy
            </Link>
          </div>
        </div>
        <ul className={`${cardStyles} flex flex-col gap-4 p-6`}>
          {content.control.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-small text-ink">
              <CircleCheckIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faqs({ content }: { content: RoleLandingContent }) {
  return (
    <section className="border-t border-line bg-slate-50">
      <div className="mx-auto max-w-content px-4 py-16 md:px-6">
        <p className={eyebrowStyles}>Questions</p>
        <h2 className="mt-2">Before you sign up</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {content.faqs.map((faq) => (
            <details key={faq.question} className={`${cardStyles} group p-6`}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md text-base font-medium text-ink">
                {faq.question}
                <ChevronDownIcon
                  className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-small text-muted">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RoleLanding({ content }: { content: RoleLandingContent }) {
  const isInvestor = content.role === "investor";
  const navLinks = [
    { href: "#why", label: isInvestor ? "Why investors" : "Why mentors" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#explained", label: "Explain this match" },
    isInvestor
      ? { href: "/for-mentors", label: "For Mentors" }
      : { href: "/for-investors", label: "For Investors" },
    { href: "/#for-founders", label: "For Founders" },
  ] as const;

  return (
    <>
      <SiteHeader links={navLinks} />
      <main id="main">
        <Hero content={content} />
        <ValueProps content={content} />
        <Steps content={content} />
        <Explanation content={content} />
        <Control content={content} />
        <Faqs content={content} />
        <CtaBand
          eyebrow={content.role === "investor" ? "For investors" : "For mentors"}
          title={content.closing.title}
          body={content.closing.body}
          primary={{ href: "/sign-up", label: content.primaryCta }}
          secondary={{
            href: content.role === "investor" ? "/for-mentors" : "/for-investors",
            label: content.role === "investor" ? "I’m a mentor instead" : "I’m an investor instead",
          }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
