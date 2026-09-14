"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, isUuid, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";
import { CAL_LINK_HINT, OUTCOME_CHOICES, OUTCOME_NOTES_MAX, toCalLink } from "@/lib/meetings";

import type { ActionResult } from "@/lib/action-helpers";
import type {
  MeetingCreatedResponse,
  MeetingOutcomeResponse,
  NudgeResponse,
  OutcomeChoice,
  SchedulingLinkResponse,
} from "@/lib/api-types";

const MISSING_MATCH = "This match no longer exists. Refresh your matches and try again.";
const BOOKING_UID = /^[A-Za-z0-9_-]{1,200}$/;

export type BookedEvent = {
  uid: string;
  startTime: string;
  endTime: string | null;
  title: string | null;
  videoCallUrl: string | null;
};

function revalidateMeetingPages(): void {
  revalidatePath("/matches/[matchId]", "page");
  revalidatePath("/matches/[matchId]/schedule", "page");
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

// Server action arguments come from the browser, so each one is re-validated here.
export async function recordMeeting(
  matchId: string,
  booking: BookedEvent,
  host: "partner" | "me",
): Promise<ActionResult<MeetingCreatedResponse>> {
  if (!isUuid(matchId)) {
    return { ok: false, error: MISSING_MATCH };
  }
  const scheduledAt = isoOrNull(booking?.startTime);
  if (!scheduledAt || typeof booking.uid !== "string" || !BOOKING_UID.test(booking.uid)) {
    return { ok: false, error: "We couldn’t read that booking. Refresh to check your meeting." };
  }
  const video = typeof booking.videoCallUrl === "string" ? booking.videoCallUrl.slice(0, 500) : null;
  const token = await requireToken();
  try {
    const created = await apiRequest<MeetingCreatedResponse>("/v1/meetings", {
      method: "POST",
      token,
      body: {
        match_id: matchId,
        scheduled_at: scheduledAt,
        ends_at: isoOrNull(booking.endTime),
        cal_event_id: booking.uid,
        host: host === "me" ? "me" : "partner",
        title: typeof booking.title === "string" ? booking.title.slice(0, 200) : null,
        video_url: video?.startsWith("https://") ? video : null,
      },
    });
    revalidateMeetingPages();
    return { ok: true, data: created };
  } catch (error) {
    return actionFailure(error, "Your booking went through, but we couldn’t save it here.");
  }
}

export async function nudgeToSchedule(matchId: string): Promise<ActionResult<NudgeResponse>> {
  if (!isUuid(matchId)) {
    return { ok: false, error: MISSING_MATCH };
  }
  const token = await requireToken();
  try {
    const result = await apiRequest<NudgeResponse>(`/v1/matches/${matchId}/scheduling/nudge`, {
      method: "POST",
      token,
    });
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Couldn’t send that right now. Try again.");
  }
}

export async function submitMeetingOutcome(
  meetingId: string,
  outcome: OutcomeChoice,
  notes: string,
): Promise<ActionResult<MeetingOutcomeResponse>> {
  if (!isUuid(meetingId) || !OUTCOME_CHOICES.includes(outcome)) {
    return { ok: false, error: "This meeting no longer exists. Refresh and try again." };
  }
  const trimmed = typeof notes === "string" ? notes.trim() : "";
  if (trimmed.length > OUTCOME_NOTES_MAX) {
    return { ok: false, error: `Notes can be up to ${OUTCOME_NOTES_MAX} characters.` };
  }
  const token = await requireToken();
  try {
    const saved = await apiRequest<MeetingOutcomeResponse>(`/v1/meetings/${meetingId}/outcome`, {
      method: "POST",
      token,
      body: { outcome, notes: trimmed || null },
    });
    revalidatePath("/meetings/[meetingId]/outcome", "page");
    return { ok: true, data: saved };
  } catch (error) {
    return actionFailure(error, "Couldn’t save your outcome. Try again.");
  }
}

export async function saveSchedulingLink(
  url: string,
): Promise<ActionResult<SchedulingLinkResponse>> {
  const link = typeof url === "string" ? toCalLink(url.slice(0, 300)) : null;
  if (!link) {
    return { ok: false, error: CAL_LINK_HINT };
  }
  const token = await requireToken();
  try {
    const saved = await apiRequest<SchedulingLinkResponse>("/v1/profiles/me/scheduling-link", {
      method: "PUT",
      token,
      body: { url: link },
    });
    revalidatePath("/settings/account");
    revalidateMeetingPages();
    return { ok: true, data: saved };
  } catch (error) {
    return actionFailure(error, "Couldn’t save your booking link. Try again.");
  }
}

export async function removeSchedulingLink(): Promise<ActionResult<SchedulingLinkResponse>> {
  const token = await requireToken();
  try {
    const saved = await apiRequest<SchedulingLinkResponse>("/v1/profiles/me/scheduling-link", {
      method: "DELETE",
      token,
    });
    revalidatePath("/settings/account");
    revalidateMeetingPages();
    return { ok: true, data: saved };
  } catch (error) {
    return actionFailure(error, "Couldn’t remove your booking link. Try again.");
  }
}
