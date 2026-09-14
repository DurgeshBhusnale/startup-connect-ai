import { unstable_rethrow } from "next/navigation";

import { isUuid, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";

import type { GivenEndorsement, ProfileEndorsements } from "@/lib/api-types";

// Best effort: a failed lookup hides endorsement controls instead of breaking the page.
export async function getProfileEndorsements(
  profileId: string,
): Promise<ProfileEndorsements | null> {
  if (!isUuid(profileId)) return null;
  const token = await requireToken();
  try {
    return await apiRequest<ProfileEndorsements>(`/v1/profiles/${profileId}/endorsements`, {
      token,
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading endorsements failed", error);
    return null;
  }
}

export async function getGivenEndorsements(): Promise<GivenEndorsement[] | null> {
  const token = await requireToken();
  try {
    return await apiRequest<GivenEndorsement[]>("/v1/me/endorsements", { token });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading given endorsements failed", error);
    return null;
  }
}
