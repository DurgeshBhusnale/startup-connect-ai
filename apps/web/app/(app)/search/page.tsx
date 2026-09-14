import { redirect } from "next/navigation";

import { SearchPanel } from "@/components/search/search-panel";
import { getMe } from "@/lib/me";
import { cardStyles, eyebrowStyles } from "@/lib/ui";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Search" };

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

// Full-page S-21 for mobile and direct links; desktop also opens it as a Cmd/Ctrl-K modal.
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const [{ q }, me] = await Promise.all([searchParams, getMe()]);
  if (!me.role) {
    redirect("/onboarding");
  }
  const initialQuery = typeof q === "string" ? q.trim().slice(0, 200) : "";

  return (
    <div className="mx-auto flex max-w-onboarding-wide flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className={eyebrowStyles}>Search</p>
        <h1 className="font-heading text-h1 text-ink">Find the right people</h1>
        <p className="text-small text-muted">
          Ask in plain language. Each result shows why it fits, and full profiles unlock once
          you’re matched.
        </p>
      </header>
      <section className={`${cardStyles} overflow-hidden`}>
        <SearchPanel role={me.role} variant="page" initialQuery={initialQuery} />
      </section>
    </div>
  );
}
