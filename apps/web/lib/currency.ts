const LAKH = 100_000;
const CRORE = 10_000_000;

// Accepts "40L", "1.5 Cr", "₹40,00,000", "4000000".
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "").toLowerCase();
  const match = /^(\d+(?:\.\d+)?)(k|l|lac|lakh|lakhs|cr|crore|crores)?$/.exec(cleaned);
  if (!match) return null;
  const unit = match[2];
  const multiplier = !unit ? 1 : unit === "k" ? 1_000 : unit.startsWith("c") ? CRORE : LAKH;
  const rupees = Math.round(Number(match[1]) * multiplier);
  return rupees > 0 && rupees <= 100_000_000_000 ? rupees : null;
}

export function formatRupees(rupees: number): string {
  const trim = (value: number) => Number(value.toFixed(2)).toString();
  if (rupees >= CRORE) return `${trim(rupees / CRORE)}Cr`;
  if (rupees >= LAKH) return `${trim(rupees / LAKH)}L`;
  return rupees.toLocaleString("en-IN");
}

export function lakhsToRupees(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lakhs = Number(trimmed);
  if (!Number.isFinite(lakhs) || lakhs <= 0 || lakhs > 20_000) return null;
  return Math.round(lakhs * LAKH);
}

export function rupeesToLakhs(rupees: number): string {
  return Number((rupees / LAKH).toFixed(2)).toString();
}
