import { BanknoteIcon, ClockIcon, GlobeIcon } from "@/components/icons";
import { ClaimStatus } from "@/components/profile/claim-status";
import { formatRupees } from "@/lib/currency";
import { availabilityLabel } from "@/lib/mentor-profile";
import { founderStages, geographies, investmentStages } from "@/lib/taxonomy";
import { cardStyles } from "@/lib/ui";

import type { BadgesResponse, MatchDetails } from "@/lib/api-types";

const labelClass = "font-mono text-meta font-normal uppercase tracking-wider text-muted";
const chipClass = "rounded bg-slate-100 px-3 py-1 text-small text-ink";

function rupees(value: number): string {
  return `₹${formatRupees(value)}`;
}

function investmentStageLabel(value: string): string {
  return investmentStages.find((stage) => stage.value === value)?.label ?? value;
}

function SelfReportedNote({ subject }: { subject: string }) {
  return (
    <p className="mt-1 text-meta text-muted">
      Self-reported by {subject}. Verified badges appear once a connected source backs a claim.
    </p>
  );
}

function FounderOverview({
  details,
  badges,
}: {
  details: Extract<MatchDetails, { kind: "founder" }>;
  badges: BadgesResponse;
}) {
  const { l1 } = details;
  const stage = founderStages.find((option) => option.value === l1.stage)?.label ?? l1.stage;
  const facts = [
    { id: "l1.sector", label: "Sector", value: l1.sector },
    { id: "l1.stage", label: "Stage", value: stage },
    { id: "l1.ask_amount_inr", label: "Raising", value: rupees(l1.ask_amount_inr) },
    {
      id: "l1.team_size",
      label: "Team",
      value: `${l1.team_size} ${l1.team_size === 1 ? "person" : "people"}`,
    },
    { id: "l1.business_model", label: "Business model", value: l1.business_model },
    { id: "l1.city", label: "City", value: l1.city },
  ];

  return (
    <>
      <section aria-labelledby="startup-heading" className={`${cardStyles} p-6`}>
        <h2 id="startup-heading" className="text-h3">
          {l1.startup_name}
        </h2>
        <p className="mt-2 text-base text-ink">{l1.description}</p>
        <ClaimStatus itemId="l1.description" badges={badges} />
        {details.website ? (
          <a
            href={details.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 break-all text-small font-medium text-emerald-deep hover:underline"
          >
            <GlobeIcon className="h-4 w-4 shrink-0" />
            {details.website.replace(/^https:\/\//, "")}
          </a>
        ) : null}
        {l1.competitors.length > 0 ? (
          <>
            <h3 className={`${labelClass} mt-6`}>Top competitors</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {l1.competitors.map((name) => (
                <li key={name} className={chipClass}>
                  {name}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section aria-labelledby="venture-heading" className={`${cardStyles} p-6`}>
        <h2 id="venture-heading" className="text-h3">
          Venture parameters
        </h2>
        <SelfReportedNote subject="the founder" />
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.id} className="rounded-md bg-slate-50 p-4">
              <dt className={labelClass}>{fact.label}</dt>
              <dd className="mt-2 text-base font-semibold text-ink">
                {fact.value}
                <ClaimStatus itemId={fact.id} badges={badges} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

function InvestorOverview({
  details,
  badges,
}: {
  details: Extract<MatchDetails, { kind: "investor" }>;
  badges: BadgesResponse;
}) {
  const { thesis, prior_investments: deals, cheques_hidden: chequesHidden } = details;
  const chequeRange =
    thesis.cheque_min && thesis.cheque_max
      ? `${rupees(thesis.cheque_min)} – ${rupees(thesis.cheque_max)}`
      : "Not set";
  const columns = chequesHidden
    ? ["Company", "Sector", "Stage", "Year"]
    : ["Company", "Sector", "Stage", "Cheque", "Year"];

  return (
    <>
      <section aria-labelledby="thesis-heading" className={`${cardStyles} p-6`}>
        <h2 id="thesis-heading" className="text-h3">
          Investment thesis
        </h2>
        <SelfReportedNote subject="the investor" />
        <ClaimStatus itemId="thesis" badges={badges} />
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className={labelClass}>Sectors</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {thesis.sectors.map((sector) => (
                <span
                  key={sector}
                  className="rounded-full bg-emerald/10 px-3 py-1 text-small text-emerald-deep"
                >
                  {sector}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Stages</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {thesis.stages.map((stage) => (
                <span key={stage} className={`${chipClass} font-medium`}>
                  {investmentStageLabel(stage)}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Cheque range</dt>
            <dd className="mt-2 flex items-center gap-2 font-heading text-h3 text-ink">
              <BanknoteIcon className="h-5 w-5 text-muted" />
              {chequeRange}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Geographies</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {thesis.geographies.map((geography) => (
                <span key={geography} className={chipClass}>
                  {geographies.find((option) => option.value === geography)?.label ?? geography}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="deals-heading" className={`${cardStyles} p-6`}>
        <h2 id="deals-heading" className="flex items-center gap-2 text-h3">
          Prior investments
          <span className="rounded-full bg-slate-100 px-2 font-mono text-meta font-normal text-ink">
            {deals.length}
          </span>
        </h2>
        <SelfReportedNote subject="the investor" />
        <ClaimStatus itemId="prior_investments" badges={badges} />
        {deals.length === 0 ? (
          <p className="mt-4 text-small text-muted">No prior investments listed yet.</p>
        ) : (
          <>
            {chequesHidden ? (
              <p className="mt-2 text-meta text-muted">Cheque amounts are kept private.</p>
            ) : null}
            <div className="mt-4 overflow-x-auto rounded-md border border-line">
              <table className="min-w-full text-left text-small">
                <thead className="bg-slate-50">
                  <tr>
                    {columns.map((heading) => (
                      <th key={heading} scope="col" className={`${labelClass} px-4 py-3`}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {deals.map((deal, index) => (
                    <tr key={`${deal.company}-${deal.year}-${index}`}>
                      <td className="px-4 py-3 font-medium text-ink">{deal.company}</td>
                      <td className="px-4 py-3 text-ink">{deal.sector}</td>
                      <td className="px-4 py-3 text-ink">{investmentStageLabel(deal.stage)}</td>
                      {chequesHidden ? null : (
                        <td className="px-4 py-3 font-mono text-ink">
                          {deal.cheque ? rupees(deal.cheque) : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-ink">{deal.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function MentorOverview({
  details,
  badges,
}: {
  details: Extract<MatchDetails, { kind: "mentor" }>;
  badges: BadgesResponse;
}) {
  const { expertise } = details;
  const fee = expertise.session_fee
    ? `₹${expertise.session_fee.toLocaleString("en-IN")} / session`
    : "Free";

  return (
    <section aria-labelledby="expertise-heading" className={`${cardStyles} p-6`}>
      <h2 id="expertise-heading" className="text-h3">
        Expertise
      </h2>
      <SelfReportedNote subject="the mentor" />
      <ClaimStatus itemId="expertise" badges={badges} />

      <h3 className={`${labelClass} mt-6`}>Core disciplines</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {expertise.areas.map((area) => (
          <li key={area} className="rounded-full bg-emerald/10 px-3 py-1 text-small text-emerald-deep">
            {area}
          </li>
        ))}
      </ul>

      <h3 className={`${labelClass} mt-6`}>Stage focus</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {expertise.stages.map((stage) => (
          <li key={stage} className={`${chipClass} font-medium`}>
            {investmentStageLabel(stage)}
          </li>
        ))}
      </ul>

      <dl className="mt-6 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3">
          <dt className="flex items-center gap-2 text-small text-ink">
            <ClockIcon className="h-4 w-4 text-muted" />
            Availability
          </dt>
          <dd className="text-right font-mono text-small font-medium text-ink">
            {availabilityLabel(expertise.availability)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3">
          <dt className="flex items-center gap-2 text-small text-ink">
            <BanknoteIcon className="h-4 w-4 text-muted" />
            Session fee
          </dt>
          <dd className="text-right font-mono text-small font-medium text-ink">{fee}</dd>
        </div>
      </dl>
    </section>
  );
}

export function MatchOverview({
  details,
  badges,
}: {
  details: MatchDetails;
  badges: BadgesResponse;
}) {
  if (details.kind === "founder") {
    return <FounderOverview details={details} badges={badges} />;
  }
  if (details.kind === "investor") {
    return <InvestorOverview details={details} badges={badges} />;
  }
  return <MentorOverview details={details} badges={badges} />;
}
