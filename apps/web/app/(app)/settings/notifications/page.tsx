import { redirect } from "next/navigation";

import { ConsentToggleList } from "@/components/settings/consent-toggle-list";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";
import { getMe } from "@/lib/me";
import { getConsents, getNotificationPreferences } from "@/lib/settings-api";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notification settings" };

function LoadError() {
  return (
    <p className="mt-4 text-small text-muted">Couldn’t load these settings. Refresh to try again.</p>
  );
}

export default async function NotificationSettingsPage() {
  const [me, preferences, consents] = await Promise.all([
    getMe(),
    getNotificationPreferences(),
    getConsents(),
  ]);
  if (!me.role) {
    redirect("/onboarding");
  }
  const channelConsents =
    consents?.filter(
      (item) => item.scope === "email_notifications" || item.scope === "whatsapp_notifications",
    ) ?? null;

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-h1 text-ink">Notification preferences</h1>
        <p className="text-small text-muted">
          Choose what we tell you about and where. We only notify you about things that need you.
        </p>
      </header>

      <section aria-labelledby="topics-heading" className={`${cardStyles} p-6`}>
        <h2 id="topics-heading" className="text-h3">
          In-app notifications
        </h2>
        <p className="mt-1 text-small text-muted">
          What shows up in your notification feed. Account notices, like paused matching or a
          cancelled intro, always show.
        </p>
        {preferences ? (
          <NotificationPreferencesForm role={me.role} initial={preferences} />
        ) : (
          <LoadError />
        )}
      </section>

      <section aria-labelledby="channels-heading" className={`${cardStyles} p-6`}>
        <h2 id="channels-heading" className="text-h3">
          Channels
        </h2>
        <div className="mt-2 flex items-start justify-between gap-4 border-b border-line py-4">
          <div>
            <p className="text-small font-medium text-ink">In-app</p>
            <p className="mt-1 text-small text-muted">Your notification feed and the bell badge.</p>
          </div>
          <span className="shrink-0 rounded bg-emerald/10 px-2 py-1 font-mono text-meta uppercase text-emerald-deep">
            Always on
          </span>
        </div>
        {channelConsents ? <ConsentToggleList items={channelConsents} /> : <LoadError />}
        <p className="mt-2 text-meta text-muted">
          Email and WhatsApp choices are saved to your consent history and apply once those channels
          launch.
        </p>
      </section>
    </>
  );
}
