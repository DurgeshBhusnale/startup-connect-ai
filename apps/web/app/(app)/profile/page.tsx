import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PostTimeline } from "@/components/posts/post-timeline";
import { FounderProfileView } from "@/components/profile/founder-profile-view";
import { InvestorProfileView } from "@/components/profile/investor-profile-view";
import { MentorProfileView } from "@/components/profile/mentor-profile-view";
import { RetryButton } from "@/components/ui/retry-button";
import { getProfileBadges } from "@/lib/badges-api";
import { getFounderProfileState } from "@/lib/founder-profile-api";
import { getInvestorProfileState } from "@/lib/investor-profile-api";
import { getMe } from "@/lib/me";
import { getMentorProfileState } from "@/lib/mentor-profile-api";
import { getMyPosts } from "@/lib/posts-api";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Profile" };

type ProfilePageProps = {
  searchParams: Promise<{ tab?: string; cursor?: string; compose?: string }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [{ tab, cursor, compose }, me, user] = await Promise.all([
    searchParams,
    getMe(),
    currentUser(),
  ]);
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Your profile";

  if (me.role === "founder") {
    const state = await getFounderProfileState();
    if (!state) {
      redirect("/onboarding");
    }
    if (!state.completed || !state.l1_data) {
      redirect("/onboarding/founder");
    }
    const showPosts = tab === "posts";
    const [badges, posts] = await Promise.all([
      getProfileBadges(state.profile_id),
      showPosts ? getMyPosts(cursor) : Promise.resolve(null),
    ]);
    return (
      <FounderProfileView
        displayName={displayName}
        l1={state.l1_data}
        bio={state.bio}
        website={state.website}
        badges={badges}
        tab={tab ?? "overview"}
        postsPanel={
          !showPosts ? null : posts ? (
            <PostTimeline
              posts={posts.items}
              nextCursor={posts.next_cursor}
              editable
              basePath="/profile?tab=posts"
              isFirstPage={!cursor}
              autoCompose={compose === "1"}
              emptyTitle="No posts yet"
              emptyBody="Share launches, customer wins, and milestones so matched investors and mentors see your momentum."
            />
          ) : (
            <section className={`${cardStyles} flex flex-col items-start gap-4 p-6`}>
              <p className="text-small text-ink">Couldn’t load your posts right now.</p>
              <RetryButton />
            </section>
          )
        }
      />
    );
  }

  if (me.role === "investor") {
    const state = await getInvestorProfileState();
    if (!state) {
      redirect("/onboarding");
    }
    if (!state.thesis) {
      redirect("/onboarding/investor");
    }
    const badges = await getProfileBadges(state.profile_id);
    return (
      <InvestorProfileView
        displayName={displayName}
        state={state}
        thesis={state.thesis}
        badges={badges}
        tab={tab ?? "overview"}
      />
    );
  }

  if (me.role === "mentor") {
    const state = await getMentorProfileState();
    if (!state) {
      redirect("/onboarding");
    }
    if (!state.expertise) {
      redirect("/onboarding/mentor");
    }
    const badges = await getProfileBadges(state.profile_id);
    return (
      <MentorProfileView
        displayName={displayName}
        expertise={state.expertise}
        verification={state.verification}
        bio={state.bio}
        badges={badges}
      />
    );
  }

  redirect("/onboarding");
}
