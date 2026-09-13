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

export type ProblemDetail = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: unknown[];
};
