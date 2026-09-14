import Link from "next/link";

import { MapPinIcon, SparklesIcon } from "@/components/icons";
import { FitBadge } from "@/components/ui/fit-badge";
import { cardStyles } from "@/lib/ui";

import type { MatchItem } from "@/lib/api-types";

const HIGH_FIT = 0.8;

const kindLabels: Record<MatchItem["to_profile"]["kind"], string> = {
  founder: "Founder",
  investor: "Investor",
  mentor: "Mentor",
};

function initialsFor(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "SC";
}

type MatchCardProps = {
  match: MatchItem;
  compact?: boolean;
};

export function MatchCard({ match, compact = false }: MatchCardProps) {
  const profile = match.to_profile;
  const percent = Math.round(match.fit_score * 100);

  return (
    <article
      aria-label={`${profile.display_name}, ${percent}% fit`}
      className={`${cardStyles} relative flex h-full flex-col gap-4 p-6 transition-colors hover:bg-slate-50 ${
        match.fit_score >= HIGH_FIT ? "border-l-4 border-l-emerald-bright" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink font-heading text-base text-white"
          >
            {initialsFor(profile.display_name)}
          </span>
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 font-heading text-h4 text-ink">
              {/* Stretched link: the whole card opens Match Detail (S-14). */}
              <Link
                href={`/matches/${match.match_id}`}
                className="truncate hover:underline focus:outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-emerald/30"
              >
                {profile.display_name}
              </Link>
              <span className="rounded bg-slate-100 px-2 py-1 font-mono text-meta font-normal uppercase tracking-wider text-ink">
                {kindLabels[profile.kind]}
              </span>
            </h3>
            <p className="mt-1 text-small text-muted">{profile.headline}</p>
          </div>
        </div>
        <FitBadge value={percent} />
      </div>

      {!compact && (profile.facts.length > 0 || profile.location) ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small text-ink">
          {profile.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
          {profile.location ? (
            <li className="flex items-center gap-1">
              <MapPinIcon className="h-4 w-4 text-muted" />
              {profile.location}
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-auto rounded-md bg-slate-50 p-4">
        <p className="flex items-center gap-2 font-mono text-meta uppercase tracking-wider text-emerald-deep">
          <SparklesIcon />
          Why this match
        </p>
        <p className="mt-2 text-small text-muted">{match.explanation.short}</p>
      </div>

      {!compact && profile.bio ? (
        <p className="line-clamp-2 text-small text-muted">{profile.bio}</p>
      ) : null}
    </article>
  );
}
