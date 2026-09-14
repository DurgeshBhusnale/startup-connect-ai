import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

import { DownloadIcon } from "@/components/icons";
import { ConsentToggleList } from "@/components/settings/consent-toggle-list";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import { getConsents, getDataExports } from "@/lib/settings-api";
import { buttonStyles, cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy & Data" };

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const exportErrors: Record<string, string> = {
  "export-limit": "You’ve reached today’s export limit. Try again tomorrow.",
  "export-failed": "Couldn’t create your export. Try again in a moment.",
};

type PrivacySettingsPageProps = {
  searchParams: Promise<{ export?: string }>;
};

export default async function PrivacySettingsPage({ searchParams }: PrivacySettingsPageProps) {
  const [{ export: exportStatus }, consents, exports, user] = await Promise.all([
    searchParams,
    getConsents(),
    getDataExports(),
    currentUser(),
  ]);
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const terms = consents?.find((item) => item.scope === "terms_privacy");
  const lastExport = exports[0];
  const exportError = exportStatus ? exportErrors[exportStatus] : undefined;

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-h1 text-ink">Privacy &amp; Data</h1>
        <p className="text-small text-muted">
          Control how your data is used, download a copy, or delete your account.
        </p>
      </header>

      <section aria-labelledby="consents-heading" className={`${cardStyles} p-6`}>
        <h2 id="consents-heading" className="text-h3">
          Your consents
        </h2>
        <p className="mt-1 text-small text-muted">
          How we use your data. Every change is recorded with the date and policy version.
        </p>
        {consents ? (
          <ConsentToggleList items={consents} />
        ) : (
          <p className="mt-4 text-small text-muted">Couldn’t load your consents. Refresh to try again.</p>
        )}
        {terms?.granted_at ? (
          <p className="mt-2 font-mono text-meta text-muted">
            Policy version {terms.policy_version} · accepted{" "}
            {dateFormat.format(new Date(terms.granted_at))}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="data-heading" className={`${cardStyles} p-6`}>
        <h2 id="data-heading" className="text-h3">
          Your data
        </h2>
        <div className="mt-4 rounded-md bg-slate-50 p-4">
          <h3 className="text-h4 text-ink">Export your data</h3>
          <p className="mt-1 text-small text-ink">
            Download a JSON file of everything we store about you: account, consent history,
            profile, matches, intro requests, feedback, and notifications. It’s generated as soon
            as you ask.
          </p>
          {exportError ? (
            <p role="alert" className="mt-3 text-small text-alert-red">
              {exportError}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* A plain link: the route handler responds with a file download, not a page. */}
            <a href="/settings/privacy/export" className={buttonStyles.secondary}>
              <DownloadIcon className="h-4 w-4" />
              Download my data
            </a>
            <p className="font-mono text-meta text-muted">
              Last export:{" "}
              {lastExport ? dateTimeFormat.format(new Date(lastExport.requested_at)) : "never"}
            </p>
          </div>
        </div>
      </section>

      <DeleteAccountSection email={email} />

      <p className="text-meta text-muted">
        Privacy policy version {PRIVACY_POLICY_VERSION} ·{" "}
        <Link href="/privacy" className="font-medium text-emerald-deep hover:underline">
          View policy
        </Link>
      </p>
    </>
  );
}
