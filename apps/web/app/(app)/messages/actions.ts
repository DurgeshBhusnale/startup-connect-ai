"use server";

import { actionFailure, isUuid, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";
import { MESSAGE_MAX, MESSAGES_PAGE_SIZE } from "@/lib/messages";

import type { ActionResult } from "@/lib/action-helpers";
import type { MessageCreatedResponse, MessageItem, MessagesReadResponse } from "@/lib/api-types";

const MISSING_THREAD = "This conversation isn’t available. Refresh and try again.";

// Server action arguments come from the browser, so each one is re-validated here.
export async function sendMessage(
  matchId: string,
  body: string,
  clientRef: string,
): Promise<ActionResult<MessageItem>> {
  if (!isUuid(matchId) || !isUuid(clientRef)) {
    return { ok: false, error: MISSING_THREAD };
  }
  const trimmed = typeof body === "string" ? body.trim() : "";
  if (!trimmed) {
    return { ok: false, error: "Write a message before sending." };
  }
  if (trimmed.length > MESSAGE_MAX) {
    return { ok: false, error: `Messages can be up to ${MESSAGE_MAX} characters.` };
  }
  const token = await requireToken();
  try {
    const created = await apiRequest<MessageCreatedResponse>(`/v1/messages/${matchId}`, {
      method: "POST",
      token,
      body: { body: trimmed, client_ref: clientRef },
    });
    return { ok: true, data: created.message };
  } catch (error) {
    return actionFailure(error, "Message not sent. Check your connection and try again.");
  }
}

export async function markThreadRead(matchId: string): Promise<ActionResult<MessagesReadResponse>> {
  if (!isUuid(matchId)) {
    return { ok: false, error: MISSING_THREAD };
  }
  const token = await requireToken();
  try {
    const result = await apiRequest<MessagesReadResponse>(`/v1/messages/${matchId}/read`, {
      method: "POST",
      token,
    });
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Couldn’t update read status.");
  }
}

/** The newest page, or the page before `before` (an ISO timestamp). */
export async function loadMessages(
  matchId: string,
  before: string | null,
): Promise<ActionResult<MessageItem[]>> {
  if (!isUuid(matchId)) {
    return { ok: false, error: MISSING_THREAD };
  }
  const cursor = typeof before === "string" && !Number.isNaN(Date.parse(before)) ? before : null;
  const query = new URLSearchParams({ limit: String(MESSAGES_PAGE_SIZE) });
  if (cursor) {
    query.set("before", new Date(cursor).toISOString());
  }
  const token = await requireToken();
  try {
    const items = await apiRequest<MessageItem[]>(`/v1/messages/${matchId}?${query.toString()}`, {
      token,
    });
    return { ok: true, data: items };
  } catch (error) {
    return actionFailure(error, "Couldn’t load messages. Try again.");
  }
}
