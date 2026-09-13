"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiRequest } from "@/lib/api";

export async function dismissPriorInvestmentsBanner(): Promise<void> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }
  await apiRequest<void>("/v1/investor/onboarding-banner/dismiss", { method: "POST", token });
  revalidatePath("/home");
}
