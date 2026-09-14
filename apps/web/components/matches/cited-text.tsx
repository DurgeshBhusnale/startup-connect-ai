import { Fragment } from "react";

import type { Citation, CitationSource } from "@/lib/api-types";

const sourceLabels: Record<CitationSource, string> = {
  founder_profile: "founder’s profile",
  investor_thesis: "investor’s thesis",
  investor_portfolio: "investor’s prior investments",
  mentor_expertise: "mentor’s expertise",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type CitedTextProps = {
  text: string;
  citations: Citation[];
  idPrefix: string;
};

// Values quoted from either profile get a hover/focus tooltip naming their source (M8 AC5).
export function CitedText({ text, citations, idPrefix }: CitedTextProps) {
  const usable = citations
    .filter((citation) => citation.value.trim().length > 1)
    .sort((a, b) => b.value.length - a.value.length);
  if (usable.length === 0) {
    return <>{text}</>;
  }

  const bySource = new Map(usable.map((citation) => [citation.value.toLowerCase(), citation]));
  const pattern = new RegExp(`(${usable.map((c) => escapeRegExp(c.value)).join("|")})`, "gi");

  return (
    <>
      {text.split(pattern).map((part, index) => {
        const citation = index % 2 === 1 ? bySource.get(part.toLowerCase()) : undefined;
        if (!citation) {
          return <Fragment key={index}>{part}</Fragment>;
        }
        const tooltipId = `${idPrefix}-${index}`;
        return (
          <span
            key={index}
            tabIndex={0}
            aria-describedby={tooltipId}
            className="group relative cursor-help rounded font-medium underline decoration-muted decoration-dotted underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald/30"
          >
            {part}
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-1 whitespace-nowrap rounded bg-ink px-2 py-1 text-meta font-normal text-white group-hover:visible group-focus:visible"
            >
              From {citation.sources.map((source) => sourceLabels[source]).join(" and ")}
            </span>
          </span>
        );
      })}
    </>
  );
}
