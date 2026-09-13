import { redirect } from "next/navigation";

import { SparklesIcon } from "@/components/icons";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { ProfileReviewForm } from "@/components/onboarding/profile-review-form";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { countFilledFields } from "@/lib/founder-profile";
import { getFounderProfileState } from "@/lib/founder-profile-api";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Review your profile" };

type FounderReviewPageProps = {
  searchParams: Promise<{ manual?: string }>;
};

export default async function FounderReviewPage({ searchParams }: FounderReviewPageProps) {
  const [{ manual }, state] = await Promise.all([searchParams, getFounderProfileState()]);
  if (!state) {
    redirect("/onboarding");
  }
  if (state.completed) {
    redirect("/home");
  }
  const draft = manual === "1" ? null : state.draft;

  return (
    <OnboardingShell>
      <section className={`${cardStyles} mx-auto w-full max-w-onboarding-wide p-6 sm:p-8`}>
        <OnboardingStepper flow="founder" current={2} />
        <h1 className="mt-6">{draft ? "Here’s what we found" : "Tell us about your startup"}</h1>
        <p className="mt-2 text-small text-muted">
          {draft
            ? "Review and edit if anything needs fixing. Fields highlighted in amber were auto-detected with lower confidence — please double-check them."
            : "Fill in the basics investors and mentors match on. You can edit these later."}
        </p>
        {draft ? (
          <p className="mt-6 flex items-start gap-3 rounded-md border border-line bg-slate-50 p-4 text-small text-ink">
            <SparklesIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
            <span>
              AI filled {countFilledFields(draft.profile_draft)} of 9 fields from{" "}
              <span className="font-medium">{draft.deck_filename}</span> ({draft.deck_pages} pages).
            </span>
          </p>
        ) : null}
        <div className="mt-8">
          <ProfileReviewForm
            key={draft ? "draft" : "manual"}
            draft={draft?.profile_draft ?? null}
            confidence={draft?.confidence_map ?? {}}
            linkedinUrl={draft?.linkedin_url ?? null}
          />
        </div>
      </section>
    </OnboardingShell>
  );
}
