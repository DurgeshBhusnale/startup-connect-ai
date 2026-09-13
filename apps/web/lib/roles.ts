import type { AppRole } from "@/lib/api-types";

const appRoles: readonly string[] = ["founder", "investor", "mentor"];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && appRoles.includes(value);
}

export const roleLabels: Record<AppRole, string> = {
  founder: "Founder",
  investor: "Investor",
  mentor: "Mentor",
};

type HomeCopy = {
  subtitle: string;
  emptyTitle: string;
  emptyBody: string;
  cta: string;
};

export const homeCopy: Record<AppRole, HomeCopy> = {
  founder: {
    subtitle: "Your fundraising workspace — matches, intros, and messages will live here.",
    emptyTitle: "No matches yet",
    emptyBody: "Matches will appear here as investors and mentors sign up.",
    cta: "Set up your profile",
  },
  investor: {
    subtitle: "Your deal-flow workspace — pre-filtered founders will land here.",
    emptyTitle: "You’re set",
    emptyBody: "New founder matches will appear here as they sign up.",
    cta: "Set up your thesis",
  },
  mentor: {
    subtitle: "Your mentoring workspace — founders who need your expertise will land here.",
    emptyTitle: "You’re on the list",
    emptyBody:
      "Matched founders will appear here as they seek mentorship in your expertise areas.",
    cta: "Set up your expertise",
  },
};
