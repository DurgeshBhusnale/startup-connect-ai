"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";
import { validateFounderProfile } from "@/lib/founder-profile";

import type { SaveProfileRequest, SaveProfileResponse } from "@/lib/api-types";
import type { FounderFormValues, SaveProfileState } from "@/lib/founder-profile";

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveFounderProfile(
  _previous: SaveProfileState,
  formData: FormData,
): Promise<SaveProfileState> {
  const values: FounderFormValues = {
    startup_name: textField(formData, "startup_name"),
    sector: textField(formData, "sector"),
    stage: textField(formData, "stage"),
    city: textField(formData, "city"),
    business_model: textField(formData, "business_model"),
    ask_amount: textField(formData, "ask_amount"),
    team_size: textField(formData, "team_size"),
    description: textField(formData, "description"),
    competitors: formData
      .getAll("competitors")
      .filter((value): value is string => typeof value === "string"),
    linkedin_url: textField(formData, "linkedin_url"),
  };

  const result = validateFounderProfile(values);
  if (result.errors) {
    return { fieldErrors: result.errors, formError: null };
  }

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }

  const payload: SaveProfileRequest = { kind: "founder", l1_data: result.data };
  try {
    await apiRequest<SaveProfileResponse>("/v1/profiles", { method: "POST", token, body: payload });
  } catch (error) {
    console.error("Saving founder profile failed", error);
    return {
      fieldErrors: {},
      formError:
        error instanceof ApiError && error.status === 422
          ? "Some details didn’t pass our checks. Review the fields and try again."
          : "We couldn’t save your profile. Please try again in a moment.",
    };
  }

  redirect("/home");
}
