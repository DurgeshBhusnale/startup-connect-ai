import type { EndorsementItemKind, ProfileEndorsements } from "@/lib/api-types";

// Mirrors ENDORSABLE_FIELDS in apps/api/app/models/endorsements.py.
export const ENDORSABLE_FIELD_IDS = [
  "l1.sector",
  "l1.stage",
  "l1.ask_amount_inr",
  "l1.team_size",
  "l1.business_model",
  "l1.city",
  "l1.description",
] as const;

const POST_ITEM = /^post:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type EndorseContext = {
  profileId: string;
  firstName: string;
  data: ProfileEndorsements;
};

export function milestoneItemId(postId: string): string {
  return `post:${postId}`;
}

export function isEndorsableItem(itemId: string, kind: EndorsementItemKind): boolean {
  if (kind === "milestone") return POST_ITEM.test(itemId);
  return (ENDORSABLE_FIELD_IDS as readonly string[]).includes(itemId);
}

/** "Endorsed by Meera Iyer and 2 others", or null when nobody endorsed the claim. */
export function endorsedLabel(
  endorsements: readonly { endorser_name: string; endorser_active: boolean }[],
): string | null {
  if (endorsements.length === 0) return null;
  const active = endorsements.filter((item) => item.endorser_active);
  const lead = active[0];
  if (!lead) return "Endorser account inactive";
  const others = endorsements.length - 1;
  return others > 0
    ? `Endorsed by ${lead.endorser_name} and ${others} ${others === 1 ? "other" : "others"}`
    : `Endorsed by ${lead.endorser_name}`;
}
