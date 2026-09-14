import Link from "next/link";

import {
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRupees } from "@/lib/currency";
import { founderStages } from "@/lib/taxonomy";
import { buttonStyles, cardStyles, eyebrowStyles } from "@/lib/ui";

import { AskPinBanner } from "./ask-pin-banner";
import { ClaimStatus } from "./claim-status";
import { ProfileAvatar } from "./profile-avatar";
import { ProfileTabs } from "./profile-tabs";

import type { ProfileTab } from "./profile-tabs";
import type { BadgesResponse, FounderL1Data } from "@/lib/api-types";
import type { ReactNode } from "react";

const tabs: readonly ProfileTab[] = [
  { key: "overview", label: "Overview" },
  { key: "posts", label: "Posts" },
  { key: "momentum", label: "Momentum" },
];

const linkClass = "rounded-md text-small font-medium text-emerald-deep hover:underline";
const factLabelClass = "font-mono text-meta uppercase tracking-wider text-muted";

type FounderProfileViewProps = {
  displayName: string;
  l1: FounderL1Data;
  bio: string | null;
  website: string | null;
  askPin: string | null;
  /** S8 AC4: distinct people who endorsed a claim on this profile. */
  endorserCount: number;
  badges: BadgesResponse;
  tab: string;
  /** Rendered on the Posts tab (M4 timeline). */
  postsPanel: ReactNode;
};

export function FounderProfileView({
  displayName,
  l1,
  bio,
  website,
  askPin,
  endorserCount,
  badges,
  tab,
  postsPanel,
}: FounderProfileViewProps) {
  const activeTab = tabs.some((item) => item.key === tab) ? tab : "overview";
  const stage = founderStages.find((option) => option.value === l1.stage)?.label ?? l1.stage;
  const ask = `₹${formatRupees(l1.ask_amount_inr)}`;
  const facts = [
    { id: "l1.sector", label: "Sector", value: l1.sector },
    { id: "l1.stage", label: "Stage", value: stage },
    { id: "l1.ask_amount_inr", label: "Ask", value: ask },
    {
      id: "l1.team_size",
      label: "Team",
      value: `${l1.team_size} ${l1.team_size === 1 ? "person" : "people"}`,
    },
    { id: "l1.business_model", label: "Business model", value: l1.business_model },
  ];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
    <AskPinBanner text={askPin} editHref="/profile/edit#ask-pin" />
    {endorserCount > 0 ? (
      <section
        aria-label="Endorsements"
        className={`${cardStyles} flex items-center gap-3 p-4`}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald/10 text-emerald-deep"
        >
          <ShieldCheckIcon className="h-4 w-4" />
        </span>
        <p className="text-small text-ink">
          You’ve been endorsed by{" "}
          <strong className="font-semibold">
            {endorserCount} {endorserCount === 1 ? "person" : "people"}
          </strong>
          . Endorsed claims are highlighted below.
        </p>
      </section>
    ) : null}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
      <aside className="flex flex-col gap-6">
        <section className={`${cardStyles} flex flex-col items-center p-6 text-center`}>
          <ProfileAvatar name={displayName} />
          <h1 className="mt-4 text-h2">{displayName}</h1>
          <p className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-meta text-ink">
            Founder · {l1.startup_name}
          </p>
          <p className="mt-2 flex items-center gap-1 text-small text-muted">
            <MapPinIcon className="h-4 w-4" />
            {l1.city}
          </p>
          {bio ? (
            <p className="mt-4 text-small text-ink">{bio}</p>
          ) : (
            <Link href="/profile/about" className={`${linkClass} mt-4`}>
              Add a short bio
            </Link>
          )}

          <div className="mt-6 w-full rounded-lg bg-emerald/10 p-4 text-left">
            <p className={eyebrowStyles}>Currently seeking</p>
            <p className="mt-2 text-base font-medium text-ink">
              Raising {ask} · {stage} round
            </p>
            <ClaimStatus itemId="l1.ask_amount_inr" badges={badges} />
          </div>

          <div className="mt-4 flex w-full flex-col gap-2">
            <Link href="/profile?tab=posts&compose=1" scroll={false} className={buttonStyles.primary}>
              <PlusIcon className="h-4 w-4" />
              New post
            </Link>
            <Link href="/profile/edit" className={buttonStyles.secondary}>
              <PencilIcon />
              Edit profile
            </Link>
            <Link href="/profile/about" className={buttonStyles.ghost}>
              Edit bio &amp; website
            </Link>
          </div>
        </section>

        <section aria-labelledby="sources-heading" className={`${cardStyles} p-6`}>
          <h2 id="sources-heading" className={`${factLabelClass} font-sans font-normal`}>
            Connected sources
          </h2>
          <p className="mt-3 text-small text-muted">
            No sources connected yet. LinkedIn, GitHub, and Product Hunt activity will appear here
            with verified badges once momentum sync launches.
          </p>
        </section>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <ProfileTabs tabs={tabs} active={activeTab} />

        {activeTab === "overview" ? (
          <>
            <section aria-labelledby="venture-heading" className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 id="venture-heading" className="text-h3">
                  Venture parameters
                </h2>
                <Link href="/profile/edit" className={linkClass}>
                  Edit
                </Link>
              </div>
              <p className="text-meta text-muted">
                Self-reported by you. Verified badges appear when a connected source can back a
                claim.
              </p>
              <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {facts.map((fact) => (
                  <div
                    key={fact.id}
                    className={`${cardStyles} p-4 ${
                      badges.endorsed_items.some((item) => item.item_id === fact.id)
                        ? "ring-2 ring-emerald/30"
                        : ""
                    }`}
                  >
                    <dt className={factLabelClass}>{fact.label}</dt>
                    <dd className="mt-2 text-base font-semibold text-ink">
                      {fact.value}
                      <ClaimStatus itemId={fact.id} badges={badges} />
                    </dd>
                  </div>
                ))}
                <div className={`${cardStyles} p-4`}>
                  <dt className={factLabelClass}>Website</dt>
                  <dd className="mt-2 text-base font-semibold">
                    {website ? (
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-emerald-deep hover:underline"
                      >
                        {website.replace(/^https:\/\//, "")}
                      </a>
                    ) : (
                      <Link href="/profile/about" className={linkClass}>
                        Add website
                      </Link>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="startup-heading" className={`${cardStyles} p-6`}>
              <h2 id="startup-heading" className="text-h3">
                {l1.startup_name}
              </h2>
              <p className="mt-2 text-base text-ink">{l1.description}</p>
              <ClaimStatus itemId="l1.description" badges={badges} />
              {l1.competitors.length > 0 ? (
                <>
                  <h3 className={`${factLabelClass} mt-6 font-mono font-normal`}>
                    Top competitors
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {l1.competitors.map((name) => (
                      <li key={name} className="rounded bg-slate-100 px-3 py-1 text-small text-ink">
                        {name}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          </>
        ) : activeTab === "posts" ? (
          postsPanel
        ) : (
          <section className={`${cardStyles} p-6`}>
            <EmptyState
              icon={<SparklesIcon className="h-8 w-8" />}
              title="No sources connected"
              body="Verified activity from LinkedIn, GitHub, and Product Hunt will appear here once momentum sync launches."
            />
          </section>
        )}
      </div>
    </div>
    </div>
  );
}
