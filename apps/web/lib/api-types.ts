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
  /** Set while an account deletion is in its 30-day grace period. */
  hard_delete_at: string | null;
  matching_enabled: boolean;
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

export type CitationSource =
  | "founder_profile"
  | "investor_thesis"
  | "investor_portfolio"
  | "mentor_expertise";

export type Citation = {
  value: string;
  sources: CitationSource[];
};

export type ExplanationResponse = MatchExplanation & {
  match_id: string;
  full: { positives: string[]; concerns: string[] };
  citations: Citation[];
  generated_at: string;
};

export type FeatureScore = {
  feature: string;
  label: string;
  score: number;
  weight: number;
};

export type MatchDetails =
  | { kind: "founder"; l1: FounderL1Data; website: string | null }
  | {
      kind: "investor";
      thesis: ThesisData;
      prior_investments: PriorInvestmentItem[];
      cheques_hidden: boolean;
    }
  | { kind: "mentor"; expertise: MentorExpertiseData };

export type MatchDetailResponse = {
  match_id: string;
  fit_score: number;
  content_score: number;
  collab_score: number;
  updated_at: string;
  to_profile: MatchProfileCard;
  details: MatchDetails;
  scoring: FeatureScore[];
  badges: BadgesResponse;
  state: MatchState;
  upcoming_meeting: MeetingItem | null;
};

export type MeetingItem = {
  meeting_id: string;
  scheduled_at: string;
  ends_at: string;
  duration_minutes: number;
  title: string | null;
  video_url: string | null;
  status: "scheduled" | "cancelled";
  host_is_me: boolean;
  booked_by_me: boolean;
};

export type SchedulingContext = {
  match_id: string;
  connection: ConnectionStatus;
  can_schedule: boolean;
  partner: MatchProfileCard;
  partner_cal_link: string | null;
  my_cal_link: string | null;
  host: "partner" | "me" | null;
  upcoming_meeting: MeetingItem | null;
};

export type SchedulingLinkResponse = {
  cal_link: string | null;
  booking_url: string | null;
};

export type MeetingCreatedResponse = {
  meeting_id: string;
};

export type NudgeResponse = {
  status: "sent" | "already_sent";
};

export type OutcomeChoice = "great_fit" | "not_a_fit" | "undecided" | "cancelled";

export type MeetingOutcomeContext = {
  meeting: MeetingItem;
  match_id: string | null;
  partner: MatchProfileCard;
  can_submit: boolean;
  my_outcome: OutcomeChoice | null;
  my_notes: string | null;
  submitted_at: string | null;
};

export type MeetingOutcomeResponse = {
  status: "saved";
  outcome: OutcomeChoice;
};

export type MatchItem = {
  match_id: string;
  to_profile: MatchProfileCard;
  fit_score: number;
  content_score: number;
  collab_score: number;
  explanation: MatchExplanation;
  state: MatchState;
};

export type RejectReason =
  | "wrong_sector"
  | "wrong_stage"
  | "wrong_geo"
  | "not_right_person"
  | "other";

export type ConnectionStatus =
  | "none"
  | "interested"
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled";

export type ConsentScope =
  | "terms_privacy"
  | "match_processing"
  | "email_notifications"
  | "whatsapp_notifications";

export type ConsentItem = {
  scope: ConsentScope;
  granted: boolean;
  granted_at: string | null;
  policy_version: string | null;
  withdrawable: boolean;
};

export type ConsentCreatedResponse = {
  consent_id: string;
};

export type NotificationPreferences = {
  new_matches: boolean;
  intro_requests: boolean;
  mutual_matches: boolean;
  interest: boolean;
  meetings: boolean;
};

export type DataExportResponse = {
  export_id: string;
  estimated_ready_at: string;
  download_path: string;
};

export type DataExportItem = {
  export_id: string;
  requested_at: string;
  downloaded_at: string | null;
};

export type DeleteAccountResponse = {
  status: "scheduled_deletion";
  hard_delete_at: string;
};

export type MatchState = {
  saved_at: string | null;
  rejected: boolean;
  connection: ConnectionStatus;
  intro_id: string | null;
};

export type MatchActionType = "accept" | "reject" | "save" | "unsave" | "restore";

export type MatchActionResponse = {
  status: "ok";
  updated_match_state: MatchState;
};

export type SavedMatchItem = MatchItem & { saved_at: string };

export type IntroDraftResponse = {
  draft: string;
  source: "llm" | "unavailable";
};

export type IntroCreatedResponse = {
  intro_id: string;
  status: ConnectionStatus;
};

export type IntroRespondResponse = {
  status: ConnectionStatus;
  match_id: string;
};

export type IntroQueueItem = {
  intro_id: string;
  match_id: string;
  founder: MatchProfileCard;
  sector: string;
  message: string;
  fit_score: number;
  requested_at: string;
};

export type NotificationKind =
  | "new_match"
  | "new_matches"
  | "intro_received"
  | "mutual_match"
  | "match_interest"
  | "matching_paused"
  | "intro_cancelled"
  | "meeting_booked"
  | "meeting_reminder"
  | "meeting_invite"
  | "scheduling_link_request"
  | "meeting_outcome_prompt";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  action_label: string | null;
  action_href: string | null;
  read: boolean;
  created_at: string;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  unread_count: number;
};

export type NotificationSummary = {
  unread_count: number;
  pending_intros: number;
};

export type PostKind = "text" | "image" | "milestone";

export type MilestoneType = "users" | "revenue" | "hiring" | "funding" | "launch" | "other";

export type MilestoneData = {
  type: MilestoneType;
  value: string;
  achieved_on: string;
  description: string | null;
};

export type PostMediaItem = {
  media_id: string;
  url: string | null;
  thumbnail_url: string | null;
  width: number;
  height: number;
};

export type PostItem = {
  post_id: string;
  kind: PostKind;
  body: string;
  milestone_data: MilestoneData | null;
  media: PostMediaItem[];
  created_at: string;
  updated_at: string;
  edited: boolean;
};

export type PostsPage = {
  items: PostItem[];
  next_cursor: string | null;
};

export type PostCreatedResponse = {
  post_id: string;
};

export type MediaUploadResponse = PostMediaItem;

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
