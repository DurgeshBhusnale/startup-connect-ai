import type { FounderStage, Geography, InvestmentStage } from "@/lib/api-types";

// Shared by founders and investors so matching compares like with like.
// Keep in sync with apps/api/app/models/taxonomy.py.
export const sectors = [
  "Fintech",
  "SaaS",
  "AI/ML",
  "Deep Tech",
  "Enterprise",
  "Consumer",
  "Healthtech",
  "Edtech",
  "D2C",
  "Mobility",
  "Climate & Energy",
  "Web3",
  "Agritech",
  "Insurtech",
  "B2B Commerce",
  "Cybersecurity",
  "BioTech",
  "Hardware / IoT",
  "Gaming",
  "Logistics & Supply Chain",
  "Proptech",
  "SpaceTech",
  "Creator Economy",
  "DevTools",
  "HR Tech",
  "Media & Content",
  "Legal Tech",
  "Other",
] as const;

export const founderSectors: readonly string[] = sectors;
export const investorSectors: readonly string[] = sectors.filter((sector) => sector !== "Other");

export const founderStages: ReadonlyArray<{ value: FounderStage; label: string }> = [
  { value: "pre-seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series-a", label: "Series A" },
];

export const investmentStages: ReadonlyArray<{
  value: InvestmentStage;
  label: string;
  detail: string;
}> = [
  { value: "pre-seed", label: "Pre-seed", detail: "Concept / MVP" },
  { value: "seed", label: "Seed", detail: "Early PMF" },
  { value: "series-a", label: "Series A", detail: "Scaling revenue" },
  { value: "series-b-plus", label: "Series B+", detail: "Growth" },
];

export const geographies: ReadonlyArray<{
  value: Geography;
  label: string;
  kind: "city" | "region";
}> = [
  { value: "bengaluru", label: "India — Bengaluru", kind: "city" },
  { value: "pune", label: "India — Pune", kind: "city" },
  { value: "mumbai", label: "India — Mumbai", kind: "city" },
  { value: "delhi-ncr", label: "India — Delhi NCR", kind: "city" },
  { value: "hyderabad", label: "India — Hyderabad", kind: "city" },
  { value: "chennai", label: "India — Chennai", kind: "city" },
  { value: "india", label: "India — anywhere", kind: "region" },
  { value: "sea", label: "SEA", kind: "region" },
  { value: "us", label: "US", kind: "region" },
  { value: "global", label: "Global", kind: "region" },
];
