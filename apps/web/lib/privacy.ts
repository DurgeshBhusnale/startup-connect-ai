import type { ConsentScope, NotificationPreferences } from "@/lib/api-types";

// Mirrors CONSENT_POLICY_VERSION in apps/api/app/config.py; bump both when the policy changes.
export const PRIVACY_POLICY_VERSION = "2026-09-13";

export const consentCopy: Record<ConsentScope, { title: string; body: string }> = {
  terms_privacy: {
    title: "Terms of Service and Privacy Policy",
    body: "Required to use Startup Connect AI. To withdraw it, delete your account.",
  },
  match_processing: {
    title: "Use my profile data to compute matches",
    body: "Lets us compare your profile with others to suggest matches. Turning this off hides your profile and pauses matching.",
  },
  email_notifications: {
    title: "Email notifications about matches",
    body: "Emails about intro requests and new matches once email delivery launches. Until then, these arrive in the app.",
  },
  whatsapp_notifications: {
    title: "WhatsApp notifications",
    body: "Messages about intros from our WhatsApp business number once it launches. Off unless you opt in.",
  },
};

const CONSENT_SCOPES: readonly ConsentScope[] = [
  "terms_privacy",
  "match_processing",
  "email_notifications",
  "whatsapp_notifications",
];

export function isConsentScope(value: unknown): value is ConsentScope {
  return CONSENT_SCOPES.some((scope) => scope === value);
}

export const notificationTopicKeys = [
  "new_matches",
  "intro_requests",
  "mutual_matches",
  "interest",
  "meetings",
] as const satisfies readonly (keyof NotificationPreferences)[];
