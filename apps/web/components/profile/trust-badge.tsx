import { ClockIcon, HelpCircleIcon } from "@/components/icons";

import type { TrustSummary } from "@/lib/api-types";

type TrustBadgeProps = {
  trust: TrustSummary | null | undefined;
  /** "pill" for profile headers (S-14); "inline" for cards. */
  variant?: "pill" | "inline";
  className?: string;
};

const EXPLAINER =
  "Based on how they reply to intros and messages and follow through on meetings. Shown after 10 interactions.";

// S7: categorical only; the numeric trust score is never shown (AC2).
export function TrustBadge({ trust, variant = "inline", className = "" }: TrustBadgeProps) {
  if (!trust) return null;

  if (trust.badge === "low") {
    return (
      <p title={EXPLAINER} className={`flex items-center gap-1 text-meta text-muted ${className}`}>
        <HelpCircleIcon className="h-4 w-4 shrink-0" />
        {trust.message}
      </p>
    );
  }

  if (variant === "pill") {
    return (
      <span
        title={EXPLAINER}
        className={`inline-flex items-center gap-1 rounded-full bg-emerald-bright px-3 py-1 text-meta font-medium text-ink ${className}`}
      >
        <ClockIcon className="h-4 w-4 shrink-0" />
        {trust.message}
      </span>
    );
  }

  return (
    <p title={EXPLAINER} className={`flex items-center gap-1 text-small text-emerald-deep ${className}`}>
      <ClockIcon className="h-4 w-4 shrink-0" />
      {trust.message}
    </p>
  );
}
