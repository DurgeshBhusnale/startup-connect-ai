"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";
import { formStrings, formText } from "@/lib/form-data";
import { validateThesis } from "@/lib/investor-profile";

import type { ThesisResponse } from "@/lib/api-types";
import type { SaveThesisState, ThesisFormValues } from "@/lib/investor-profile";

export async function saveThesis(
  _previous: SaveThesisState,
  formData: FormData,
): Promise<SaveThesisState> {
  const values: ThesisFormValues = {
    sectors: formStrings(formData, "sectors"),
    stages: formStrings(formData, "stages"),
    cheque_min_lakhs: formText(formData, "cheque_min_lakhs"),
    cheque_max_lakhs: formText(formData, "cheque_max_lakhs"),
    geographies: formStrings(formData, "geographies"),
    no_gos: formStrings(formData, "no_gos"),
  };
  const result = validateThesis(values);
  if (result.errors) {
    return { fieldErrors: result.errors, formError: null };
  }

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }

  try {
    await apiRequest<ThesisResponse>("/v1/investor/thesis", {
      method: "POST",
      token,
      body: result.data,
    });
  } catch (error) {
    console.error("Saving investor thesis failed", error);
    return {
      fieldErrors: {},
      formError:
        error instanceof ApiError && error.status === 422
          ? "Some details didn’t pass our checks. Review your thesis and try again."
          : "We couldn’t save your thesis. Please try again in a moment.",
    };
  }

  redirect(formText(formData, "mode") === "edit" ? "/home" : "/onboarding/investor/prior-investments");
}
