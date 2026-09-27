import { RoleLanding } from "@/components/landing/role-landing";
import { mentorLandingContent } from "@/components/landing/role-landing-content";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For mentors",
  description:
    "Pick your expertise areas, the stages you support and your availability. Startup Connect AI matches founders whose current ask fits what you know — and explains why.",
};

export default function ForMentorsPage() {
  return <RoleLanding content={mentorLandingContent} />;
}
