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
