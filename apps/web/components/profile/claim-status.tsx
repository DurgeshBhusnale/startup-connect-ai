import { CircleCheckIcon, ShieldCheckIcon } from "@/components/icons";

import type { BadgesResponse } from "@/lib/api-types";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Self-reported claims stay visually neutral (M6 AC2): only verified, endorsed, or stale items get a marker.
export function ClaimStatus({ itemId, badges }: { itemId: string; badges: BadgesResponse }) {
  const verified = badges.verified_items.includes(itemId);
  const endorsement = badges.endorsed_items.find((item) => item.item_id === itemId);
  const lastUpdated = badges.self_reported_stale.includes(itemId)
    ? badges.last_updated[itemId]
    : undefined;

  if (!verified && !endorsement && !lastUpdated) {
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
      {endorsement ? (
        <span className="inline-flex items-center gap-1 rounded bg-emerald/10 px-2 py-1 text-meta font-normal text-emerald-deep">
          <ShieldCheckIcon className="h-4 w-4" />
          Endorsed by {endorsement.endorser_name}
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
