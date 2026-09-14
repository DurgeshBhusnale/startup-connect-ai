import { FlagIcon } from "@/components/icons";
import { milestoneTypeLabel } from "@/lib/posts";

import type { MilestoneData } from "@/lib/api-types";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormat.format(parsed);
}

export function MilestoneCard({ milestone }: { milestone: MilestoneData }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-line bg-white p-4">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-emerald/10 text-emerald-deep"
      >
        <FlagIcon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-meta uppercase tracking-wider text-emerald-deep">
            Milestone · {milestoneTypeLabel(milestone.type)}
          </p>
          <p className="font-mono text-meta text-muted">{formatDate(milestone.achieved_on)}</p>
        </div>
        <p className="mt-1 break-words text-base font-semibold text-ink">
          {milestone.value || "What happened?"}
        </p>
        {milestone.description ? (
          <p className="mt-1 whitespace-pre-line break-words text-small text-muted">
            {milestone.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
