import { CircleCheckIcon, ShieldCheckIcon } from "@/components/icons";
import { endorsedLabel } from "@/lib/endorsements";

import type { BadgesResponse } from "@/lib/api-types";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Self-reported claims stay visually neutral (M6 AC2): only verified, endorsed, or stale items get a marker.
export function ClaimStatus({ itemId, badges }: { itemId: string; badges: BadgesResponse }) {
  const verified = badges.verified_items.includes(itemId);
  const endorsements = badges.endorsed_items.filter((item) => item.item_id === itemId);
  const endorsed = endorsedLabel(endorsements);
  const lastUpdated = badges.self_reported_stale.includes(itemId)
    ? badges.last_updated[itemId]
    : undefined;

  if (!verified && !endorsed && !lastUpdated) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {verified ? (
        <span
          title="Verified from an external source"
          className="inline-flex items-center gap-1 rounded bg-emerald-bright/15 px-2 py-1 font-mono text-meta font-normal uppercase text-ink"
        >
          <CircleCheckIcon className="h-4 w-4 text-emerald-deep" />
          Verified
        </span>
      ) : null}
      {endorsed ? (
        <span
          title={endorsements.map((item) => item.endorser_name).join(", ")}
          className="inline-flex items-center gap-1 rounded bg-emerald/10 px-2 py-1 text-meta font-normal text-emerald-deep"
        >
          <ShieldCheckIcon className="h-4 w-4" />
          {endorsed}
        </span>
      ) : null}
      {lastUpdated ? (
        <span className="text-meta font-normal text-muted">
          Last updated {dateFormat.format(new Date(lastUpdated))}
        </span>
      ) : null}
    </div>
  );
}
