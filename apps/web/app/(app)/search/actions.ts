"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, isUuid, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";
import { SEARCH_QUERY_MAX, SEARCH_QUERY_MIN } from "@/lib/search";

import type { ActionResult } from "@/lib/action-helpers";
import type { RecentSearch, RequestMatchResponse, SearchResponse } from "@/lib/api-types";

// Server action arguments come from the browser, so each one is re-validated here.
export async function runSearch(
  query: string,
  offset: number,
): Promise<ActionResult<SearchResponse>> {
  const text = typeof query === "string" ? query.trim() : "";
  if (text.length < SEARCH_QUERY_MIN || text.length > SEARCH_QUERY_MAX) {
    return {
      ok: false,
      error: `Searches need between ${SEARCH_QUERY_MIN} and ${SEARCH_QUERY_MAX} characters.`,
    };
  }
  const safeOffset = Number.isInteger(offset) && offset >= 0 && offset <= 45 ? offset : 0;
  const token = await requireToken();
  try {
    const data = await apiRequest<SearchResponse>("/v1/search", {
      method: "POST",
      token,
      body: { query: text, limit: 8, offset: safeOffset },
    });
    return { ok: true, data };
  } catch (error) {
    return actionFailure(error, "Search isn’t available right now. Try again in a moment.");
  }
}

export async function getRecentSearches(): Promise<ActionResult<RecentSearch[]>> {
  const token = await requireToken();
  try {
    const data = await apiRequest<RecentSearch[]>("/v1/search/recent", { token });
    return { ok: true, data };
  } catch (error) {
    return actionFailure(error, "Couldn’t load recent searches.");
  }
}

export async function clearRecentSearches(): Promise<ActionResult<null>> {
  const token = await requireToken();
  try {
    await apiRequest<{ status: "cleared" }>("/v1/search/recent", { method: "DELETE", token });
    return { ok: true, data: null };
  } catch (error) {
    return actionFailure(error, "Couldn’t clear recent searches.");
  }
}

export async function requestMatch(profileId: string): Promise<ActionResult<RequestMatchResponse>> {
  if (!isUuid(profileId)) {
    return { ok: false, error: "This profile is no longer available." };
  }
  const token = await requireToken();
  try {
    const data = await apiRequest<RequestMatchResponse>("/v1/search/request-match", {
      method: "POST",
      token,
      body: { profile_id: profileId },
    });
    revalidatePath("/matches");
    return { ok: true, data };
  } catch (error) {
    return actionFailure(error, "Couldn’t create this match. Try again.");
  }
}
