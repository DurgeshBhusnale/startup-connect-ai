import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeftIcon } from "@/components/icons";
import { AboutForm } from "@/components/profile/about-form";
import { getFounderProfileState } from "@/lib/founder-profile-api";
import { getInvestorProfileState } from "@/lib/investor-profile-api";
import { getMe } from "@/lib/me";
import { getMentorProfileState } from "@/lib/mentor-profile-api";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit bio" };

type AboutValues = { bio: string; website: string };

async function loadAboutValues(role: "founder" | "investor" | "mentor"): Promise<AboutValues> {
  if (role === "founder") {
    const state = await getFounderProfileState();
    if (!state?.completed) {
      redirect("/onboarding/founder");
    }
    // A founder's first bio prefills from the AI-extracted startup description.
    return { bio: state.bio ?? state.l1_data?.description ?? "", website: state.website ?? "" };
  }
  const state =
    role === "investor" ? await getInvestorProfileState() : await getMentorProfileState();
  if (!state) {
    redirect("/onboarding");
  }
  return { bio: state.bio ?? "", website: "" };
}

export default async function AboutPage() {
  const me = await getMe();
  if (!me.role) {
    redirect("/onboarding");
  }
  const values = await loadAboutValues(me.role);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-md text-small font-medium text-emerald-deep hover:underline"
        >
          <ArrowLeftIcon />
          Back to profile
        </Link>
        <h1 className="mt-4">{me.role === "founder" ? "Bio & website" : "Bio"}</h1>
        <p className="mt-2 text-small text-muted">
          A short bio helps people you’re matched with understand who you are.
        </p>
      </div>
      <section className={`${cardStyles} p-6`}>
        <AboutForm role={me.role} bio={values.bio} website={values.website} />
      </section>
    </div>
  );
}
