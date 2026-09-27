import { RoleLanding } from "@/components/landing/role-landing";
import { investorLandingContent } from "@/components/landing/role-landing-content";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For investors",
  description:
    "Set your sectors, stages, cheque range and geographies once. Startup Connect AI scores early-stage Indian founders against your thesis and explains every match.",
};

export default function ForInvestorsPage() {
  return <RoleLanding content={investorLandingContent} />;
}
