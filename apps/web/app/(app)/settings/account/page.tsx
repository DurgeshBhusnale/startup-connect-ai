import { currentUser } from "@clerk/nextjs/server";

import { AccountPanel } from "@/components/settings/account-panel";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const user = await currentUser();
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
      <DeleteAccountSection email={email} />
    </>
  );
}
