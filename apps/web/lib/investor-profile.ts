import { formatRupees, lakhsToRupees, parseRupees, rupeesToLakhs } from "@/lib/currency";
import { geographies, investmentStages, sectors } from "@/lib/taxonomy";

import type {
  Geography,
  InvestmentStage,
  PriorInvestmentEntry,
  PriorInvestmentItem,
  PriorInvestmentsRequest,
  ThesisData,
  ThesisRequest,
} from "@/lib/api-types";

export const MAX_NO_GOS = 20;
export const MIN_PRIOR_INVESTMENTS = 3;
export const MAX_PRIOR_INVESTMENTS = 10;

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function isSector(value: string): boolean {
  return (sectors as readonly string[]).includes(value);
}

function isInvestmentStage(value: string): value is InvestmentStage {
  return investmentStages.some((stage) => stage.value === value);
}

function isGeography(value: string): value is Geography {
  return geographies.some((geography) => geography.value === value);
}

// ---------------------------------------------------------------- thesis

export type ThesisField = "sectors" | "stages" | "cheque_min" | "cheque_max" | "geographies" | "no_gos";

export type ThesisFormValues = {
  sectors: string[];
  stages: string[];
  cheque_min_lakhs: string;
  cheque_max_lakhs: string;
  geographies: string[];
  no_gos: string[];
};

export type ThesisFieldErrors = Partial<Record<ThesisField, string>>;

export type SaveThesisState = {
  fieldErrors: ThesisFieldErrors;
  formError: string | null;
};

export const initialSaveThesisState: SaveThesisState = { fieldErrors: {}, formError: null };

export function thesisToFormValues(thesis: ThesisData | null): ThesisFormValues {
  return {
    sectors: thesis?.sectors ?? [],
    stages: thesis?.stages ?? [],
    cheque_min_lakhs: thesis?.cheque_min ? rupeesToLakhs(thesis.cheque_min) : "",
    cheque_max_lakhs: thesis?.cheque_max ? rupeesToLakhs(thesis.cheque_max) : "",
    geographies: thesis?.geographies ?? [],
    no_gos: thesis?.no_gos ?? [],
  };
}

type ThesisValidation =
  | { data: ThesisRequest; errors: null }
  | { data: null; errors: ThesisFieldErrors };

export function validateThesis(values: ThesisFormValues): ThesisValidation {
  const errors: ThesisFieldErrors = {};

  const chosenSectors = unique(values.sectors.filter(isSector));
  if (chosenSectors.length === 0) errors.sectors = "Pick at least one sector.";

  const stages = unique(values.stages).filter(isInvestmentStage);
  if (stages.length === 0) errors.stages = "Pick at least one stage.";

  const chequeMin = lakhsToRupees(values.cheque_min_lakhs);
  if (chequeMin === null) errors.cheque_min = "Enter your minimum cheque in lakhs, e.g. 5.";

  const chequeMax = lakhsToRupees(values.cheque_max_lakhs);
  if (chequeMax === null) {
    errors.cheque_max = "Enter your maximum cheque in lakhs, e.g. 50.";
  } else if (chequeMin !== null && chequeMin > chequeMax) {
    errors.cheque_max = "Your maximum cheque must be at least your minimum.";
  }

  const chosenGeographies = unique(values.geographies).filter(isGeography);
  if (chosenGeographies.length === 0) errors.geographies = "Pick at least one geography.";

  const noGos = unique(values.no_gos.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length >= 2));
  if (noGos.length > MAX_NO_GOS || noGos.some((tag) => tag.length > 60)) {
    errors.no_gos = `Add up to ${MAX_NO_GOS} no-gos, each under 60 characters.`;
  }

  if (chequeMin === null || chequeMax === null || Object.keys(errors).length > 0) {
    return { data: null, errors };
  }
  return {
    data: {
      sectors: chosenSectors,
      stages,
      cheque_min: chequeMin,
      cheque_max: chequeMax,
      geographies: chosenGeographies,
      no_gos: noGos,
    },
    errors: null,
  };
}

// ------------------------------------------------------ prior investments

export type InvestmentRowField = "company" | "sector" | "stage" | "cheque" | "year";

export type InvestmentRow = {
  key: string;
  company: string;
  sector: string;
  stage: string;
  cheque: string;
  year: string;
};

export type InvestmentRowErrors = Record<string, Partial<Record<InvestmentRowField, string>>>;

