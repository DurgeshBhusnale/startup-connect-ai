"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, isUuid, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";
import { isEndorsableItem } from "@/lib/endorsements";

import type { ActionResult } from "@/lib/action-helpers";
import type { EndorsementCreatedResponse, EndorsementItemKind } from "@/lib/api-types";

const UNAVAILABLE = "This claim can’t be endorsed right now. Refresh and try again.";

function revalidateEndorsementPages(): void {
  revalidatePath("/matches/[matchId]", "page");
  revalidatePath("/profile");
}

// Server action arguments come from the browser, so each one is re-validated here.
export async function endorseClaim(
  profileId: string,
  itemId: string,
  itemKind: EndorsementItemKind,
): Promise<ActionResult<EndorsementCreatedResponse>> {
  if (
    !isUuid(profileId) ||
    (itemKind !== "profile_field" && itemKind !== "milestone") ||
    typeof itemId !== "string" ||
    !isEndorsableItem(itemId, itemKind)
  ) {
    return { ok: false, error: UNAVAILABLE };
  }
  const token = await requireToken();
  try {
    const created = await apiRequest<EndorsementCreatedResponse>("/v1/endorsements", {
      method: "POST",
      token,
      body: { target_profile_id: profileId, target_item_id: itemId, target_item_kind: itemKind },
    });
    revalidateEndorsementPages();
    return { ok: true, data: created };
  } catch (error) {
    return actionFailure(error, "Couldn’t save your endorsement. Try again.");
  }
}

export async function revokeEndorsement(
  endorsementId: string,
): Promise<ActionResult<{ status: "revoked" }>> {
  if (!isUuid(endorsementId)) {
    return { ok: false, error: UNAVAILABLE };
  }
  const token = await requireToken();
  try {
    const result = await apiRequest<{ status: "revoked" }>(`/v1/endorsements/${endorsementId}`, {
      method: "DELETE",
      token,
    });
    revalidateEndorsementPages();
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Couldn’t remove your endorsement. Try again.");
  }
}
