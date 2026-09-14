import { unstable_rethrow } from "next/navigation";

import { isUuid, requireToken } from "@/lib/action-helpers";
import { ApiError, apiRequest } from "@/lib/api";
import { MESSAGES_PAGE_SIZE } from "@/lib/messages";

import type { MessageItem, ThreadItem, ThreadsResponse } from "@/lib/api-types";

export type ThreadsResult =
  | { status: "ok"; data: ThreadsResponse }
  | { status: "incomplete" }
  | { status: "unavailable" };

export type ConversationResult =
  | { status: "ok"; thread: ThreadItem; messages: MessageItem[]; hasMore: boolean }
  | { status: "closed" }
  | { status: "private" }
  | { status: "unavailable" };

export async function getThreads(): Promise<ThreadsResult> {
  const token = await requireToken();
  try {
    const data = await apiRequest<ThreadsResponse>("/v1/messages/threads", { token });
    return { status: "ok", data };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 409) {
      return { status: "incomplete" };
    }
    console.error("Loading conversations failed", error);
    return { status: "unavailable" };
  }
}

export async function getConversation(matchId: string): Promise<ConversationResult> {
  if (!isUuid(matchId)) {
    return { status: "private" };
  }
  const token = await requireToken();
  try {
    const [thread, messages] = await Promise.all([
      apiRequest<ThreadItem>(`/v1/messages/threads/${matchId}`, { token }),
      apiRequest<MessageItem[]>(`/v1/messages/${matchId}?limit=${MESSAGES_PAGE_SIZE}`, { token }),
    ]);
    return { status: "ok", thread, messages, hasMore: messages.length === MESSAGES_PAGE_SIZE };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.problem?.type.endsWith("/conversation-closed")) {
      return { status: "closed" };
    }
    // Someone else's match reads the same as an unknown one (M10 AC8).
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return { status: "private" };
    }
    console.error("Loading the conversation failed", error);
    return { status: "unavailable" };
  }
}
