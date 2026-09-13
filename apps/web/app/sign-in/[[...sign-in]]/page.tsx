import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

import { AuthCard, PrivacyNote } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAppearance } from "@/components/auth/clerk-appearance";
import { LockIcon } from "@/components/icons";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell>
      <AuthCard
        badge="Secure portal"
        badgeAside="Encrypted in transit"
        title="Welcome back"
        subtitle="Sign in to access your matches and deal telemetry."
        align="center"
        leadingIcon={<LockIcon className="h-6 w-6" />}
        activeTab="sign-in"
        footer={
          <>
            <p className="text-small text-muted">
              Don’t have an account?{" "}
              <Link href="/sign-up" className="font-medium text-emerald-deep hover:underline">
                Sign up
              </Link>
            </p>
            <div className="mt-2">
              <PrivacyNote />
            </div>
          </>
        }
      >
        <SignIn appearance={clerkAppearance} signUpUrl="/sign-up" />
      </AuthCard>
    </AuthShell>
  );
}
