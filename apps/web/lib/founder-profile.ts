import type { FounderL1Data, FounderProfileDraft, FounderStage } from "@/lib/api-types";

export const LOW_CONFIDENCE_THRESHOLD = 0.7;
export const MAX_DECK_BYTES = 20 * 1024 * 1024;
export const MAX_COMPETITORS = 3;
export const DESCRIPTION_MAX = 300;

// Keep these option lists in sync with apps/api/app/models/founder.py.
export const founderSectors = [
  "Fintech",
  "SaaS",
  "AI/ML",
  "Consumer",
  "D2C",
  "Healthtech",
  "Edtech",
  "Agritech",
  "Climate & Energy",
  "Logistics",
  "Mobility",
  "Deep Tech",
  "Enterprise",
  "HR Tech",
  "Proptech",
  "Gaming",
  "Media & Content",
  "Cybersecurity",
  "Legal Tech",
  "Other",
] as const;

export const businessModels = [
  "B2B SaaS subscription",
  "B2C subscription",
  "Marketplace",
  "Transaction fees",
  "D2C e-commerce",
  "Hardware",
  "Advertising",
  "Services",
  "Other",
] as const;

export const founderStages: ReadonlyArray<{ value: FounderStage; label: string }> = [
  { value: "pre-seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series-a", label: "Series A" },
];

export type FounderField =
  | "startup_name"
  | "sector"
  | "stage"
  | "city"
  | "business_model"
  | "ask_amount"
  | "team_size"
  | "description"
  | "competitors";

export type FounderFormValues = {
  startup_name: string;
  sector: string;
  stage: string;
  city: string;
  business_model: string;
  ask_amount: string;
  team_size: string;
  description: string;
  competitors: string[];
  linkedin_url: string;
};

export type FounderFieldErrors = Partial<Record<FounderField, string>>;

export type SaveProfileState = {
  fieldErrors: FounderFieldErrors;
  formError: string | null;
};

export const initialSaveProfileState: SaveProfileState = { fieldErrors: {}, formError: null };

const LINKEDIN_PROFILE =
  /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_%.-]{3,100}\/?(?:[?#].*)?$/i;

export function isLinkedInProfileUrl(value: string): boolean {
  return LINKEDIN_PROFILE.test(value.trim());
}

const LAKH = 100_000;
const CRORE = 10_000_000;

export function parseAskAmount(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "").toLowerCase();
  const match = /^(\d+(?:\.\d+)?)(k|l|lac|lakh|lakhs|cr|crore|crores)?$/.exec(cleaned);
  if (!match) return null;
  const unit = match[2];
  const multiplier = !unit ? 1 : unit === "k" ? 1_000 : unit.startsWith("c") ? CRORE : LAKH;
  const rupees = Math.round(Number(match[1]) * multiplier);
  return rupees > 0 && rupees <= 100_000_000_000 ? rupees : null;
}

export function formatAskAmount(rupees: number): string {
  const trim = (value: number) => Number(value.toFixed(2)).toString();
  if (rupees >= CRORE) return `${trim(rupees / CRORE)}Cr`;
  if (rupees >= LAKH) return `${trim(rupees / LAKH)}L`;
  return rupees.toLocaleString("en-IN");
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function draftToFormValues(
  draft: FounderProfileDraft | null,
  linkedinUrl: string | null,
): FounderFormValues {
  return {
    startup_name: draft?.startup_name ?? "",
    sector: draft?.sector ?? "",
    stage: draft?.stage ?? "",
    city: draft?.city ?? "",
    business_model: draft?.business_model ?? "",
    ask_amount: draft?.ask_amount_inr ? formatAskAmount(draft.ask_amount_inr) : "",
    team_size: draft?.team_size ? String(draft.team_size) : "",
    description: draft?.description ?? "",
    competitors: draft?.competitors ?? [],
    linkedin_url: linkedinUrl ?? "",
  };
}

export function countFilledFields(draft: FounderProfileDraft): number {
  return Object.values(draft).filter((value) =>
    Array.isArray(value) ? value.length > 0 : value !== null && value !== "",
  ).length;
}

type ValidationResult =
  | { data: FounderL1Data; errors: null }
  | { data: null; errors: FounderFieldErrors };

export function validateFounderProfile(values: FounderFormValues): ValidationResult {
  const errors: FounderFieldErrors = {};

  const startupName = values.startup_name.trim();
  if (!startupName || startupName.length > 120) {
    errors.startup_name = "Enter your startup’s name (up to 120 characters).";
  }
  const sector = founderSectors.find((option) => option === values.sector);
  if (!sector) errors.sector = "Choose a sector.";

  const stage = founderStages.find((option) => option.value === values.stage)?.value;
  if (!stage) errors.stage = "Choose your stage.";

  const city = values.city.trim();
  if (!city || city.length > 80) errors.city = "Enter the city you’re based in.";

  const businessModel = businessModels.find((option) => option === values.business_model);
  if (!businessModel) errors.business_model = "Choose a business model.";

  const askAmount = parseAskAmount(values.ask_amount);
  if (askAmount === null) errors.ask_amount = "Enter your ask like 40L, 1.5Cr, or 4000000.";

  const teamSize = Number(values.team_size);
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 10_000) {
    errors.team_size = "Enter a team size between 1 and 10,000.";
  }

  const description = values.description.trim();
  if (description.length < 10) {
    errors.description = "Add a short description (at least 10 characters).";
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Keep it under ${DESCRIPTION_MAX} characters.`;
  }

  const competitors = values.competitors.map((name) => name.trim()).filter(Boolean);
  if (competitors.length > MAX_COMPETITORS || competitors.some((name) => name.length > 60)) {
    errors.competitors = "Add up to 3 competitors, each under 60 characters.";
  }

  if (!sector || !stage || !businessModel || askAmount === null || Object.keys(errors).length > 0) {
    return { data: null, errors };
  }

  const linkedinUrl = values.linkedin_url.trim();
  return {
    data: {
      startup_name: startupName,
      sector,
      stage,
      city,
      business_model: businessModel,
      ask_amount_inr: askAmount,
      team_size: teamSize,
      description,
      competitors,
      linkedin_url: linkedinUrl && isLinkedInProfileUrl(linkedinUrl) ? linkedinUrl : null,
    },
    errors: null,
  };
}
