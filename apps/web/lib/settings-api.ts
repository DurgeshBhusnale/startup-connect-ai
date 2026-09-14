import { unstable_rethrow } from "next/navigation";

import { requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";

import type { ConsentItem, DataExportItem, NotificationPreferences } from "@/lib/api-types";

export async function getConsents(): Promise<ConsentItem[] | null> {
  const token = await requireToken();
  try {
    return await apiRequest<ConsentItem[]>("/v1/me/consents", { token });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading consents failed", error);
    return null;
  }
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const token = await requireToken();
  try {
    return await apiRequest<NotificationPreferences>("/v1/me/notification-preferences", { token });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading notification preferences failed", error);
    return null;
  }
}

export async function getDataExports(): Promise<DataExportItem[]> {
  const token = await requireToken();
  try {
    return await apiRequest<DataExportItem[]>("/v1/me/data-exports", { token });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading data exports failed", error);
    return [];
  }
}
