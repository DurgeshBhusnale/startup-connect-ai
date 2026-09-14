import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SparklesIcon } from "@/components/icons";
import { MatchCard } from "@/components/matches/match-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Greeting } from "@/components/ui/greeting";
import { getFounderProfileState } from "@/lib/founder-profile-api";
import { getInvestorProfileState } from "@/lib/investor-profile-api";
import { getMatches } from "@/lib/matches-api";
import { getMe } from "@/lib/me";
import { getMentorProfileState } from "@/lib/mentor-profile-api";
import { buttonStyles, cardStyles } from "@/lib/ui";

import { dismissPriorInvestmentsBanner } from "./actions";

import type { AppRole, MatchItem } from "@/lib/api-types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

type HomeContent = {
  subtitle: string;
  title: string;
  body: string;
  action?: { href: string; label: string };
  profileCompleted: boolean;
  showPriorInvestmentsBanner: boolean;
};

async function loadHomeContent(role: AppRole): Promise<HomeContent> {
  if (role === "founder") {
    const state = await getFounderProfileState();
    const subtitle = "Your fundraising workspace — matches, intros, and messages will live here.";
    if (state?.completed) {
      return {
        subtitle,
        title: "No matches yet",
        body: "Try posting an update or broadening your criteria.",
        action: { href: "/profile", label: "Review your profile" },
        profileCompleted: true,
        showPriorInvestmentsBanner: false,
      };
    }
    return {
      subtitle,
      title: "Build your founder profile",
      body: "Upload your pitch deck and we’ll fill in the rest — it takes about a minute.",
      action: { href: "/onboarding/founder", label: "Set up your profile" },
      profileCompleted: false,
      showPriorInvestmentsBanner: false,
    };
  }

  if (role === "investor") {
    const state = await getInvestorProfileState();
    const subtitle = "Your deal-flow workspace — pre-filtered founders will land here.";
    if (state?.completed) {
      return {
        subtitle,
        title: "No matches yet",
        body: "Founders who fit your thesis will appear here. Broadening your criteria can help.",
        action: { href: "/onboarding/investor", label: "Edit thesis" },
        profileCompleted: true,
        showPriorInvestmentsBanner:
          state.prior_investments_status === "skipped" && !state.banner_dismissed,
      };
    }
    return {
      subtitle,
      title: "Set up your investment thesis",
      body: "Tell us what you invest in so we only send founders who fit.",
      action: state?.thesis
        ? { href: "/onboarding/investor/prior-investments", label: "Finish setup" }
        : { href: "/onboarding/investor", label: "Set up your thesis" },
      profileCompleted: false,
      showPriorInvestmentsBanner: false,
    };
  }

  const state = await getMentorProfileState();
  const subtitle = "Your mentoring workspace — founders who need your expertise will land here.";
  if (state?.completed) {
    return {
      subtitle,
      title: "No matches yet",
      body: "Founders at the stages you mentor will appear here. Broadening your criteria can help.",
      action: { href: "/profile", label: "View your profile" },
      profileCompleted: true,
      showPriorInvestmentsBanner: false,
    };
  }
  return {
    subtitle,
    title: "Set up your mentor profile",
    body: "Tell us where you can help so we only match you with founders who need it.",
    action: { href: "/onboarding/mentor", label: "Set up your profile" },
    profileCompleted: false,
    showPriorInvestmentsBanner: false,
  };
}

function TopMatches({ matches }: { matches: MatchItem[] }) {
  return (
    <section aria-labelledby="top-matches-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="top-matches-heading" className="font-heading text-h3 text-ink">
          Your top matches
        </h2>
        <Link href="/matches" className="text-small font-medium text-emerald-deep hover:underline">
          View all matches
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {matches.map((match) => (
          <li key={match.match_id}>
            <MatchCard match={match} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function HomePage() {
  const [me, user] = await Promise.all([getMe(), currentUser()]);
  if (!me.role) {
    redirect("/onboarding");
  }
  const content = await loadHomeContent(me.role);
  const matches = content.profileCompleted ? await getMatches(3) : null;
  const topMatches = matches?.status === "ok" ? matches.matches : [];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <div className="flex flex-col gap-2 border-b border-line pb-6">
        <Greeting firstName={user?.firstName ?? null} />
        <p className="text-small text-muted">{content.subtitle}</p>
      </div>

      {content.showPriorInvestmentsBanner ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-2 text-small text-ink">
            <SparklesIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
            Add your prior investments to get better matches.
          </p>
          <div className="flex items-center gap-2">
            <Link href="/onboarding/investor/prior-investments" className={buttonStyles.secondary}>
              Add investments
            </Link>
            <form action={dismissPriorInvestmentsBanner}>
              <button type="submit" className={buttonStyles.ghost}>
                Dismiss
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {topMatches.length > 0 ? (
        <TopMatches matches={topMatches} />
      ) : (
        <section className={`${cardStyles} p-6`}>
          <EmptyState
            icon={<SparklesIcon className="h-8 w-8" />}
            title={matches?.status === "unavailable" ? "Finding matches for you…" : content.title}
            body={matches?.status === "unavailable" ? "Check back in a few minutes." : content.body}
            action={content.action}
          />
        </section>
      )}
    </div>
  );
}
