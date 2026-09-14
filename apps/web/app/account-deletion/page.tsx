import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { TriangleAlertIcon } from "@/components/icons";
import { getMe } from "@/lib/me";
import { buttonStyles, cardStyles } from "@/lib/ui";

import { restoreAccount } from "./actions";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account scheduled for deletion" };

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

type AccountDeletionPageProps = {
  searchParams: Promise<{ restore?: string }>;
};

export default async function AccountDeletionPage({ searchParams }: AccountDeletionPageProps) {
  const [me, { restore }] = await Promise.all([getMe(), searchParams]);
  if (!me.hard_delete_at) {
    redirect(me.onboarded ? "/home" : "/onboarding");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className={`${cardStyles} w-full max-w-auth-card p-8 text-center`}>
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-alert-red/10 text-alert-red">
          <TriangleAlertIcon className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-heading text-h2 text-ink">Your account is scheduled for deletion</h1>
        <p className="mt-2 text-small text-muted">
          Your profile is hidden and you won’t be matched. Everything will be permanently erased on{" "}
          <strong className="font-semibold text-ink">
            {dateFormat.format(new Date(me.hard_delete_at))}
          </strong>
          . Until then, you can restore your account.
        </p>
        {restore === "failed" ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
          >
            We couldn’t restore your account just now. Try again in a moment.
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3">
          <form action={restoreAccount}>
            <button type="submit" className={`${buttonStyles.primary} w-full`}>
              Restore my account
            </button>
          </form>
          <SignOutButton redirectUrl="/">
            <button type="button" className={`${buttonStyles.ghost} w-full`}>
              Sign out
            </button>
          </SignOutButton>
        </div>
      </section>
    </main>
  );
}
