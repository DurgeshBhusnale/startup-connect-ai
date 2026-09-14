import Link from "next/link";

import { ShieldCheckIcon } from "@/components/icons";
import { cardStyles } from "@/lib/ui";

import type { GivenEndorsement } from "@/lib/api-types";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

// S8 AC3: an investor's or mentor's own profile lists the claims they've vouched for.
export function EndorsementsGiven({ items }: { items: GivenEndorsement[] | null }) {
  return (
    <section aria-labelledby="endorsements-given-heading" className={`${cardStyles} p-6`}>
      <h2 id="endorsements-given-heading" className="flex items-center gap-2 text-h3">
        <ShieldCheckIcon className="h-6 w-6 text-emerald-deep" />
        Endorsements given
        {items && items.length > 0 ? (
          <span className="rounded-full bg-slate-100 px-2 font-mono text-meta font-normal text-ink">
            {items.length}
          </span>
        ) : null}
      </h2>
      <p className="mt-1 text-small text-muted">Claims you’ve vouched for on founders’ profiles.</p>

      {items === null ? (
        <p className="mt-4 text-small text-ink">Couldn’t load your endorsements. Refresh to try again.</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-small text-muted">
          You haven’t endorsed any claims yet. Once you’re a mutual match with a founder, you can
          endorse details you’ve seen first-hand.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.map((item) => (
            <li
              key={item.endorsement_id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-small font-medium text-ink">{item.founder_name}</p>
                <p className="mt-1 break-words text-small text-muted">
                  <span className="font-mono text-meta uppercase tracking-wider">{item.item_label}</span>
                  {item.claim ? ` · ${item.claim}` : ""}
                </p>
                <p className="mt-1 font-mono text-meta text-muted">
                  Endorsed {dateFormat.format(new Date(item.created_at))}
                </p>
              </div>
              {item.match_id ? (
                <Link
                  href={`/matches/${item.match_id}${item.item_id.startsWith("post:") ? "?tab=activity" : ""}`}
                  className="shrink-0 rounded-md text-small font-medium text-emerald-deep hover:underline"
                >
                  View profile
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
