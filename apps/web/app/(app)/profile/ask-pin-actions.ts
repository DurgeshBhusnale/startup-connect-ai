"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";
import { ASK_PIN_MAX, normalizeAskPin } from "@/lib/ask-pin";

import type { ActionResult } from "@/lib/action-helpers";
import type { AskPinResponse } from "@/lib/api-types";

function revalidateProfilePages(): void {
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath("/matches/[matchId]", "page");
}

// Server action arguments come from the browser, so the text is re-validated here.
export async function saveAskPin(text: string): Promise<ActionResult<AskPinResponse>> {
  const normalized = typeof text === "string" ? normalizeAskPin(text) : "";
  if (!normalized) {
    return { ok: false, error: "Write what you’re asking for, or clear the pin." };
  }
  if (normalized.length > ASK_PIN_MAX) {
    return { ok: false, error: `Keep your ask to ${ASK_PIN_MAX} characters or fewer.` };
  }
  const token = await requireToken();
  try {
    const saved = await apiRequest<AskPinResponse>("/v1/profiles/me/ask-pin", {
      method: "POST",
      token,
      body: { text: normalized },
    });
    revalidateProfilePages();
    return { ok: true, data: saved };
  } catch (error) {
    return actionFailure(error, "Couldn’t save your ask. Try again.");
  }
}

export async function clearAskPin(): Promise<ActionResult<AskPinResponse>> {
  const token = await requireToken();
  try {
    const cleared = await apiRequest<AskPinResponse>("/v1/profiles/me/ask-pin", {
      method: "DELETE",
      token,
    });
    revalidateProfilePages();
    return { ok: true, data: cleared };
  } catch (error) {
    return actionFailure(error, "Couldn’t clear your ask. Try again.");
  }
}
