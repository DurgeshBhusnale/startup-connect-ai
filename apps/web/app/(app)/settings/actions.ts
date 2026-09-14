"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";
import { PRIVACY_POLICY_VERSION, isConsentScope, notificationTopicKeys } from "@/lib/privacy";

import type { ActionResult } from "@/lib/action-helpers";
import type {
  ConsentCreatedResponse,
  ConsentScope,
  DeleteAccountResponse,
  NotificationPreferences,
} from "@/lib/api-types";

export async function updateConsent(
  scope: ConsentScope,
  granted: boolean,
): Promise<ActionResult<ConsentCreatedResponse>> {
  if (!isConsentScope(scope) || typeof granted !== "boolean") {
    return { ok: false, error: "That consent option doesn’t exist." };
  }
  const token = await requireToken();
  try {
    const result = await apiRequest<ConsentCreatedResponse>("/v1/consent", {
      method: "POST",
      token,
      body: { scope, granted, policy_version: PRIVACY_POLICY_VERSION },
    });
    // Matching consent changes what every app page shows, including the shell badges.
    revalidatePath("/", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Couldn’t save your choice. Try again.");
  }
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<ActionResult<NotificationPreferences>> {
  const body = Object.fromEntries(
    notificationTopicKeys.map((key) => [key, preferences?.[key] !== false]),
  ) as NotificationPreferences;
  const token = await requireToken();
  try {
    const saved = await apiRequest<NotificationPreferences>("/v1/me/notification-preferences", {
      method: "PUT",
      token,
      body,
    });
    revalidatePath("/settings/notifications");
    return { ok: true, data: saved };
  } catch (error) {
    return actionFailure(error, "Couldn’t save your preferences. Try again.");
  }
}

export async function deleteAccount(
  confirmEmail: string,
): Promise<ActionResult<DeleteAccountResponse>> {
  if (typeof confirmEmail !== "string" || !confirmEmail.trim()) {
    return { ok: false, error: "Type the email address on your account to confirm." };
  }
  const token = await requireToken();
  try {
    const result = await apiRequest<DeleteAccountResponse>("/v1/me/account", {
      method: "DELETE",
      token,
      body: { confirm_email: confirmEmail.trim().slice(0, 320) },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Couldn’t delete your account. Try again.");
  }
}
