import { ComingSoon } from "@/components/app-shell/coming-soon";
import { SparklesIcon } from "@/components/icons";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Matches" };

export default function MatchesPage() {
  return (
    <ComingSoon
      title="Matches"
      body="Your ranked matches, each with a plain-language reason, will appear here."
      icon={<SparklesIcon className="h-8 w-8" />}
    />
  );
}
