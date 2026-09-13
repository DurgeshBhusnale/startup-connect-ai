import { redirect } from "next/navigation";

import { DeckUploadForm } from "@/components/onboarding/deck-upload-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { getFounderProfileState } from "@/lib/founder-profile-api";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Build your profile" };

export default async function FounderDeckPage() {
  const state = await getFounderProfileState();
  if (!state) {
    redirect("/onboarding");
  }
  if (state.completed) {
    redirect("/home");
  }

  return (
    <OnboardingShell>
      <section className={`${cardStyles} mx-auto w-full max-w-onboarding p-6 sm:p-8`}>
        <OnboardingStepper flow="founder" current={1} />
        <div className="mt-6 text-center">
          <h1>Let’s build your profile</h1>
          <p className="mt-2 text-small text-muted">
            Upload your pitch deck and paste your LinkedIn — we’ll do the rest in ~60 seconds.
          </p>
        </div>
        <div className="mt-8">
          <DeckUploadForm />
        </div>
      </section>
    </OnboardingShell>
  );
}
