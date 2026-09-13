import Link from "next/link";

import { CircleCheckIcon } from "@/components/icons";
import { buttonStyles, cardStyles, eyebrowStyles } from "@/lib/ui";

function CheckList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-small text-ink">
          <CircleCheckIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Audiences() {
  return (
    <section className="border-t border-line bg-slate-50">
      <div className="mx-auto grid max-w-content gap-6 px-4 py-16 md:grid-cols-2 md:px-6">
        <article id="for-founders" className={`${cardStyles} flex scroll-mt-24 flex-col p-6 md:p-8`}>
          <p className={eyebrowStyles}>For founders</p>
          <h2 className="mt-2 text-h3 md:text-h2">
            Stop sending cold DMs that vanish into the void.
          </h2>
          <p className="mt-3 text-small text-muted">
            Every pitch deck you upload is distilled into structured signals. Skip generic inboxes
            and match only with angels and VCs whose active mandate covers your sector and cheque
            size.
          </p>
          <CheckList
            items={[
              "Automatic 1-page synthetic teaser generation",
              "Zero deck forwarding without explicit authorization",
              "Direct calendar integration with verified lead angels",
            ]}
          />
          <div className="mt-auto pt-8">
            <Link href="/sign-up" className={buttonStyles.primary}>
              Create founder profile
            </Link>
          </div>
        </article>

        <article id="for-investors" className={`${cardStyles} flex scroll-mt-24 flex-col p-6 md:p-8`}>
          <p id="for-mentors" className={`${eyebrowStyles} scroll-mt-24`}>
            For investors &amp; mentors
          </p>
          <h2 className="mt-2 text-h3 md:text-h2">
            Zero noise. Only verified founders within your strike zone.
          </h2>
          <p className="mt-3 text-small text-muted">
            Fine-tune your thesis: sectors, stages, cheque range, and geographies. Founders are
            checked against it before they ever reach your queue.
          </p>
          <CheckList
            items={[
              "Pre-parsed financial metrics & cap table verification",
              "Weekly digest of top >85% compatibility deals",
              "Mentor ledger for tracking equity-for-advisory agreements",
            ]}
          />
          <div className="mt-auto pt-8">
            <Link href="/sign-up" className={buttonStyles.secondary}>
              Join as an investor or mentor
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
