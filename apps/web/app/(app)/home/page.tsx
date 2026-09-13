import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SparklesIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { Greeting } from "@/components/ui/greeting";
import { getFounderProfileState } from "@/lib/founder-profile-api";
import { getInvestorProfileState } from "@/lib/investor-profile-api";
import { getMe } from "@/lib/me";
import { getMentorProfileState } from "@/lib/mentor-profile-api";
import { buttonStyles, cardStyles } from "@/lib/ui";

import { dismissPriorInvestmentsBanner } from "./actions";

import type { AppRole } from "@/lib/api-types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

type HomeContent = {
  subtitle: string;
  title: string;
  body: string;
  action?: { href: string; label: string };
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
        body: "Matches will appear here as investors and mentors sign up.",
        showPriorInvestmentsBanner: false,
      };
    }
    return {
      subtitle,
      title: "Build your founder profile",
      body: "Upload your pitch deck and we’ll fill in the rest — it takes about a minute.",
      action: { href: "/onboarding/founder", label: "Set up your profile" },
      showPriorInvestmentsBanner: false,
    };
  }

  if (role === "investor") {
    const state = await getInvestorProfileState();
    const subtitle = "Your deal-flow workspace — pre-filtered founders will land here.";
    if (state?.completed) {
      return {
        subtitle,
        title: "You’re set",
        body: "New founder matches will appear here as they sign up.",
        action: { href: "/onboarding/investor", label: "Edit thesis" },
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
      showPriorInvestmentsBanner: false,
    };
  }

  const state = await getMentorProfileState();
  const subtitle = "Your mentoring workspace — founders who need your expertise will land here.";
  if (state?.completed) {
    return {
      subtitle,
      title: "You’re on the list",
      body: "Matched founders will appear here as they seek mentorship in your expertise areas.",
      action: { href: "/profile", label: "View your profile" },
      showPriorInvestmentsBanner: false,
    };
  }
  return {
    subtitle,
    title: "Set up your mentor profile",
    body: "Tell us where you can help so we only match you with founders who need it.",
    action: { href: "/onboarding/mentor", label: "Set up your profile" },
    showPriorInvestmentsBanner: false,
  };
}

export default async function HomePage() {
  const [me, user] = await Promise.all([getMe(), currentUser()]);
  if (!me.role) {
    redirect("/onboarding");
  }
  const content = await loadHomeContent(me.role);

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

      <section className={`${cardStyles} p-6`}>
        <EmptyState
          icon={<SparklesIcon className="h-8 w-8" />}
          title={content.title}
          body={content.body}
          action={content.action}
        />
      </section>
    </div>
  );
}
