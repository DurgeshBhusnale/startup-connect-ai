import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { cardStyles } from "@/lib/ui";

export default function FounderOnboardingLoading() {
  return (
    <OnboardingShell>
      <div aria-busy="true" className={`${cardStyles} mx-auto w-full max-w-onboarding p-8`}>
        <span className="sr-only">Loading</span>
        <div className="mx-auto h-8 w-1/2 animate-pulse rounded-md bg-slate-100" />
        <div className="mx-auto mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="mt-8 h-24 animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-4 h-12 animate-pulse rounded-md bg-slate-100" />
      </div>
    </OnboardingShell>
  );
}