export type SavePriorInvestmentsState = {
  rowErrors: InvestmentRowErrors;
  formError: string | null;
  crunchbaseError: string | null;
};

export const initialSavePriorInvestmentsState: SavePriorInvestmentsState = {
  rowErrors: {},
  formError: null,
  crunchbaseError: null,
};

export function emptyRow(key: string): InvestmentRow {
  return { key, company: "", sector: "", stage: "", cheque: "", year: "" };
}

export function itemToRow(item: PriorInvestmentItem, key: string): InvestmentRow {
  return {
    key,
    company: item.company,
    sector: item.sector,
    stage: item.stage,
    cheque: item.cheque ? formatRupees(item.cheque) : "",
    year: String(item.year),
  };
}

export function isBlankRow(row: InvestmentRow): boolean {
  return !row.company.trim() && !row.sector && !row.stage && !row.cheque.trim() && !row.year.trim();
}

export function parseRowsJson(json: string): InvestmentRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, 50).flatMap((item: unknown, index) => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : "");
    return [
      {
        key: text("key") || `row-${index}`,
        company: text("company"),
        sector: text("sector"),
        stage: text("stage"),
        cheque: text("cheque"),
        year: text("year"),
      },
    ];
  });
}

const CRUNCHBASE_PROFILE =
  /^(?:https?:\/\/)?(?:www\.)?crunchbase\.com\/(?:person|organization)\/[a-z0-9-]{2,100}\/?(?:[?#].*)?$/i;

export function isCrunchbaseUrl(value: string): boolean {
  return CRUNCHBASE_PROFILE.test(value.trim());
}

type PriorInvestmentsValidation = SavePriorInvestmentsState & {
  data: PriorInvestmentsRequest | null;
};

export function validatePriorInvestments(
  rows: readonly InvestmentRow[],
  options: { hideChequeAmounts: boolean; crunchbaseUrl: string; currentYear: number },
): PriorInvestmentsValidation {
  const entries: PriorInvestmentEntry[] = [];
  const rowErrors: InvestmentRowErrors = {};

  for (const row of rows) {
    if (isBlankRow(row)) continue;
    const errors: Partial<Record<InvestmentRowField, string>> = {};

    const company = row.company.trim();
    if (!company || company.length > 120) errors.company = "Add the company name.";
    if (!isSector(row.sector)) errors.sector = "Pick a sector.";
    const stage = investmentStages.find((option) => option.value === row.stage)?.value;
    if (!stage) errors.stage = "Pick a stage.";

    let cheque: number | null = null;
    if (row.cheque.trim()) {
      cheque = parseRupees(row.cheque);
      if (cheque === null) errors.cheque = "Use a format like 15L or 1.2Cr.";
    }

    const year = Number(row.year);
    if (!Number.isInteger(year) || year < 1990 || year > options.currentYear) {
      errors.year = `Enter a year between 1990 and ${options.currentYear}.`;
    }

    if (!stage || Object.keys(errors).length > 0) {
      rowErrors[row.key] = errors;
      continue;
    }
    entries.push({ company, sector: row.sector, stage, cheque, year });
  }

  const crunchbaseUrl = options.crunchbaseUrl.trim();
  const crunchbaseError =
    crunchbaseUrl && !isCrunchbaseUrl(crunchbaseUrl)
      ? "Enter a Crunchbase profile URL like https://www.crunchbase.com/person/your-name."
      : null;

  const hasRowErrors = Object.keys(rowErrors).length > 0;
  let formError: string | null = hasRowErrors ? "Fix the highlighted rows to continue." : null;
  if (!hasRowErrors && entries.length < MIN_PRIOR_INVESTMENTS) {
    formError = `Add at least ${MIN_PRIOR_INVESTMENTS} investments, or skip for now.`;
  } else if (!hasRowErrors && entries.length > MAX_PRIOR_INVESTMENTS) {
    formError = `You can add up to ${MAX_PRIOR_INVESTMENTS} investments.`;
  }

  if (formError || crunchbaseError) {
    return { data: null, rowErrors, formError, crunchbaseError };
  }
  return {
    data: {
      entries,
      hide_cheque_amounts: options.hideChequeAmounts,
      crunchbase_url: crunchbaseUrl || null,
    },
    rowErrors: {},
    formError: null,
    crunchbaseError: null,
  };
}
