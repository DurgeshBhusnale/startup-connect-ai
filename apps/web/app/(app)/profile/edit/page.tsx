import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeftIcon } from "@/components/icons";
import { ProfileReviewForm } from "@/components/onboarding/profile-review-form";
import { AskPinForm } from "@/components/profile/ask-pin-form";
import { l1ToFormValues } from "@/lib/founder-profile";
import { getFounderProfileState } from "@/lib/founder-profile-api";
import { getMe } from "@/lib/me";
import { cardStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const me = await getMe();
  if (me.role === "investor") {
    redirect("/onboarding/investor");
  }
  if (me.role === "mentor") {
    redirect("/onboarding/mentor");
  }

  const state = await getFounderProfileState();
  if (!state) {
    redirect("/onboarding");
  }
  if (!state.completed || !state.l1_data) {
    redirect("/onboarding/founder");
  }

  return (
    <div className="mx-auto flex max-w-onboarding-wide flex-col gap-6">
      <div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-md text-small font-medium text-emerald-deep hover:underline"
        >
          <ArrowLeftIcon />
          Back to profile
        </Link>
        <h1 className="mt-4">Edit your startup profile</h1>
        <p className="mt-2 text-small text-muted">
          These details decide which investors and mentors you’re matched with.
        </p>
      </div>
      <section
        id="ask-pin"
        aria-labelledby="ask-pin-heading"
        className={`${cardStyles} scroll-mt-24 p-6 sm:p-8`}
      >
        <h2 id="ask-pin-heading" className="text-h3">
          Your ask
        </h2>
        <p className="mt-1 text-small text-muted">
          Pin the one thing you need most right now so investors and mentors see it first.
        </p>
        <div className="mt-4">
          <AskPinForm initialText={state.ask_pin} />
        </div>
      </section>
      <section className={`${cardStyles} p-6 sm:p-8`}>
        <ProfileReviewForm
          mode="edit"
          draft={null}
          confidence={{}}
          linkedinUrl={state.l1_data.linkedin_url}
          initialValues={l1ToFormValues(state.l1_data)}
        />
      </section>
    </div>
  );
}
