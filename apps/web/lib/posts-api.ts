import { unstable_rethrow } from "next/navigation";

import { requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";

import type { PostsPage } from "@/lib/api-types";

function withCursor(path: string, cursor?: string): string {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
}

export async function getMyPosts(cursor?: string): Promise<PostsPage | null> {
  const token = await requireToken();
  try {
    return await apiRequest<PostsPage>(withCursor("/v1/profiles/me/posts", cursor), { token });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading your posts failed", error);
    return null;
  }
}

export async function getProfilePosts(profileId: string, cursor?: string): Promise<PostsPage | null> {
  const token = await requireToken();
  try {
    return await apiRequest<PostsPage>(
      withCursor(`/v1/profiles/${encodeURIComponent(profileId)}/posts`, cursor),
      { token },
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading profile posts failed", error);
    return null;
  }
}
