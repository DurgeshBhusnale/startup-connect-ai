import { redirect } from "next/navigation";

import { SparklesIcon } from "@/components/icons";
import { MatchCard } from "@/components/matches/match-card";
import { RefreshButton } from "@/components/matches/refresh-button";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryButton } from "@/components/ui/retry-button";
import { getMatches } from "@/lib/matches-api";
import { getMe } from "@/lib/me";
import { cardStyles } from "@/lib/ui";

import { refreshMatches } from "./actions";

import type { AppRole } from "@/lib/api-types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Matches" };

const subtitles: Record<AppRole, string> = {
  founder: "Investors and mentors ranked by fit, each with a plain-language reason.",
  investor: "Founders who fit your thesis, ranked by fit.",
  mentor: "Founders at the stages you mentor, ranked by fit.",
};

const setupLinks: Record<AppRole, string> = {
  founder: "/onboarding/founder",
  investor: "/onboarding/investor",
  mentor: "/onboarding/mentor",
};

export default async function MatchesPage() {
  const me = await getMe();
  if (!me.role) {
    redirect("/onboarding");
  }
  const result = await getMatches(8);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-h1 text-ink">Your matches</h1>
          <p className="text-small text-muted">{subtitles[me.role]}</p>
        </div>
        {result.status === "ok" ? (
          <form action={refreshMatches}>
            <RefreshButton />
          </form>
        ) : null}
      </div>

      {result.status === "incomplete" ? (
        <section className={`${cardStyles} p-6`}>
          <EmptyState
            icon={<SparklesIcon className="h-8 w-8" />}
            title="Finish your profile first"
            body="Matching uses your profile, so complete it to see who fits."
            action={{ href: setupLinks[me.role], label: "Complete your profile" }}
          />
        </section>
      ) : null}

      {result.status === "unavailable" ? (
        <section className={`${cardStyles} flex flex-col items-center gap-4 p-6`}>
          <EmptyState
            icon={<SparklesIcon className="h-8 w-8" />}
            title="Finding matches for you…"
            body="Check back in a few minutes."
          />
          <RetryButton />
        </section>
      ) : null}

      {result.status === "ok" && result.matches.length === 0 ? (
        <section className={`${cardStyles} p-6`}>
          <EmptyState
            icon={<SparklesIcon className="h-8 w-8" />}
            title="No matches yet"
            body="Try posting an update or broadening your criteria."
            action={{ href: "/profile", label: "Review your profile" }}
          />
        </section>
      ) : null}

      {result.status === "ok" && result.matches.length > 0 ? (
        <>
          <p className="font-mono text-meta uppercase tracking-wider text-muted">
            {result.matches.length} {result.matches.length === 1 ? "match" : "matches"} · sorted by fit
          </p>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {result.matches.map((match) => (
              <li key={match.match_id}>
                <MatchCard match={match} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
