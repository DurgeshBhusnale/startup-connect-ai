import Link from "next/link";

import { FlagIcon, PlusIcon } from "@/components/icons";
import { eyebrowStyles } from "@/lib/ui";

type AskPinBannerProps = {
  text: string | null;
  /** Shown on the founder's own profile: an Edit link, or an invitation when no ask is pinned. */
  editHref?: string;
};

const linkClass = "shrink-0 rounded-md text-small font-medium text-emerald-deep hover:underline";

// S9: the pinned ask sits above everything else on a founder's profile.
export function AskPinBanner({ text, editHref }: AskPinBannerProps) {
  if (!text) {
    if (!editHref) return null;
    return (
      <Link
        href={editHref}
        className="flex items-center gap-3 rounded-lg border border-dashed border-muted bg-white p-4 text-left hover:bg-slate-50"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-ink"
        >
          <PlusIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-small font-medium text-ink">Pin what you’re asking for</span>
          <span className="block text-meta text-muted">
            One line at the top of your profile, like an intro, a hire, or advice you need.
          </span>
        </span>
      </Link>
    );
  }

  return (
    <section
      aria-label="Currently asking for"
      className="flex items-start gap-3 rounded-lg border border-emerald/30 bg-emerald/10 p-4 sm:items-center sm:gap-4"
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-emerald-deep"
      >
        <FlagIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={eyebrowStyles}>Currently asking for</p>
        <p className="mt-1 break-words text-base font-medium text-ink">{text}</p>
      </div>
      {editHref ? (
        <Link href={editHref} className={linkClass}>
          Edit
        </Link>
      ) : null}
    </section>
  );
}
