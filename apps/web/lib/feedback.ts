import type { RejectReason } from "@/lib/api-types";

// Mirrors apps/api/app/models/feedback.py.
export const INTRO_MESSAGE_MIN = 20;
export const INTRO_MESSAGE_MAX = 500;

export const rejectReasons: readonly { value: RejectReason; label: string }[] = [
  { value: "wrong_sector", label: "Wrong sector" },
  { value: "wrong_stage", label: "Wrong stage" },
  { value: "wrong_geo", label: "Wrong geo" },
  { value: "not_right_person", label: "Not the right person" },
  { value: "other", label: "Other" },
];

export function isRejectReason(value: unknown): value is RejectReason {
  return rejectReasons.some((option) => option.value === value);
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function initialsOf(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "SC";
}
