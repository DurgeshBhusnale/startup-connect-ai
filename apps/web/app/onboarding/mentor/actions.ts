"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { formStrings, formText } from "@/lib/form-data";
import { validateMentorProfile } from "@/lib/mentor-profile";

import type { MentorExpertiseResponse, VerificationResponse } from "@/lib/api-types";
import type { MentorFormValues, SaveMentorState } from "@/lib/mentor-profile";

export async function saveMentorProfile(
  _previous: SaveMentorState,
  formData: FormData,
): Promise<SaveMentorState> {
  const values: MentorFormValues = {
    areas: formStrings(formData, "areas"),
    stages: formStrings(formData, "stages"),
    availability: formText(formData, "availability"),
    session_fee: formText(formData, "session_fee"),
    verification_method: formText(formData, "verification_method"),
    linkedin_url: formText(formData, "linkedin_url"),
    reference_email_1: formText(formData, "reference_email_1"),
    reference_email_2: formText(formData, "reference_email_2"),
  };
  const includeVerification =
    formText(formData, "intent") !== "skip" && formText(formData, "include_verification") === "true";

  const result = validateMentorProfile(values, includeVerification);
  if (result.errors) {
    return { fieldErrors: result.errors, formError: null };
  }

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }

  let expertiseSaved = false;
  try {
    await apiRequest<MentorExpertiseResponse>("/v1/mentor/expertise", {
      method: "POST",
      token,
      body: result.data.expertise,
    });
    expertiseSaved = true;
    if (result.data.verification) {
      await apiRequest<VerificationResponse>("/v1/mentor/verification-request", {
        method: "POST",
        token,
        body: result.data.verification,
      });
    }
  } catch (error) {
    console.error("Saving mentor profile failed", error);
    return {
      fieldErrors: {},
      formError: expertiseSaved
        ? "Your profile was saved, but we couldn’t send your verification request. Please try again."
        : "We couldn’t save your mentor profile. Please try again in a moment.",
    };
  }

  redirect(formText(formData, "mode") === "edit" ? "/profile" : "/home");
}
