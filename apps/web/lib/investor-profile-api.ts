import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";

import type { InvestorProfileState } from "@/lib/api-types";

// Returns null when the signed-in user has no investor profile (they never picked the investor role).
export async function getInvestorProfileState(): Promise<InvestorProfileState | null> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }
  try {
    return await apiRequest<InvestorProfileState>("/v1/investor/profile", { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
