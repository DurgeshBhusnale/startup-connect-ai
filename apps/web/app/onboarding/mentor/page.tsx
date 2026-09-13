import { redirect } from "next/navigation";

import { MentorProfileForm } from "@/components/onboarding/mentor-profile-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { getMentorProfileState } from "@/lib/mentor-profile-api";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentor profile" };

export default async function MentorOnboardingPage() {
  const state = await getMentorProfileState();
  if (!state) {
    redirect("/onboarding");
  }
  const mode = state.completed ? "edit" : "onboarding";

  return (
    <OnboardingShell>
      <section className={`${cardStyles} mx-auto w-full max-w-onboarding-wide p-6 sm:p-8`}>
        <p className="w-fit rounded-full bg-emerald/10 px-3 py-1 font-mono text-meta uppercase tracking-wider text-emerald-deep">
          Mentor setup
        </p>
        <h1 className="mt-4">{mode === "edit" ? "Edit your mentor profile" : "Set your mentor profile"}</h1>
        <p className="mt-2 text-small text-muted">
          We’ll only match you with founders in your expertise areas at your preferred cadence.
        </p>
        <div className="mt-8">
          <MentorProfileForm expertise={state.expertise} verification={state.verification} mode={mode} />
        </div>
      </section>
    </OnboardingShell>
  );
}
