import { ComingSoon } from "@/components/app-shell/coming-soon";
import { SearchIcon } from "@/components/icons";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <ComingSoon
      title="Search"
      body="Search founders, investors, and mentors in plain language."
      icon={<SearchIcon className="h-8 w-8" />}
    />
  );
}
