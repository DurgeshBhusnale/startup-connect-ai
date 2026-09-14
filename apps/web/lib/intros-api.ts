import { unstable_rethrow } from "next/navigation";

import { requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";

import type { IntroQueueItem } from "@/lib/api-types";

export type IntroQueueResult = { status: "ok"; items: IntroQueueItem[] } | { status: "unavailable" };

export async function getIntroQueue(): Promise<IntroQueueResult> {
  const token = await requireToken();
  try {
    const items = await apiRequest<IntroQueueItem[]>("/v1/intros", { token });
    return { status: "ok", items };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading the intro queue failed", error);
    return { status: "unavailable" };
  }
}
