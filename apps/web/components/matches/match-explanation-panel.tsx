import { CheckIcon, CircleCheckIcon, TriangleAlertIcon } from "@/components/icons";
import { RetryButton } from "@/components/ui/retry-button";
import { getMatchExplanation } from "@/lib/matches-api";
import { cardStyles, eyebrowStyles } from "@/lib/ui";

import { CitedText } from "./cited-text";

import type { FeatureScore } from "@/lib/api-types";

const STRONG_SIGNAL = 0.7;

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function fitLabel(fitScore: number): string {
  if (fitScore >= 0.8) return "Strong fit";
  if (fitScore >= 0.65) return "Good fit";
  return "Partial fit";
}

function ScoringDetails({ scoring }: { scoring: FeatureScore[] }) {
  const totalWeight = scoring.reduce((sum, item) => sum + item.weight, 0) || 1;
  return (
    <section aria-labelledby="scoring-heading" className={`${cardStyles} p-6`}>
      <h3 id="scoring-heading" className="text-h4">
        Scoring details
      </h3>
      <p className="mt-1 text-meta text-muted">
        Each signal is scored from 0 to 1, then weighted into the fit score.
      </p>
      <ul className="mt-4 flex flex-col gap-4">
        {scoring.map((item) => {
          const percent = Math.round(item.score * 100);
          return (
            <li key={item.feature}>
              <div className="flex items-center justify-between gap-3 text-small">
                <span className="text-ink">
                  {item.label}
                  <span className="ml-2 text-meta text-muted">
                    weight {Math.round((item.weight / totalWeight) * 100)}%
                  </span>
                </span>
                <span className="font-mono text-ink">{item.score.toFixed(2)}</span>
              </div>
              <div
                role="meter"
                aria-label={`${item.label} score`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
              >
                {/* Width is data-driven, so it can't be a static Tailwind class. */}
                <div
                  className={`h-full rounded-full ${item.score >= STRONG_SIGNAL ? "bg-emerald" : "bg-alert-amber"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type MatchExplanationPanelProps = {
  matchId: string;
  firstName: string;
  fitScore: number;
  updatedAt: string;
  scoring: FeatureScore[];
};

export async function MatchExplanationPanel({
  matchId,
  firstName,
  fitScore,
  updatedAt,
  scoring,
}: MatchExplanationPanelProps) {
  const explanation = await getMatchExplanation(matchId);
  const percent = Math.round(fitScore * 100);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="why-heading" className={`${cardStyles} p-6`}>
        <p className={eyebrowStyles}>Match explanation</p>
        <h2 id="why-heading" className="mt-2 text-h2">
          Why we matched you with {firstName}
        </h2>
        <div className="mt-6 flex flex-col gap-4 rounded-md bg-slate-50 p-4 sm:flex-row sm:items-center sm:gap-6">
          <p className="flex shrink-0 items-baseline gap-2">
            <span className="font-heading text-h1 text-emerald-deep">{percent}%</span>
            <span className="text-base font-medium text-ink">fit</span>
          </p>
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-ink">{fitLabel(fitScore)}</p>
            {explanation ? (
              <p className="text-small text-ink">
                <CitedText
                  text={explanation.short}
                  citations={explanation.citations}
                  idPrefix="short"
                />
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-4 text-meta text-muted">
          {explanation?.source === "llm"
            ? "Written by AI using only the scoring signals below."
            : "Summarised from the scoring signals below."}{" "}
          Scores updated {dateFormat.format(new Date(updatedAt))}. Hover or focus an underlined value
          to see where it came from.
        </p>
      </section>

      {explanation === null ? (
        <section className={`${cardStyles} flex flex-col items-start gap-4 p-6`}>
          <p className="text-small text-ink">
            We couldn’t load the full explanation right now. The scoring details below are still
            accurate.
          </p>
          <RetryButton />
        </section>
      ) : null}

      {explanation && explanation.full.positives.length > 0 ? (
        <section
          aria-labelledby="signals-heading"
          className="rounded-lg border border-l-4 border-line border-l-emerald-bright bg-white p-6 shadow-card"
        >
          <h3
            id="signals-heading"
            className="flex items-center gap-2 font-mono text-meta uppercase tracking-wider text-emerald-deep"
          >
            <CircleCheckIcon className="h-4 w-4" />
            Strong signals ({explanation.full.positives.length})
          </h3>
          <ul className="mt-4 flex flex-col gap-3">
            {explanation.full.positives.map((text, index) => (
              <li key={index} className="flex items-start gap-2 text-small text-ink">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
                <span>
                  <CitedText
                    text={text}
                    citations={explanation.citations}
                    idPrefix={`positive-${index}`}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {explanation && explanation.full.concerns.length > 0 ? (
        <section
          aria-labelledby="concerns-heading"
          className="rounded-lg border border-l-4 border-line border-l-alert-amber bg-white p-6 shadow-card"
        >
          <h3
            id="concerns-heading"
            className="flex items-center gap-2 font-mono text-meta uppercase tracking-wider text-ink"
          >
            <TriangleAlertIcon className="h-4 w-4 text-alert-amber" />
            Considerations ({explanation.full.concerns.length})
          </h3>
          <ul className="mt-4 flex flex-col gap-3">
            {explanation.full.concerns.map((text, index) => (
              <li key={index} className="flex items-start gap-2 text-small text-ink">
                <TriangleAlertIcon className="mt-1 h-4 w-4 shrink-0 text-alert-amber" />
                <span>
                  <CitedText
                    text={text}
                    citations={explanation.citations}
                    idPrefix={`concern-${index}`}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ScoringDetails scoring={scoring} />
    </div>
  );
}

export function MatchExplanationSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <section className={`${cardStyles} flex flex-col gap-4 p-6`}>
        <div className="h-3 w-32 animate-pulse rounded-md bg-slate-100" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded-md bg-slate-100" />
        <div className="h-24 animate-pulse rounded-md bg-slate-100" />
        <p role="status" className="text-small text-muted">
          Writing the explanation…
        </p>
      </section>
      <section className={`${cardStyles} flex flex-col gap-3 p-6`}>
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-4 animate-pulse rounded-md bg-slate-100" />
        ))}
      </section>
    </div>
  );
}
