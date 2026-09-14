import { unstable_rethrow } from "next/navigation";

import { isUuid, requireToken } from "@/lib/action-helpers";
import { ApiError, apiRequest } from "@/lib/api";

import type {
  MeetingOutcomeContext,
  SchedulingContext,
  SchedulingLinkResponse,
} from "@/lib/api-types";

export type SchedulingContextResult =
  | { status: "ok"; context: SchedulingContext }
  | { status: "private" }
  | { status: "unavailable" };

export async function getSchedulingContext(matchId: string): Promise<SchedulingContextResult> {
  if (!isUuid(matchId)) {
    return { status: "private" };
  }
  const token = await requireToken();
  try {
    const context = await apiRequest<SchedulingContext>(`/v1/matches/${matchId}/scheduling`, {
      token,
    });
    return { status: "ok", context };
  } catch (error) {
    unstable_rethrow(error);
    // Someone else's match reads the same as an unknown one (M10 AC8).
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return { status: "private" };
    }
    console.error("Loading scheduling context failed", error);
    return { status: "unavailable" };
  }
}

export type MeetingOutcomeResult =
  | { status: "ok"; context: MeetingOutcomeContext }
  | { status: "missing" }
  | { status: "unavailable" };

export async function getMeetingOutcomeContext(meetingId: string): Promise<MeetingOutcomeResult> {
  if (!isUuid(meetingId)) {
    return { status: "missing" };
  }
  const token = await requireToken();
  try {
    const context = await apiRequest<MeetingOutcomeContext>(`/v1/meetings/${meetingId}/outcome`, {
      token,
    });
    return { status: "ok", context };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return { status: "missing" };
    }
    console.error("Loading meeting outcome failed", error);
    return { status: "unavailable" };
  }
}

export async function getSchedulingLink(): Promise<SchedulingLinkResponse | null> {
  const token = await requireToken();
  try {
    return await apiRequest<SchedulingLinkResponse>("/v1/profiles/me/scheduling-link", { token });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading scheduling link failed", error);
    return null;
  }
}
