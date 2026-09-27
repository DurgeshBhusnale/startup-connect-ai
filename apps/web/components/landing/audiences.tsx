import Link from "next/link";

import {
  ArrowRightIcon,
  BanknoteIcon,
  CircleCheckIcon,
  LightbulbIcon,
  RocketIcon,
} from "@/components/icons";
import { buttonStyles, cardStyles, eyebrowStyles } from "@/lib/ui";

import type { IconComponent } from "@/components/icons";

type Audience = {
  id: string;
  icon: IconComponent;
  eyebrow: string;
  title: string;
  body: string;
  points: readonly string[];
  cta: { href: string; label: string; variant: "primary" | "secondary" };
};

const audiences: readonly Audience[] = [
  {
    id: "for-founders",
    icon: RocketIcon,
    eyebrow: "For founders",
    title: "You’re raising.",
    body: "Stop sending cold DMs into the void. Your deck becomes a structured profile, and the investors and mentors who fit it come back ranked.",
    points: [
      "Deck parsed into a profile in minutes — nothing stored without you",
      "Ranked investors and mentors, each with a written reason",
      "You request the intro; messaging opens when both sides agree",
    ],
    cta: { href: "/sign-up", label: "Create founder profile", variant: "primary" },
  },
  {
    id: "for-investors",
    icon: BanknoteIcon,
    eyebrow: "For investors",
    title: "You’re writing cheques.",
    body: "Your thesis does the filtering. Sectors, stages, cheque range, geographies and no-gos decide who reaches your queue — before you open it.",
    points: [
      "Founders below your fit threshold are never shown",
      "Every match cites the fields it was scored on",
      "No cold pitches — you accept or decline each intro",
    ],
    cta: { href: "/for-investors", label: "See it from the investor side", variant: "secondary" },
  },
  {
    id: "for-mentors",
    icon: LightbulbIcon,
    eyebrow: "For mentors",
    title: "You’re giving time.",
    body: "Matched on the expertise you actually have and the stages you’re useful at — so the founders who reach you are asking for something you can answer.",
    points: [
      "Expertise areas and stages drive the match, not follower counts",
      "Availability, session fee and every accept stay your call",
      "Founders arrive with their stage and current ask on the profile",
    ],
    cta: { href: "/for-mentors", label: "See it from the mentor side", variant: "secondary" },
  },
];

export function Audiences() {
  return (
    <section id="audiences" className="scroll-mt-24 border-t border-line bg-slate-50">
      <div className="mx-auto max-w-content px-4 py-16 md:px-6">
        <div className="max-w-2xl">
          <p className={eyebrowStyles}>Choose your side</p>
          <h2 className="mt-2">Which side of the table are you on?</h2>
          <p className="mt-2 text-small text-muted">
            Founders can start right here. If you invest or mentor, the matching, the controls and
            the privacy defaults work differently for you — so each side gets its own walkthrough.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {audiences.map((audience) => (
            <article
              key={audience.id}
              id={audience.id}
              className={`${cardStyles} flex scroll-mt-24 flex-col p-6 md:p-8`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald/10 text-emerald-deep">
                <audience.icon className="h-6 w-6" />
              </span>
              <p className={`${eyebrowStyles} mt-4`}>{audience.eyebrow}</p>
              <h3 className="mt-1 text-h3">{audience.title}</h3>
              <p className="mt-3 text-small text-muted">{audience.body}</p>
              <ul className="mt-6 flex flex-col gap-3">
                {audience.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-small text-ink">
                    <CircleCheckIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <Link href={audience.cta.href} className={buttonStyles[audience.cta.variant]}>
                  {audience.cta.label}
                  {audience.cta.variant === "secondary" ? <ArrowRightIcon /> : null}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
