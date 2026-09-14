import type { MilestoneType } from "@/lib/api-types";

// S9 edge case: an implausible milestone number gets a soft warning, but still posts.
const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  l: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  m: 1e6,
  mn: 1e6,
  million: 1e6,
  cr: 1e7,
  crore: 1e7,
  crores: 1e7,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
  t: 1e12,
  trillion: 1e12,
};

const LIMITS: Record<MilestoneType, number> = {
  users: 2e9, // more people than use the largest apps
  revenue: 1e12, // ₹1 lakh crore
  funding: 1e12,
  hiring: 1e5,
  launch: 1e10,
  other: 1e12,
};

function largestNumber(text: string): number {
  let largest = 0;
  // Exponent notation like "10^12" or "1e12".
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:\^|e|x\s*10\^)\s*(\d{1,3})\b/gi)) {
    const base = Number(match[1]);
    const exponent = Number(match[2]);
    const value = match[0].includes("^") && !/x/i.test(match[0]) ? base ** exponent : base * 10 ** exponent;
    if (Number.isFinite(value) && value > largest) largest = value;
  }
  const pattern = /(\d[\d,]*(?:\.\d+)?)\s*(thousand|lakhs?|lac|million|mn|crores?|cr|billion|bn|trillion|[klmbt])?\b/gi;
  for (const match of text.matchAll(pattern)) {
    const base = Number((match[1] ?? "").replace(/,/g, ""));
    const unit = match[2]?.toLowerCase();
    const value = base * (unit ? (MULTIPLIERS[unit] ?? 1) : 1);
    if (Number.isFinite(value) && value > largest) largest = value;
  }
  return largest;
}

export function looksImplausible(type: MilestoneType, value: string): boolean {
  return largestNumber(value) > LIMITS[type];
}
