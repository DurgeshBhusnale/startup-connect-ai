import { redirect } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { PriorInvestmentsForm } from "@/components/onboarding/prior-investments-form";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { getInvestorProfileState } from "@/lib/investor-profile-api";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Investment history" };

export default async function PriorInvestmentsPage() {
  const state = await getInvestorProfileState();
  if (!state) {
    redirect("/onboarding");
  }
  if (!state.thesis) {
    redirect("/onboarding/investor");
  }

  return (
    <OnboardingShell>
      <section className={`${cardStyles} mx-auto w-full max-w-onboarding-wide p-6 sm:p-8`}>
        <OnboardingStepper flow="investor" current={2} />
        <h1 className="mt-6">Your investment history</h1>
        <p className="mt-2 text-small text-muted">
          This helps us find similar deals and shows founders your track record.
        </p>
        <div className="mt-8">
          <PriorInvestmentsForm
            initialItems={state.prior_investments}
            hideChequeAmounts={state.hide_cheque_amounts}
            crunchbaseUrl={state.crunchbase_url}
            completed={state.completed}
          />
        </div>
      </section>
    </OnboardingShell>
  );
}
