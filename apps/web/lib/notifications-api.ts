import { auth } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";

import { requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";

import type { NotificationsResponse, NotificationSummary } from "@/lib/api-types";

export type NotificationsResult =
  | { status: "ok"; data: NotificationsResponse }
  | { status: "unavailable" };

export async function getNotifications(): Promise<NotificationsResult> {
  const token = await requireToken();
  try {
    const data = await apiRequest<NotificationsResponse>("/v1/notifications?limit=50", { token });
    return { status: "ok", data };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading notifications failed", error);
    return { status: "unavailable" };
  }
}

const emptySummary: NotificationSummary = { unread_count: 0, pending_intros: 0, unread_messages: 0 };

// Shell badges are best-effort: a failed lookup hides the badges instead of breaking every page.
export async function getNotificationSummary(): Promise<NotificationSummary> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    return emptySummary;
  }
  try {
    return await apiRequest<NotificationSummary>("/v1/notifications/summary", { token });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading the notification summary failed", error);
    return emptySummary;
  }
}
