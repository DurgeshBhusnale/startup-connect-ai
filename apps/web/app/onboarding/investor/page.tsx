import { redirect } from "next/navigation";

import { InvestorThesisForm } from "@/components/onboarding/investor-thesis-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { getInvestorProfileState } from "@/lib/investor-profile-api";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Investment thesis" };

export default async function InvestorThesisPage() {
  const state = await getInvestorProfileState();
  if (!state) {
    redirect("/onboarding");
  }

  return (
    <OnboardingShell>
      <section className={`${cardStyles} mx-auto w-full max-w-onboarding-wide p-6 sm:p-8`}>
        <OnboardingStepper flow="investor" current={1} />
        <h1 className="mt-6">
          {state.thesis ? "Your investment thesis" : "Set your investment thesis"}
        </h1>
        <p className="mt-2 text-small text-muted">
          This helps us filter incoming founder matches to only those that fit what you actually
          invest in.
        </p>
        <div className="mt-8">
          <InvestorThesisForm
            thesis={state.thesis}
            mode={state.completed ? "edit" : "onboarding"}
          />
        </div>
      </section>
    </OnboardingShell>
  );
}
