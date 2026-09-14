import { auth } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";

import { apiRequest } from "@/lib/api";

import type { BadgesResponse } from "@/lib/api-types";

export const emptyBadges: BadgesResponse = {
  verified_items: [],
  endorsed_items: [],
  self_reported_stale: [],
  last_updated: {},
};

// Badges decorate a profile; if they fail to load, the profile still renders without them.
export async function getProfileBadges(profileId: string): Promise<BadgesResponse> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    return emptyBadges;
  }
  try {
    return await apiRequest<BadgesResponse>(
      `/v1/profiles/${encodeURIComponent(profileId)}/badges`,
      { token },
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading profile badges failed", error);
    return emptyBadges;
  }
}
