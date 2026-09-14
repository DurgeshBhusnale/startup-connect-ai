import { auth } from "@clerk/nextjs/server";
import { redirect, unstable_rethrow } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";

import type { MatchItem } from "@/lib/api-types";

export type MatchesResult =
  | { status: "ok"; matches: MatchItem[] }
  | { status: "incomplete" }
  | { status: "unavailable" };

export async function getMatches(limit = 8): Promise<MatchesResult> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }
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
