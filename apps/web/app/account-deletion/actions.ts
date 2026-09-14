"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";

export async function restoreAccount(): Promise<void> {
  const token = await requireToken();
  let restored = true;
  try {
    await apiRequest("/v1/me/account/restore", { method: "POST", token });
  } catch (error) {
    console.error("Restoring the account failed", error);
    restored = false;
  }
  if (!restored) {
    redirect("/account-deletion?restore=failed");
  }
  revalidatePath("/", "layout");
  redirect("/home");
}
