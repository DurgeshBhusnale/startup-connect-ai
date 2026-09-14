import { auth } from "@clerk/nextjs/server";
import { redirect, unstable_rethrow } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";

import type { ExplanationResponse, MatchDetailResponse, MatchItem } from "@/lib/api-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MatchesResult =
  | { status: "ok"; matches: MatchItem[] }
  | { status: "incomplete" }
  | { status: "unavailable" };

export type MatchDetailResult =
  | { status: "ok"; detail: MatchDetailResponse }
  | { status: "private" }
  | { status: "unavailable" };

async function requireToken(): Promise<string> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }
  return token;
}

export async function getMatches(limit = 8): Promise<MatchesResult> {
  const token = await requireToken();
  try {
    const matches = await apiRequest<MatchItem[]>(`/v1/matches?limit=${limit}`, { token });
    return { status: "ok", matches };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 409) {
      return { status: "incomplete" };
    }
    console.error("Loading matches failed", error);
    return { status: "unavailable" };
  }
}

export async function getMatchDetail(matchId: string): Promise<MatchDetailResult> {
  // Unknown or malformed ids get the same private state as profiles without a match (M10 AC8).
  if (!UUID_PATTERN.test(matchId)) {
    return { status: "private" };
  }
  const token = await requireToken();
  try {
    const detail = await apiRequest<MatchDetailResponse>(`/v1/matches/${matchId}`, { token });
    return { status: "ok", detail };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 404) {
      return { status: "private" };
    }
    console.error("Loading match detail failed", error);
    return { status: "unavailable" };
  }
}

export async function getMatchExplanation(matchId: string): Promise<ExplanationResponse | null> {
  const token = await requireToken();
  try {
    return await apiRequest<ExplanationResponse>(`/v1/matches/${matchId}/explanation`, { token });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading match explanation failed", error);
    return null;
  }
}
