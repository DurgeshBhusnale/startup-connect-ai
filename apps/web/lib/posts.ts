import type { MilestoneType, PostKind } from "@/lib/api-types";

// Mirrors apps/api/app/models/posts.py and apps/api/app/services/media.py.
export const POST_BODY_MAX = 500;
export const MILESTONE_VALUE_MIN = 3;
export const MILESTONE_VALUE_MAX = 120;
export const MILESTONE_DESCRIPTION_MAX = 250;
export const MAX_POST_IMAGES = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

export const milestoneTypes: readonly { value: MilestoneType; label: string }[] = [
  { value: "users", label: "Users" },
  { value: "revenue", label: "Revenue" },
  { value: "hiring", label: "Hiring" },
  { value: "funding", label: "Funding" },
  { value: "launch", label: "Launch" },
  { value: "other", label: "Other" },
];

export const postKindLabels: Record<PostKind, string> = {
  text: "Update",
  image: "Images",
  milestone: "Milestone",
};

export const textStarters: readonly string[] = [
  "We just crossed ",
  "We launched ",
  "This month’s numbers: ",
];

export function milestoneTypeLabel(value: MilestoneType): string {
  return milestoneTypes.find((option) => option.value === value)?.label ?? value;
}

export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
