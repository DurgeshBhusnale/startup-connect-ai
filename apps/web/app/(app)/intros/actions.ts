"use server";

import { actionFailure, isUuid, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";
import { isRejectReason } from "@/lib/feedback";

import type { ActionResult } from "@/lib/action-helpers";
import type { IntroRespondResponse, RejectReason } from "@/lib/api-types";

// No revalidation: the card shows its own accepted / declined state until the next visit.
export async function respondToIntro(
  introId: string,
  action: "accept" | "decline",
  reason: RejectReason | null = null,
): Promise<ActionResult<IntroRespondResponse>> {
  if (!isUuid(introId) || (action !== "accept" && action !== "decline")) {
    return { ok: false, error: "This intro request no longer exists." };
  }
  const safeReason = action === "decline" && isRejectReason(reason) ? reason : null;
  const token = await requireToken();
  try {
    const result = await apiRequest<IntroRespondResponse>(`/v1/intros/${introId}/respond`, {
      method: "POST",
      token,
      body: { action, reason: safeReason },
    });
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Couldn’t respond to this intro. Try again.");
  }
}
