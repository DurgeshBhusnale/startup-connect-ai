import { currentUser } from "@clerk/nextjs/server";
import { redirect, unstable_rethrow } from "next/navigation";

import { AuthCard, PrivacyNote } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { RetryButton } from "@/components/ui/retry-button";
import { getMe } from "@/lib/me";

import type { Me } from "@/lib/api-types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Set up your account" };

async function loadMe(): Promise<Me | null> {
  try {
    return await getMe();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load account for onboarding", error);
    return null;
  }
}

export default async function OnboardingPage() {
  const [me, user] = await Promise.all([loadMe(), currentUser()]);
  if (me?.onboarded) {
    redirect("/home");
  }

  return (
    <AuthShell>
      <AuthCard
        badge="Account setup"
        badgeAside="Private by default"
        title={user?.firstName ? `Welcome, ${user.firstName}` : "Welcome"}
        subtitle="Pick your primary role so we can show you the right matches. You can add another role later."
        footer={<PrivacyNote />}
      >
        {me ? (
          <OnboardingForm />
        ) : (
          <div
            role="alert"
            className="flex flex-col gap-4 rounded-md border border-alert-red/30 bg-alert-red/5 p-4"
          >
            <p className="text-small text-alert-red">
              We couldn’t load your account right now. Check your connection and try again.
            </p>
            <RetryButton />
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}
