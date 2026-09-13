import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ComingSoon } from "@/components/app-shell/coming-soon";
import { UserIcon } from "@/components/icons";
import { MentorProfileView } from "@/components/profile/mentor-profile-view";
import { getMe } from "@/lib/me";
import { getMentorProfileState } from "@/lib/mentor-profile-api";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const me = await getMe();
  // Founder (S-10) and investor (S-11) profiles ship with M6.
  if (me.role !== "mentor") {
    return (
      <ComingSoon
        title="My Profile"
        body="Build and edit your profile here — it’s what powers every match."
        icon={<UserIcon className="h-8 w-8" />}
      />
    );
  }

  const [state, user] = await Promise.all([getMentorProfileState(), currentUser()]);
  if (!state) {
    redirect("/onboarding");
  }
  if (!state.expertise) {
    redirect("/onboarding/mentor");
  }
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Your profile";

  return (
    <MentorProfileView
      displayName={displayName}
      expertise={state.expertise}
      verification={state.verification}
    />
  );
}
