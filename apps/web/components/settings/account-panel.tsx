"use client";

import { useClerk, useSession, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import {
  CircleCheckIcon,
  MonitorIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
} from "@/components/icons";
import { buttonStyles, cardStyles } from "@/lib/ui";

import type { ReactNode } from "react";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type DeviceSession = Awaited<ReturnType<ClerkUser["getSessions"]>>[number];

const ACTIVE_WINDOW_MS = 5 * 60_000;
const lastActiveFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const smallButton =
  "inline-flex shrink-0 items-center justify-center rounded-md border border-line bg-white px-3 py-2 text-small font-medium text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

function SettingRow({
  label,
  action,
  children,
}: {
  label: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-meta uppercase tracking-wider text-muted">{label}</p>
        <div className="mt-1 text-small text-ink">{children}</div>
      </div>
      {action}
    </div>
  );
}

function describeSession(session: DeviceSession): { title: string; detail: string; mobile: boolean } {
  const activity = session.latestActivity;
  const mobile = activity?.isMobile ?? false;
  const device = activity?.deviceType || (mobile ? "Mobile device" : "Computer");
  const browser = activity?.browserName ? ` · ${activity.browserName}` : "";
  const place = [activity?.city, activity?.country].filter(Boolean).join(", ");
  return {
    title: `${device}${browser}`,
    detail: [place, activity?.ipAddress].filter(Boolean).join(" · "),
    mobile,
  };
}

function PanelSkeleton() {
  return (
    <section className={`${cardStyles} flex flex-col gap-3 p-6`} aria-busy="true">
      <div className="h-6 w-1/3 animate-pulse rounded-md bg-slate-100" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-16 animate-pulse rounded-md bg-slate-100" />
      ))}
    </section>
  );
}

// Email, password, and 2FA changes go through Clerk's own secure flow (Clerk owns auth).
export function AccountPanel() {
  const { isLoaded, user } = useUser();
  const { session: currentSession } = useSession();
  const clerk = useClerk();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    try {
      const list = await user.getSessions();
      setSessions([...list].sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime()));
      setSessionError(null);
    } catch (error) {
      console.error("Loading sessions failed", error);
      setSessionError("Couldn’t load your sessions. Refresh to try again.");
    }
  }, [user]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revoke = async (targets: DeviceSession[], key: string) => {
    setRevoking(key);
    setSessionError(null);
    try {
      await Promise.all(targets.map((target) => target.revoke()));
      await loadSessions();
    } catch (error) {
      console.error("Signing out a session failed", error);
      setSessionError("Couldn’t sign out that session. Try again.");
    } finally {
      setRevoking(null);
    }
  };

  if (!isLoaded || !user) {
    return (
      <>
        <PanelSkeleton />
        <PanelSkeleton />
      </>
    );
  }

  const manage = () => clerk.openUserProfile();
  const email = user.primaryEmailAddress;
  const verified = email?.verification?.status === "verified";
  const others = sessions?.filter((session) => session.id !== currentSession?.id) ?? [];
  const count = sessions?.length ?? 0;
  const now = Date.now();

  return (
    <>
      <section aria-labelledby="basic-heading" className={`${cardStyles} p-6`}>
        <h2 id="basic-heading" className="text-h3">
          Sign-in details
        </h2>
        <p className="mt-1 text-small text-muted">Changes open a secure window from Clerk, our sign-in provider.</p>
        <div className="mt-4 flex flex-col gap-3">
          <SettingRow
            label="Email"
            action={
              <button type="button" onClick={manage} className={smallButton}>
                Change
              </button>
            }
          >
            <span className="flex flex-wrap items-center gap-2 break-all">
              {email?.emailAddress ?? "No email address"}
              {verified ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald/10 px-2 py-1 font-mono text-meta text-emerald-deep">
                  <CircleCheckIcon className="h-4 w-4" />
                  Verified
                </span>
              ) : null}
            </span>
          </SettingRow>

          <SettingRow
            label="Password"
            action={
              <button type="button" onClick={manage} className={smallButton}>
                {user.passwordEnabled ? "Change" : "Add password"}
              </button>
            }
          >
            {user.passwordEnabled ? (
              <span className="font-mono tracking-wider">
                <span aria-hidden="true">••••••••</span>
                <span className="sr-only">Password set</span>
              </span>
            ) : (
              <span className="text-muted">Not set. You sign in with a connected account.</span>
            )}
          </SettingRow>

          <SettingRow
            label="Two-factor authentication"
            action={
              <button type="button" onClick={manage} className={smallButton}>
                {user.twoFactorEnabled ? "Manage" : "Set up"}
              </button>
            }
          >
            <span className="flex flex-wrap items-center gap-2">
              {user.twoFactorEnabled ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald/10 px-2 py-1 font-mono text-meta uppercase text-emerald-deep">
                  <ShieldCheckIcon className="h-4 w-4" />
                  On
                </span>
              ) : (
                <>
                  <span className="rounded border border-line bg-white px-2 py-1 font-mono text-meta uppercase text-ink">
                    Off
                  </span>
                  <span className="text-meta text-muted">Recommended</span>
                </>
              )}
            </span>
            <p className="mt-1 text-small text-muted">
              Asks for a code from an authenticator app when you sign in.
            </p>
          </SettingRow>
        </div>
      </section>

      <section aria-labelledby="sessions-heading" className={`${cardStyles} p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sessions-heading" className="text-h3">
            Sessions
          </h2>
          {sessions ? (
            <p className="flex items-center gap-2 font-mono text-meta text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-bright" />
              Signed in on {count} {count === 1 ? "device" : "devices"}
            </p>
          ) : null}
        </div>

        {sessionError ? (
          <p role="alert" className="mt-4 text-small text-alert-red">
            {sessionError}
          </p>
        ) : null}

        {sessions === null ? (
          <div className="mt-4 flex flex-col gap-3" aria-busy="true">
            <div className="h-16 animate-pulse rounded-md bg-slate-100" />
            <div className="h-16 animate-pulse rounded-md bg-slate-100" />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {sessions.map((session) => {
              const info = describeSession(session);
              const isCurrent = session.id === currentSession?.id;
              const activeNow = now - session.lastActiveAt.getTime() < ACTIVE_WINDOW_MS;
              const Icon = info.mobile ? SmartphoneIcon : MonitorIcon;
              return (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 rounded-md bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line bg-white text-ink"
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-small font-medium text-ink">
                        {info.title}
                        {isCurrent ? (
                          <span className="rounded bg-emerald/10 px-2 py-1 font-mono text-meta uppercase text-emerald-deep">
                            This device
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 break-all font-mono text-meta text-muted">
                        {[
                          info.detail,
                          activeNow
                            ? "Active now"
                            : `Last active ${lastActiveFormat.format(session.lastActiveAt)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  {isCurrent ? null : (
                    <button
                      type="button"
                      onClick={() => void revoke([session], session.id)}
                      disabled={revoking !== null}
                      className={smallButton}
                    >
                      {revoking === session.id ? "Signing out…" : "Sign out"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {others.length > 0 ? (
          <button
            type="button"
            onClick={() => void revoke(others, "others")}
            disabled={revoking !== null}
            className={`${buttonStyles.secondary} mt-4 w-full sm:w-auto`}
          >
            {revoking === "others" ? "Signing out…" : "Sign out other sessions"}
          </button>
        ) : null}
      </section>
    </>
  );
}
