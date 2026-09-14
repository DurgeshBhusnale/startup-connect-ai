export type AppRole = "founder" | "investor" | "mentor";

export type ConsentChoices = {
  terms_privacy: boolean;
  match_processing: boolean;
  email_notifications: boolean;
  whatsapp_notifications: boolean;
};

export type OnboardingRequest = {
  role: AppRole;
  consents: ConsentChoices;
};

export type Me = {
  onboarded: boolean;
  role: AppRole | null;
};

export type FounderStage = "pre-seed" | "seed" | "series-a";

export type FounderL1Data = {
  startup_name: string;
  sector: string;
  stage: FounderStage;
  city: string;
  business_model: string;
  ask_amount_inr: number;
  team_size: number;
  description: string;
  competitors: string[];
  linkedin_url: string | null;
};

export type FounderProfileDraft = {
  startup_name: string | null;
  sector: string | null;
  stage: FounderStage | null;
  ask_amount_inr: number | null;
  team_size: number | null;
  city: string | null;
  business_model: string | null;
  competitors: string[];
  description: string | null;
};

export type AutobuildResponse = {
  profile_draft: FounderProfileDraft;
  confidence_map: Record<string, number>;
};

export type FounderDraftState = AutobuildResponse & {
  deck_filename: string;
  deck_pages: number;
  linkedin_url: string;
};

export type FounderProfileState = {
  profile_id: string;
  completed: boolean;
  draft: FounderDraftState | null;
  l1_data: FounderL1Data | null;
  bio: string | null;
  website: string | null;
};

export type SaveProfileRequest = {
  kind: "founder";
  l1_data: FounderL1Data;
};

export type SaveProfileResponse = {
  profile_id: string;
};

export type InvestmentStage = "pre-seed" | "seed" | "series-a" | "series-b-plus";

export type Geography =
  | "bengaluru"
  | "pune"
  | "mumbai"
  | "delhi-ncr"
  | "hyderabad"
  | "chennai"
  | "india"
  | "sea"
  | "us"
  | "global";

export type ThesisRequest = {
  sectors: string[];
  stages: InvestmentStage[];
  cheque_min: number;
  cheque_max: number;
  geographies: Geography[];
  no_gos: string[];
};

export type ThesisData = {
  sectors: string[];
  stages: InvestmentStage[];
  cheque_min: number | null;
  cheque_max: number | null;
  geographies: Geography[];
  no_gos: string[];
};

export type ThesisResponse = {
  thesis_id: string;
};

export type PriorInvestmentEntry = {
  company: string;
  sector: string;
  stage: InvestmentStage;
  cheque: number | null;
  year: number;
};

export type PriorInvestmentItem = PriorInvestmentEntry & {
  source: string;
};

export type PriorInvestmentsRequest = {
  entries: PriorInvestmentEntry[];
  hide_cheque_amounts: boolean;
  crunchbase_url: string | null;
};

export type PriorInvestmentsResponse = {
  count: number;
};

export type InvestorProfileState = {
  profile_id: string;
  completed: boolean;
  thesis: ThesisData | null;
  prior_investments: PriorInvestmentItem[];
  hide_cheque_amounts: boolean;
  crunchbase_url: string | null;
  prior_investments_status: "added" | "skipped" | null;
  banner_dismissed: boolean;
  bio: string | null;
};

export type MentorAvailability = "1-per-month" | "2-per-month" | "4-per-month" | "unlimited";

export type MentorExpertiseRequest = {
  areas: string[];
  stages: InvestmentStage[];
  availability: MentorAvailability;
  session_fee: number | null;
};

export type MentorExpertiseResponse = {
  mentor_id: string;
};

export type VerificationRequest =
  | { method: "linkedin"; payload: { linkedin_url: string } }
  | { method: "references"; payload: { reference_emails: string[] } };

export type VerificationResponse = {
  status: "pending";
};

export type MentorExpertiseData = MentorExpertiseRequest;

export type MentorVerificationState = {
  method: "linkedin" | "references";
  status: "pending";
  linkedin_url: string | null;
  reference_count: number;
  requested_at: string;
};

export type MentorProfileState = {
  profile_id: string;
  completed: boolean;
  expertise: MentorExpertiseData | null;
  verification: MentorVerificationState | null;
  bio: string | null;
};

export type AboutRequest = {
  kind: AppRole;
  bio: string | null;
  website: string | null;
};

export type AboutResponse = {
  profile_id: string;
};

export type BadgesResponse = {
  verified_items: string[];
  endorsed_items: { item_id: string; endorser_id: string; endorser_name: string }[];
  self_reported_stale: string[];
  last_updated: Record<string, string>;
};

export type MatchProfileCard = {
  profile_id: string;
  kind: AppRole;
  display_name: string;
  headline: string;
  location: string | null;
  bio: string | null;
  facts: string[];
};

export type MatchExplanation = {
  source: "template" | "llm";
  short: string;
  features_used: string[];
};

export type MatchItem = {
  match_id: string;
  to_profile: MatchProfileCard;
  fit_score: number;
  content_score: number;
  collab_score: number;
  explanation: MatchExplanation;
};

export type RecomputeResponse = {
  count: number;
};

export type ProblemDetail = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: unknown[];
};
