"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, isUuid, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";
import { INTRO_MESSAGE_MAX, INTRO_MESSAGE_MIN, isRejectReason } from "@/lib/feedback";

import type { ActionResult } from "@/lib/action-helpers";
import type {
  IntroCreatedResponse,
  IntroDraftResponse,
  MatchActionResponse,
  MatchActionType,
  MatchState,
  RecomputeResponse,
  RejectReason,
} from "@/lib/api-types";

const MATCH_ACTIONS: readonly MatchActionType[] = ["accept", "reject", "save", "unsave", "restore"];
const MISSING_MATCH = "This match no longer exists. Refresh your matches and try again.";

function revalidateMatchPages(): void {
  revalidatePath("/matches");
  revalidatePath("/home");
  revalidatePath("/matches/[matchId]", "page");
}

export async function refreshMatches(): Promise<void> {
  const token = await requireToken();
  try {
    await apiRequest<RecomputeResponse>("/v1/matches/recompute", { method: "POST", token });
  } catch (error) {
    // The page re-fetches below and shows the unavailable state if matching is still down.
    console.error("Refreshing matches failed", error);
  }
  revalidateMatchPages();
}

// Server action arguments come from the browser, so each one is re-validated here.
export async function takeMatchAction(
  matchId: string,
  action: MatchActionType,
  reason: RejectReason | null = null,
  position: number | null = null,
): Promise<ActionResult<MatchState>> {
  if (!isUuid(matchId) || !MATCH_ACTIONS.includes(action)) {
    return { ok: false, error: MISSING_MATCH };
  }
  const safeReason = action === "reject" && isRejectReason(reason) ? reason : null;
  const safePosition =
    typeof position === "number" && Number.isInteger(position) && position >= 0 && position <= 100
      ? position
      : null;
  const token = await requireToken();
  try {
    const result = await apiRequest<MatchActionResponse>(`/v1/matches/${matchId}/action`, {
      method: "POST",
      token,
      body: { action, reason: safeReason, position: safePosition },
    });
    revalidateMatchPages();
    return { ok: true, data: result.updated_match_state };
  } catch (error) {
    return actionFailure(error, "Couldn’t update this match. Try again.");
  }
}

export async function draftIntro(
  matchId: string,
  attempt: number,
): Promise<ActionResult<IntroDraftResponse>> {
  if (!isUuid(matchId)) {
    return { ok: false, error: MISSING_MATCH };
  }
  const safeAttempt = Number.isInteger(attempt) && attempt >= 0 && attempt <= 50 ? attempt : 0;
  const token = await requireToken();
  try {
    const draft = await apiRequest<IntroDraftResponse>(`/v1/matches/${matchId}/draft-intro`, {
      method: "POST",
      token,
      body: { attempt: safeAttempt },
    });
    return { ok: true, data: draft };
  } catch (error) {
    return actionFailure(error, "Couldn’t draft a message right now.");
  }
}

// No revalidation here: the modal shows its own confirmation and refreshes the page on close.
export async function sendIntro(
  matchId: string,
  message: string,
  originalDraft: string | null,
): Promise<ActionResult<IntroCreatedResponse>> {
  if (!isUuid(matchId)) {
    return { ok: false, error: MISSING_MATCH };
  }
  const trimmed = typeof message === "string" ? message.trim() : "";
  if (trimmed.length < INTRO_MESSAGE_MIN || trimmed.length > INTRO_MESSAGE_MAX) {
    return {
      ok: false,
      error: `Your message needs between ${INTRO_MESSAGE_MIN} and ${INTRO_MESSAGE_MAX} characters.`,
    };
  }
  const draft = typeof originalDraft === "string" ? originalDraft.slice(0, INTRO_MESSAGE_MAX) : null;
  const token = await requireToken();
  try {
    const created = await apiRequest<IntroCreatedResponse>(`/v1/matches/${matchId}/intro`, {
      method: "POST",
      token,
      body: { message: trimmed, original_draft: draft },
    });
    return { ok: true, data: created };
  } catch (error) {
    return actionFailure(error, "Couldn’t send your intro request. Try again.");
  }
}
