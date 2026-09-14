"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiRequest } from "@/lib/api";

import type { RecomputeResponse } from "@/lib/api-types";

export async function refreshMatches(): Promise<void> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }
  try {
    await apiRequest<RecomputeResponse>("/v1/matches/recompute", { method: "POST", token });
  } catch (error) {
    // The page re-fetches below and shows the unavailable state if matching is still down.
    console.error("Refreshing matches failed", error);
  }
  revalidatePath("/matches");
  revalidatePath("/home");
}
