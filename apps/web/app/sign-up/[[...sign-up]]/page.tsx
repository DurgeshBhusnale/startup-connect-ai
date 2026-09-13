import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

import { AuthCard, PrivacyNote } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAppearance } from "@/components/auth/clerk-appearance";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <AuthShell>
      <AuthCard
        badge="Free for founders"
        badgeAside="Secured by Clerk"
        title="Create your account"
        subtitle="Connect with high-conviction founders, angels, and mentors."
        activeTab="sign-up"
        footer={
          <>
            <p className="text-small text-muted">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-emerald-deep hover:underline">
                Sign in
              </Link>
            </p>
            <div className="mt-2">
              <PrivacyNote />
            </div>
          </>
        }
      >
        <SignUp appearance={clerkAppearance} signInUrl="/sign-in" />
      </AuthCard>
    </AuthShell>
  );
}
