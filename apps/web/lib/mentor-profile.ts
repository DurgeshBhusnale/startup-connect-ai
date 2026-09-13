import { isLinkedInProfileUrl } from "@/lib/founder-profile";
import { expertiseAreas, investmentStages, mentorAvailabilityOptions } from "@/lib/taxonomy";

import type {
  InvestmentStage,
  MentorAvailability,
  MentorExpertiseData,
  MentorExpertiseRequest,
  VerificationRequest,
} from "@/lib/api-types";

export const MAX_MENTOR_STAGES = 3;
export const HIGH_SESSION_FEE = 10_000;
const MAX_SESSION_FEE = 100_000;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type MentorField =
  | "areas"
  | "stages"
  | "availability"
  | "session_fee"
  | "linkedin_url"
  | "reference_emails";

export type MentorFormValues = {
  areas: string[];
  stages: string[];
  availability: string;
  session_fee: string;
  verification_method: string;
  linkedin_url: string;
  reference_email_1: string;
  reference_email_2: string;
};

export type MentorFieldErrors = Partial<Record<MentorField, string>>;

export type SaveMentorState = {
  fieldErrors: MentorFieldErrors;
  formError: string | null;
};

export const initialSaveMentorState: SaveMentorState = { fieldErrors: {}, formError: null };

export function mentorToFormValues(expertise: MentorExpertiseData | null): MentorFormValues {
  return {
    areas: expertise?.areas ?? [],
    stages: expertise?.stages ?? [],
    availability: expertise?.availability ?? "2-per-month",
    session_fee: expertise?.session_fee ? String(expertise.session_fee) : "",
    verification_method: "linkedin",
    linkedin_url: "",
    reference_email_1: "",
    reference_email_2: "",
  };
}

export function parseSessionFee(input: string): { ok: true; fee: number | null } | { ok: false } {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!cleaned) return { ok: true, fee: null };
  if (!/^\d+$/.test(cleaned)) return { ok: false };
  const fee = Number(cleaned);
  if (fee > MAX_SESSION_FEE) return { ok: false };
  return { ok: true, fee: fee === 0 ? null : fee };
}

export function availabilityLabel(value: MentorAvailability): string {
  return mentorAvailabilityOptions.find((option) => option.value === value)?.short ?? value;
}

export function stageLabel(value: InvestmentStage): string {
  return investmentStages.find((stage) => stage.value === value)?.label ?? value;
}

type MentorValidation =
  | {
      data: { expertise: MentorExpertiseRequest; verification: VerificationRequest | null };
      errors: null;
    }
  | { data: null; errors: MentorFieldErrors };

export function validateMentorProfile(
  values: MentorFormValues,
  includeVerification: boolean,
): MentorValidation {
  const errors: MentorFieldErrors = {};

  const areas = [...new Set(values.areas)].filter((area) =>
    (expertiseAreas as readonly string[]).includes(area),
  );
  if (areas.length === 0) errors.areas = "Pick at least one expertise area.";

  const stages = [...new Set(values.stages)].filter((stage): stage is InvestmentStage =>
    investmentStages.some((option) => option.value === stage),
  );
  if (stages.length === 0) {
    errors.stages = "Pick at least one stage.";
  } else if (stages.length > MAX_MENTOR_STAGES) {
    errors.stages = `Pick up to ${MAX_MENTOR_STAGES} stages where you add the most value.`;
  }

  const availability = mentorAvailabilityOptions.find(
    (option) => option.value === values.availability,
  )?.value;
  if (!availability) errors.availability = "Choose how often you’d like to meet founders.";

  const fee = parseSessionFee(values.session_fee);
  if (!fee.ok) {
    errors.session_fee = "Enter a whole rupee amount up to ₹1,00,000, or leave it blank for free.";
  }

  let verification: VerificationRequest | null = null;
  if (includeVerification) {
    if (values.verification_method === "references") {
      const emails = [values.reference_email_1, values.reference_email_2].map((email) =>
        email.trim().toLowerCase(),
      );
      if (!emails.every((email) => EMAIL.test(email)) || emails[0] === emails[1]) {
        errors.reference_emails = "Add two different founder email addresses.";
      } else {
        verification = { method: "references", payload: { reference_emails: emails } };
      }
    } else {
      const linkedinUrl = values.linkedin_url.trim();
      if (!isLinkedInProfileUrl(linkedinUrl)) {
        errors.linkedin_url = "Enter your LinkedIn profile URL, like https://linkedin.com/in/yourname.";
      } else {
        verification = { method: "linkedin", payload: { linkedin_url: linkedinUrl } };
      }
    }
  }

  if (!availability || !fee.ok || Object.keys(errors).length > 0) {
    return { data: null, errors };
  }
  return {
    data: {
      expertise: { areas, stages, availability, session_fee: fee.fee },
      verification,
    },
    errors: null,
  };
}
