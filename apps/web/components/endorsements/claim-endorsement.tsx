import { ShieldCheckIcon } from "@/components/icons";
import { endorsedLabel } from "@/lib/endorsements";

import { EndorseControl } from "./endorse-control";

import type { EndorsementItemKind } from "@/lib/api-types";
import type { EndorseContext } from "@/lib/endorsements";

type ClaimEndorsementProps = {
  endorse: EndorseContext;
  itemId: string;
  itemKind: EndorsementItemKind;
  label: string;
  value: string;
  /** Profile facts already show the badge through ClaimStatus; milestones need it here. */
  showBadge?: boolean;
  className?: string;
};

export function ClaimEndorsement({
  endorse,
  itemId,
  itemKind,
  label,
  value,
  showBadge = false,
  className = "",
}: ClaimEndorsementProps) {
  const items = endorse.data.items.filter((item) => item.item_id === itemId);
  const mine = items.find((item) => item.is_mine)?.endorsement_id ?? null;
  const badge = showBadge ? endorsedLabel(items) : null;
  if (!badge && !mine && !endorse.data.can_endorse) return null;

  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      {badge ? (
        <span
          title={items.map((item) => item.endorser_name).join(", ")}
          className="inline-flex items-center gap-1 rounded bg-emerald/10 px-2 py-1 text-meta font-normal text-emerald-deep"
        >
          <ShieldCheckIcon className="h-4 w-4" />
          {badge}
        </span>
      ) : null}
      <EndorseControl
        key={mine ?? "none"}
        profileId={endorse.profileId}
        itemId={itemId}
        itemKind={itemKind}
        claimLabel={label}
        claimValue={value}
        founderFirstName={endorse.firstName}
        mineId={mine}
        canEndorse={endorse.data.can_endorse}
      />
    </div>
  );
}
