import Link from "next/link";

import {
  BanknoteIcon,
  CalendarIcon,
  ClockIcon,
  PencilIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { availabilityLabel, stageLabel } from "@/lib/mentor-profile";
import { buttonStyles, cardStyles } from "@/lib/ui";

import { ClaimStatus } from "./claim-status";
import { ProfileAvatar } from "./profile-avatar";

import type {
  BadgesResponse,
  MentorExpertiseData,
  MentorVerificationState,
} from "@/lib/api-types";
import type { ReactNode } from "react";

const linkClass = "rounded-md text-small font-medium text-emerald-deep hover:underline";

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3">
      <dt className="flex items-center gap-2 text-small text-ink">
        {icon}
        {label}
      </dt>
      <dd className="text-right font-mono text-small font-medium text-ink">{value}</dd>
    </div>
  );
}

type MentorProfileViewProps = {
  displayName: string;
  expertise: MentorExpertiseData;
  verification: MentorVerificationState | null;
  bio: string | null;
  badges: BadgesResponse;
};

export function MentorProfileView({
  displayName,
  expertise,
  verification,
  bio,
  badges,
}: MentorProfileViewProps) {
  const headline = `Mentor · ${expertise.areas.slice(0, 2).join(" & ")}`;
  const fee = expertise.session_fee
    ? `₹${expertise.session_fee.toLocaleString("en-IN")} / session`
    : "Free";

  return (
    <div className="mx-auto grid max-w-content gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
      <section className={`${cardStyles} flex flex-col items-center p-6 text-center`}>
        <ProfileAvatar name={displayName} />
        <h1 className="mt-4 text-h2">{displayName}</h1>
        <p className="mt-1 text-small font-medium text-emerald-deep">{headline}</p>
        {verification ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-slate-50 px-3 py-1 text-meta text-ink">
            <ClockIcon className="h-4 w-4 text-alert-amber" />
            Verification pending
          </p>
        ) : (
          <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 text-meta text-muted">
            <ShieldCheckIcon className="h-4 w-4 text-muted" />
            Not verified yet ·{" "}
            <Link href="/onboarding/mentor" className="font-medium text-emerald-deep hover:underline">
              Get verified
            </Link>
          </p>
        )}
        {bio ? (
          <p className="mt-4 text-small text-ink">{bio}</p>
        ) : (
          <Link href="/profile/about" className={`${linkClass} mt-4`}>
            Add a short bio
          </Link>
        )}
        <div className="mt-6 flex w-full flex-col gap-2">
          <Link href="/onboarding/mentor" className={buttonStyles.secondary}>
            <PencilIcon />
            Edit profile
          </Link>
          <Link href="/profile/about" className={buttonStyles.ghost}>
            Edit bio
          </Link>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="expertise-heading" className={`${cardStyles} p-6`}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="expertise-heading" className="text-h3">
              Expertise
            </h2>
            <Link href="/onboarding/mentor" className={linkClass}>
              Edit
            </Link>
          </div>
          <ClaimStatus itemId="expertise" badges={badges} />

          <h3 className="mt-6 font-mono text-meta font-normal uppercase tracking-wider text-muted">
            Core disciplines
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {expertise.areas.map((area) => (
              <li key={area} className="rounded-full bg-emerald/10 px-3 py-1 text-small text-emerald-deep">
                {area}
              </li>
            ))}
          </ul>

          <h3 className="mt-6 font-mono text-meta font-normal uppercase tracking-wider text-muted">
            Stage focus
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {expertise.stages.map((stage) => (
              <li key={stage} className="rounded bg-slate-100 px-3 py-1 text-small font-medium text-ink">
                {stageLabel(stage)}
              </li>
            ))}
          </ul>

          <dl className="mt-6 flex flex-col gap-2">
            <DetailRow
              icon={<ClockIcon className="h-4 w-4 text-muted" />}
              label="Availability"
              value={availabilityLabel(expertise.availability)}
            />
            <DetailRow
              icon={<BanknoteIcon className="h-4 w-4 text-muted" />}
              label="Session fee"
              value={fee}
            />
          </dl>
        </section>

        <section aria-labelledby="sessions-heading" className={`${cardStyles} p-6`}>
          <h2 id="sessions-heading" className="text-h3">
            Sessions
          </h2>
          <div className="mx-auto flex max-w-empty flex-col items-center py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald/10 text-emerald">
              <CalendarIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-base font-semibold text-ink">No sessions yet</p>
            <p className="mt-1 text-small text-muted">
              Upcoming and past sessions with founders will show up here once scheduling launches.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
