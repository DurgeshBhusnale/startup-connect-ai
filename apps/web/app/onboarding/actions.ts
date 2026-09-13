"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";
import { isAppRole } from "@/lib/roles";

import type { Me, OnboardingRequest } from "@/lib/api-types";
import type { OnboardingState } from "@/lib/onboarding";

export async function completeOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const role = formData.get("role");
  if (!isAppRole(role)) {
    return { error: "Choose the role that fits you best." };
  }

  const payload: OnboardingRequest = {
    role,
    consents: {
      terms_privacy: formData.get("terms_privacy") === "on",
      match_processing: formData.get("match_processing") === "on",
      email_notifications: formData.get("email_notifications") === "on",
      whatsapp_notifications: formData.get("whatsapp_notifications") === "on",
    },
  };
  if (!payload.consents.terms_privacy || !payload.consents.match_processing) {
    return {
      error: "Please accept the Terms and allow match processing — we can’t match you without them.",
    };
  }

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }

  try {
    await apiRequest<Me>("/v1/me/onboarding", { method: "POST", token, body: payload });
  } catch (error) {
    console.error("Onboarding submission failed", error);
    return {
      error:
        error instanceof ApiError && error.status === 422
          ? (error.problem?.detail ?? "Some details didn’t look right. Check your choices and try again.")
          : "We couldn’t save your choices. Please try again in a moment.",
    };
  }

  const nextStep: Record<typeof role, string> = {
    founder: "/onboarding/founder",
    investor: "/onboarding/investor",
    mentor: "/onboarding/mentor",
  };
  redirect(nextStep[role]);
}
