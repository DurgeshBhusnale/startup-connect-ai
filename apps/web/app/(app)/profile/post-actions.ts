"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, isUuid, requireToken } from "@/lib/action-helpers";
import { apiRequest } from "@/lib/api";
import {
  MAX_POST_IMAGES,
  MILESTONE_DESCRIPTION_MAX,
  MILESTONE_VALUE_MAX,
  POST_BODY_MAX,
  milestoneTypes,
} from "@/lib/posts";

import type { ActionResult } from "@/lib/action-helpers";
import type { MilestoneData, PostCreatedResponse, PostKind } from "@/lib/api-types";

export type PostInput = {
  kind: PostKind;
  body: string;
  mediaIds: string[];
  milestone: MilestoneData | null;
};

const POST_KINDS: readonly PostKind[] = ["text", "image", "milestone"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Server action arguments come from the browser: shape-check before forwarding to the API,
// which validates the content rules.
function toRequestBody(input: PostInput): Record<string, unknown> | null {
  if (!input || !POST_KINDS.includes(input.kind) || typeof input.body !== "string") {
    return null;
  }
  const mediaIds = Array.isArray(input.mediaIds) ? input.mediaIds : [];
  if (mediaIds.length > MAX_POST_IMAGES || !mediaIds.every(isUuid)) {
    return null;
  }
  let milestone: MilestoneData | null = null;
  if (input.milestone) {
    const { type, value, achieved_on: achievedOn, description } = input.milestone;
    if (
      !milestoneTypes.some((option) => option.value === type) ||
      typeof value !== "string" ||
      typeof achievedOn !== "string" ||
      !DATE_PATTERN.test(achievedOn)
    ) {
      return null;
    }
    milestone = {
      type,
      value: value.slice(0, MILESTONE_VALUE_MAX),
      achieved_on: achievedOn,
      description:
        typeof description === "string" && description.trim()
          ? description.slice(0, MILESTONE_DESCRIPTION_MAX)
          : null,
    };
  }
  return {
    kind: input.kind,
    body: input.body.slice(0, POST_BODY_MAX),
    media_ids: mediaIds,
    milestone_data: milestone,
  };
}

const INVALID_POST = "Something about this post isn’t valid. Check it and try again.";

export async function createPost(input: PostInput): Promise<ActionResult<PostCreatedResponse>> {
  const body = toRequestBody(input);
  if (!body) {
    return { ok: false, error: INVALID_POST };
  }
  const token = await requireToken();
  try {
    const created = await apiRequest<PostCreatedResponse>("/v1/profiles/me/posts", {
      method: "POST",
      token,
      body,
    });
    revalidatePath("/profile");
    return { ok: true, data: created };
  } catch (error) {
    return actionFailure(error, "Couldn’t publish your post. Try again.");
  }
}

export async function updatePost(
  postId: string,
  input: PostInput,
): Promise<ActionResult<PostCreatedResponse>> {
  const body = toRequestBody(input);
  if (!isUuid(postId) || !body) {
    return { ok: false, error: INVALID_POST };
  }
  const token = await requireToken();
  try {
    const updated = await apiRequest<PostCreatedResponse>(`/v1/profiles/me/posts/${postId}`, {
      method: "PATCH",
      token,
      body: { body: body.body, media_ids: body.media_ids, milestone_data: body.milestone_data },
    });
    revalidatePath("/profile");
    return { ok: true, data: updated };
  } catch (error) {
    return actionFailure(error, "Couldn’t save your changes. Try again.");
  }
}

export async function deletePost(postId: string): Promise<ActionResult<null>> {
  if (!isUuid(postId)) {
    return { ok: false, error: "This post no longer exists." };
  }
  const token = await requireToken();
  try {
    await apiRequest(`/v1/profiles/me/posts/${postId}`, { method: "DELETE", token });
    revalidatePath("/profile");
    return { ok: true, data: null };
  } catch (error) {
    return actionFailure(error, "Couldn’t delete this post. Try again.");
  }
}
