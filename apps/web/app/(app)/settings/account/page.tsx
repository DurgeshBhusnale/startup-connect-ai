import { currentUser } from "@clerk/nextjs/server";

import { SchedulingLinkForm } from "@/components/meetings/scheduling-link-form";
import { AccountPanel } from "@/components/settings/account-panel";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { getSchedulingLink } from "@/lib/meetings-api";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const [user, scheduling] = await Promise.all([currentUser(), getSchedulingLink()]);
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-h1 text-ink">Account settings</h1>
        <p className="text-small text-muted">
          Manage your sign-in details and the devices signed in to your account.
        </p>
      </header>
      <AccountPanel />
      <section id="scheduling" aria-labelledby="scheduling-heading" className={`${cardStyles} p-6`}>
        <h2 id="scheduling-heading" className="text-h3">
          Scheduling
        </h2>
        <p className="mt-1 text-small text-muted">
          Mutual matches book meetings with you through your Cal.com calendar.
        </p>
        <div className="mt-4">
          {scheduling ? (
            <SchedulingLinkForm initialLink={scheduling.cal_link} />
          ) : (
            <p className="text-small text-ink">
              Couldn’t load your booking link. Refresh to try again.
            </p>
          )}
        </div>
      </section>
      <DeleteAccountSection email={email} />
    </>
  );
}
