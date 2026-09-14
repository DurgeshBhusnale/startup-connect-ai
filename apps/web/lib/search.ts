import type { AppRole } from "@/lib/api-types";

// Mirrors SearchRequest in apps/api/app/models/search.py.
export const SEARCH_QUERY_MIN = 2;
export const SEARCH_QUERY_MAX = 200;

const EXAMPLES: Record<AppRole, readonly string[]> = {
  founder: [
    "Investors who back fintech in Pune",
    "Mentors for B2B GTM at seed stage",
    "Investors with ₹25L–₹75L cheque range",
    "Angels investing in AI/ML at pre-seed",
  ],
  investor: [
    "Founders raising Series A in AI",
    "Seed-stage fintech founders in Pune",
    "D2C founders raising ₹50L",
    "Healthtech founders in Bengaluru",
  ],
  mentor: [
    "Pre-seed SaaS founders",
    "Founders raising Series A in AI",
    "Fintech founders in Pune",
    "Edtech founders in Bengaluru",
  ],
};

export function searchExamples(role: AppRole): readonly string[] {
  return EXAMPLES[role];
}
