import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

import { apiRequest } from "@/lib/api";

import type { Me } from "@/lib/api-types";

// Deduped per request so the (app) layout and its page share one API call.
export const getMe = cache(async (): Promise<Me> => {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    throw new Error("No Clerk session token available");
  }
  return apiRequest<Me>("/v1/me", { token });
});
