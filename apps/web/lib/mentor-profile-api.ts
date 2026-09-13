import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/api";

import type { MentorProfileState } from "@/lib/api-types";

// Returns null when the signed-in user has no mentor profile (they never picked the mentor role).
export async function getMentorProfileState(): Promise<MentorProfileState | null> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }
  try {
    return await apiRequest<MentorProfileState>("/v1/mentor/profile", { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
