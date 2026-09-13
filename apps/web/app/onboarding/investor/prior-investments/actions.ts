"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";
import { formText } from "@/lib/form-data";
import { parseRowsJson, validatePriorInvestments } from "@/lib/investor-profile";

import type { PriorInvestmentsResponse } from "@/lib/api-types";
import type { SavePriorInvestmentsState } from "@/lib/investor-profile";

async function requireToken(): Promise<string> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }
  return token;
}

export async function savePriorInvestments(
  _previous: SavePriorInvestmentsState,
  formData: FormData,
): Promise<SavePriorInvestmentsState> {
  const result = validatePriorInvestments(parseRowsJson(formText(formData, "entries_json")), {
    hideChequeAmounts: formData.get("hide_cheque_amounts") === "on",
    crunchbaseUrl: formText(formData, "crunchbase_url"),
    currentYear: new Date().getFullYear(),
  });
  if (!result.data) {
    return {
      rowErrors: result.rowErrors,
      formError: result.formError,
      crunchbaseError: result.crunchbaseError,
    };
  }

  const token = await requireToken();
  try {
    await apiRequest<PriorInvestmentsResponse>("/v1/investor/prior-investments", {
      method: "POST",
      token,
      body: result.data,
    });
  } catch (error) {
    console.error("Saving prior investments failed", error);
    return {
      rowErrors: {},
      crunchbaseError: null,
      formError:
        error instanceof ApiError && error.status === 422
          ? "Some investments didn’t pass our checks. Review the rows and try again."
          : "We couldn’t save your investments. Please try again in a moment.",
    };
  }

  redirect("/home");
}

export async function skipPriorInvestments(): Promise<void> {
  const token = await requireToken();
  await apiRequest<PriorInvestmentsResponse>("/v1/investor/prior-investments/skip", {
    method: "POST",
    token,
  });
  redirect("/home");
}
