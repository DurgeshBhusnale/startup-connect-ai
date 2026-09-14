import Link from "next/link";

import { BanknoteIcon, GlobeIcon, PencilIcon, SparklesIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRupees } from "@/lib/currency";
import { geographies, investmentStages } from "@/lib/taxonomy";
import { buttonStyles, cardStyles } from "@/lib/ui";

import { ClaimStatus } from "./claim-status";
import { ProfileAvatar } from "./profile-avatar";
import { ProfileTabs } from "./profile-tabs";

import type { ProfileTab } from "./profile-tabs";
import type { BadgesResponse, InvestorProfileState, ThesisData } from "@/lib/api-types";

const linkClass = "rounded-md text-small font-medium text-emerald-deep hover:underline";
const labelClass = "font-mono text-meta font-normal uppercase tracking-wider text-muted";

function stageLabel(value: string): string {
  return investmentStages.find((stage) => stage.value === value)?.label ?? value;
}

function geographyLabel(value: string): string {
  return geographies.find((geography) => geography.value === value)?.label ?? value;
}

type InvestorProfileViewProps = {
  displayName: string;
  state: InvestorProfileState;
  thesis: ThesisData;
  badges: BadgesResponse;
  tab: string;
};

export function InvestorProfileView({
  displayName,
  state,
  thesis,
  badges,
  tab,
}: InvestorProfileViewProps) {
  const tabs: readonly ProfileTab[] = [
    { key: "overview", label: "Overview" },
    { key: "investments", label: "Prior investments", count: state.prior_investments.length },
    { key: "activity", label: "Activity" },
  ];
  const activeTab = tabs.some((item) => item.key === tab) ? tab : "overview";
  const chequeRange =
    thesis.cheque_min && thesis.cheque_max
      ? `₹${formatRupees(thesis.cheque_min)} – ₹${formatRupees(thesis.cheque_max)}`
      : "Not set";

  return (
    <div className="mx-auto grid max-w-content gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
      <aside className="flex flex-col gap-6">
        <section className={`${cardStyles} flex flex-col items-center p-6 text-center`}>
          <ProfileAvatar name={displayName} />
          <h1 className="mt-4 text-h2">{displayName}</h1>
          <p className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-meta text-ink">
            Investor · {thesis.sectors.slice(0, 2).join(" & ")}
          </p>
          {state.bio ? (
            <p className="mt-4 text-small text-ink">{state.bio}</p>
          ) : (
            <Link href="/profile/about" className={`${linkClass} mt-4`}>
              Add a short bio
            </Link>
          )}
          <div className="mt-6 flex w-full flex-col gap-2">
            <Link href="/onboarding/investor" className={buttonStyles.secondary}>
              <PencilIcon />
              Edit thesis
            </Link>
            <Link href="/profile/about" className={buttonStyles.ghost}>
              Edit bio
            </Link>
          </div>
        </section>

        {state.crunchbase_url ? (
          <section aria-labelledby="linked-heading" className={`${cardStyles} p-6`}>
            <h2 id="linked-heading" className={`${labelClass} font-sans`}>
              Linked profiles
            </h2>
            <a
              href={state.crunchbase_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 break-all text-small font-medium text-emerald-deep hover:underline"
            >
              <GlobeIcon className="h-4 w-4 shrink-0" />
              {state.crunchbase_url.replace(/^https:\/\/www\./, "")}
            </a>
            <p className="mt-1 text-meta text-muted">Self-reported link, not yet verified.</p>
          </section>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <ProfileTabs tabs={tabs} active={activeTab} />

        {activeTab === "overview" ? (
          <section aria-labelledby="thesis-heading" className={`${cardStyles} p-6`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="thesis-heading" className="text-h3">
                Investment thesis
              </h2>
              <Link href="/onboarding/investor" className={linkClass}>
                Edit
              </Link>
            </div>
            <ClaimStatus itemId="thesis" badges={badges} />

            <dl className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <dt className={labelClass}>Sectors</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {thesis.sectors.map((sector) => (
                    <span key={sector} className="rounded-full bg-emerald/10 px-3 py-1 text-small text-emerald-deep">
                      {sector}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className={labelClass}>Stages</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {thesis.stages.map((stage) => (
                    <span key={stage} className="rounded bg-slate-100 px-3 py-1 text-small font-medium text-ink">
                      {stageLabel(stage)}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className={labelClass}>Cheque range</dt>
                <dd className="mt-2 font-heading text-h3 text-ink">{chequeRange}</dd>
              </div>
              <div>
                <dt className={labelClass}>Geographies</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {thesis.geographies.map((geography) => (
                    <span key={geography} className="rounded bg-slate-100 px-3 py-1 text-small text-ink">
                      {geographyLabel(geography)}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>

            {thesis.no_gos.length > 0 ? (
              <div className="mt-6 rounded-md border border-alert-red/20 bg-alert-red/5 p-4">
                <p className={labelClass}>No-gos</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {thesis.no_gos.map((tag) => (
                    <li key={tag} className="rounded bg-white px-2 py-1 text-small text-alert-red">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : activeTab === "investments" ? (
          state.prior_investments.length > 0 ? (
            <section aria-labelledby="deals-heading" className={`${cardStyles} p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="deals-heading" className="text-h3">
                  Prior investments
                </h2>
                <Link href="/onboarding/investor/prior-investments" className={linkClass}>
                  Add or edit
                </Link>
              </div>
              <ClaimStatus itemId="prior_investments" badges={badges} />
              {state.hide_cheque_amounts ? (
                <p className="mt-2 text-meta text-muted">Cheque amounts are hidden from founders.</p>
              ) : null}
              <div className="mt-4 overflow-x-auto rounded-md border border-line">
                <table className="min-w-full text-left text-small">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Company", "Sector", "Stage", "Cheque", "Year"].map((heading) => (
                        <th key={heading} scope="col" className={`${labelClass} px-4 py-3`}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {state.prior_investments.map((deal) => (
                      <tr key={`${deal.company}-${deal.year}`}>
                        <td className="px-4 py-3 font-medium text-ink">{deal.company}</td>
                        <td className="px-4 py-3 text-ink">{deal.sector}</td>
                        <td className="px-4 py-3 text-ink">{stageLabel(deal.stage)}</td>
                        <td className="px-4 py-3 font-mono text-ink">
                          {deal.cheque ? `₹${formatRupees(deal.cheque)}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-ink">{deal.year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className={`${cardStyles} p-6`}>
              <EmptyState
                icon={<BanknoteIcon className="h-8 w-8" />}
                title="No prior investments yet"
                body="Adding 3–10 past deals helps us find founders similar to the ones you’ve backed."
                action={{ href: "/onboarding/investor/prior-investments", label: "Add investments" }}
              />
            </section>
          )
        ) : (
          <section className={`${cardStyles} p-6`}>
            <EmptyState
              icon={<SparklesIcon className="h-8 w-8" />}
              title="No activity yet"
              body="Accepted intros and meetings will show up here once matching launches."
            />
          </section>
        )}
      </div>
    </div>
  );
}
