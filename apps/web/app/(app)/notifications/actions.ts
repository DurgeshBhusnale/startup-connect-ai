"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isUuid, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";

// Only same-site paths: rejects protocol-relative ("//host") and backslash tricks ("/\host").
function safeInternalPath(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && /^\/(?![/\\])/.test(value)) {
    return value;
  }
  return "/notifications";
}

export async function openNotification(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const target = safeInternalPath(formData.get("href"));
  if (isUuid(id)) {
    const token = await requireToken();
    try {
      await apiRequest(`/v1/notifications/${id}/read`, { method: "POST", token });
    } catch (error) {
      // Opening the target matters more than the read marker.
      console.error("Marking a notification read failed", error);
    }
  }
  revalidatePath("/", "layout");
  redirect(target);
}

export async function markAllNotificationsRead(): Promise<void> {
  const token = await requireToken();
  try {
    await apiRequest("/v1/notifications/read-all", { method: "POST", token });
  } catch (error) {
    console.error("Marking all notifications read failed", error);
  }
  revalidatePath("/", "layout");
}
