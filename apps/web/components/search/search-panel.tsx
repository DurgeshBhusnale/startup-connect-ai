"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  clearRecentSearches,
  getRecentSearches,
  requestMatch,
  runSearch,
} from "@/app/(app)/search/actions";
import {
  ArrowRightIcon,
  ClockIcon,
  LightbulbIcon,
  LockIcon,
  SearchIcon,
  SparklesIcon,
} from "@/components/icons";
import { initialsOf } from "@/lib/feedback";
import { roleLabels } from "@/lib/roles";
import { SEARCH_QUERY_MAX, SEARCH_QUERY_MIN, searchExamples } from "@/lib/search";
import { buttonStyles } from "@/lib/ui";

import type { AppRole, RecentSearch, SearchResponse, SearchResult } from "@/lib/api-types";
import type { KeyboardEvent } from "react";

type SearchPanelProps = {
  role: AppRole;
  /** "dialog" is the Cmd/Ctrl-K modal; "page" is the full /search page (and mobile). */
  variant: "dialog" | "page";
  initialQuery?: string;
  /** Called before navigating away, so the dialog can close. */
  onNavigate?: () => void;
};

type Option =
  | { key: string; kind: "example" | "recent"; query: string }
  | { key: string; kind: "result"; result: SearchResult };

type Status = "idle" | "loading" | "done" | "error";

const kbdClass =
  "rounded border border-line bg-white px-1 font-mono text-meta text-muted";

function ResultRow({
  result,
  id,
  active,
  pending,
  onChoose,
}: {
  result: SearchResult;
  id: string;
  active: boolean;
  pending: boolean;
  onChoose: () => void;
}) {
  const matched = result.connect === "view";
  const action = matched ? (
    <span className="inline-flex items-center gap-1 text-emerald-deep">
      View profile
      <ArrowRightIcon className="h-4 w-4" />
    </span>
  ) : result.connect === "request" ? (
    <span className="text-ink">{pending ? "Requesting…" : "Request match"}</span>
  ) : (
    <span
      className="text-muted"
      title="Your sector or stage doesn’t overlap with this profile, so we can’t match you yet."
    >
      No overlap yet
    </span>
  );

  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      aria-disabled={result.connect === "unavailable" || undefined}
      onClick={onChoose}
      className={`flex gap-3 rounded-lg border p-3 transition ${
        active ? "border-emerald-deep bg-emerald/5" : "border-line bg-white hover:bg-slate-50"
      } ${result.connect === "unavailable" ? "cursor-default" : "cursor-pointer"}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
          matched ? "bg-ink text-small font-semibold text-white" : "bg-slate-100 text-muted"
        }`}
      >
        {matched && result.display_name ? (
          initialsOf(result.display_name)
        ) : (
          <LockIcon className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate text-base font-medium text-ink">
            {result.display_name ?? result.headline}
          </span>
          <span className="rounded bg-slate-100 px-2 font-mono text-meta uppercase tracking-wider text-ink">
            {roleLabels[result.kind]}
          </span>
          {result.fit_score !== null ? (
            <span className="rounded bg-emerald-bright/15 px-2 font-mono text-meta text-emerald-deep">
              {Math.round(result.fit_score * 100)}% fit
            </span>
          ) : null}
        </p>
        <p className="mt-1 truncate text-small text-muted">
          {result.display_name ? result.headline : "Name and full profile unlock once you’re matched"}
          {result.location ? ` · ${result.location}` : ""}
        </p>
        <p className="mt-2 text-small text-ink">{result.fit_summary}</p>
        {result.snippet ? (
          <p className="mt-1 line-clamp-2 text-small text-muted">{result.snippet}</p>
        ) : null}
        {result.matched_attributes.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Matched on">
            {result.matched_attributes.map((attribute) => (
              <li
                key={`${attribute.label}-${attribute.value}`}
                title={`From ${attribute.source}`}
                className="rounded bg-emerald/10 px-2 py-1 text-meta text-emerald-deep"
              >
                {attribute.label}: {attribute.value}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-small font-medium sm:hidden">{action}</p>
      </div>
      <span className="hidden shrink-0 self-center text-small font-medium sm:block">{action}</span>
    </li>
  );
}

// S2 / S-21: ask in plain language, see cited results, open or request a match.
export function SearchPanel({ role, variant, initialQuery = "", onNavigate }: SearchPanelProps) {
  const router = useRouter();
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const ranInitial = useRef(false);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [active, setActive] = useState(-1);
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const examples = searchExamples(role);

  useEffect(() => {
    inputRef.current?.focus();
    void getRecentSearches().then((result) => {
      if (result.ok) setRecents(result.data);
    });
  }, []);

  const submit = useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, SEARCH_QUERY_MAX);
    if (text.length < SEARCH_QUERY_MIN) {
      setError(`Type at least ${SEARCH_QUERY_MIN} characters to search.`);
      return;
    }
    setQuery(text);
    setStatus("loading");
    setError(null);
    setActive(-1);
    const result = await runSearch(text, 0);
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setResponse(result.data);
    setStatus("done");
    setRecents((current) =>
      [
        { query: text, searched_at: new Date().toISOString() },
        ...current.filter((item) => item.query.toLowerCase() !== text.toLowerCase()),
      ].slice(0, 5),
    );
  }, []);

  useEffect(() => {
    if (initialQuery && !ranInitial.current) {
      ranInitial.current = true;
      void submit(initialQuery);
    }
  }, [initialQuery, submit]);

  const options: Option[] =
    status === "done" && response
      ? response.items.map((result) => ({ key: result.profile_id, kind: "result" as const, result }))
      : status === "idle"
        ? [
            ...examples.map((item) => ({ key: `example-${item}`, kind: "example" as const, query: item })),
            ...recents.map((item) => ({ key: `recent-${item.query}`, kind: "recent" as const, query: item.query })),
          ]
        : [];
  const optionId = (index: number) => `${listId}-${index}`;

  const openResult = async (result: SearchResult) => {
    if (result.connect === "view" && result.match_id) {
      onNavigate?.();
      router.push(`/matches/${result.match_id}`);
      return;
    }
    if (result.connect !== "request" || pendingProfile) return;
    setPendingProfile(result.profile_id);
    setError(null);
    const outcome = await requestMatch(result.profile_id);
    setPendingProfile(null);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    onNavigate?.();
    router.push(`/matches/${outcome.data.match_id}`);
  };

  const choose = (option: Option) => {
    if (option.kind === "result") {
      void openResult(option.result);
    } else {
      void submit(option.query);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && options.length > 0) {
      event.preventDefault();
      setActive((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp" && options.length > 0) {
      event.preventDefault();
      setActive((index) => (index <= 0 ? options.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[active];
      if (option) {
        choose(option);
      } else {
        void submit(query);
      }
    }
  };

  const loadMore = async () => {
    if (!response || response.next_offset === null) return;
    setLoadingMore(true);
    const result = await runSearch(response.query, response.next_offset);
    setLoadingMore(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResponse({ ...result.data, items: [...response.items, ...result.data.items] });
  };

  const clearRecents = async () => {
    const result = await clearRecentSearches();
    if (result.ok) setRecents([]);
  };

  const exampleCount = status === "idle" ? examples.length : 0;

  return (
    <div className={`flex min-h-0 flex-col ${variant === "dialog" ? "max-h-[80vh]" : ""}`}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(query);
        }}
        className="flex items-center gap-3 border-b border-line px-4 py-3"
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
        <label htmlFor={inputId} className="sr-only">
          Search founders, investors and mentors
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          value={query}
          maxLength={SEARCH_QUERY_MAX}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
            setError(null);
            if (!event.target.value.trim()) {
              setStatus("idle");
              setResponse(null);
            }
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask anything: ‘fintech investors in Pune’, ‘seed-stage AI founders raising ₹50L’…"
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-muted focus:outline-none"
        />
        {variant === "dialog" ? (
          <kbd className="hidden rounded border border-line bg-slate-50 px-2 py-1 font-mono text-meta text-muted sm:inline">
            esc to close
          </kbd>
        ) : (
          <button type="submit" className={`${buttonStyles.primary} shrink-0`}>
            Search
          </button>
        )}
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {error ? (
          <p role="alert" className="mb-3 text-small text-alert-red">
            {error}
          </p>
        ) : null}

        {status === "idle" ? (
          <ul id={listId} role="listbox" aria-label="Suggestions" className="flex flex-col gap-6">
            <li role="presentation">
              <p className="font-mono text-meta uppercase tracking-wider text-muted">
                Try one of these
              </p>
              <ul role="presentation" className="mt-3 grid gap-2 sm:grid-cols-2">
                {examples.map((example, index) => (
                  <li
                    key={example}
                    id={optionId(index)}
                    role="option"
                    aria-selected={active === index}
                    onClick={() => void submit(example)}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-small transition ${
                      active === index
                        ? "border-emerald-deep bg-emerald/5 text-emerald-deep"
                        : "border-line text-ink hover:border-muted"
                    }`}
                  >
                    <SparklesIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
                    {example}
                  </li>
                ))}
              </ul>
            </li>
            {recents.length > 0 ? (
              <li role="presentation" className="border-t border-line pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-meta uppercase tracking-wider text-muted">
                    Recent searches
                  </p>
                  <button
                    type="button"
                    onClick={() => void clearRecents()}
                    className="rounded-md text-meta font-medium text-muted hover:text-ink hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <ul role="presentation" className="mt-2 flex flex-col">
                  {recents.map((item, index) => {
                    const position = exampleCount + index;
                    return (
                      <li
                        key={item.query}
                        id={optionId(position)}
                        role="option"
                        aria-selected={active === position}
                        onClick={() => void submit(item.query)}
                        className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-small ${
                          active === position ? "bg-emerald/5 text-emerald-deep" : "text-ink hover:bg-slate-50"
                        }`}
                      >
                        <ClockIcon className="h-4 w-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate">{item.query}</span>
                        <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted" />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ) : null}
          </ul>
        ) : null}

        {status === "loading" ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <p className="text-small text-muted">Searching profiles…</p>
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex gap-3 rounded-lg border border-line p-3">
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-slate-100" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-4 w-1/2 animate-pulse rounded-md bg-slate-100" />
                  <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {status === "error" ? (
          <button type="button" onClick={() => void submit(query)} className={buttonStyles.secondary}>
            Try again
          </button>
        ) : null}

        {status === "done" && response ? (
          <div className="flex flex-col gap-3">
            {response.interpreted.length > 0 ? (
              <p className="flex flex-wrap items-center gap-2 text-meta text-muted">
                Showing results for
                {response.interpreted.map((chip) => (
                  <span key={chip} className="rounded bg-slate-100 px-2 py-1 text-ink">
                    {chip}
                  </span>
                ))}
              </p>
            ) : null}
            {response.understood_by === "keywords" ? (
              <p className="text-meta text-muted">
                The AI assistant is busy, so this search matched on keywords only.
              </p>
            ) : null}
            {response.items.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-6 text-center">
                <p className="text-base font-medium text-ink">No profiles match</p>
                <p className="mt-1 text-small text-muted">
                  No profiles match — try broadening your query. Examples: ‘sector’, ‘stage’, ‘city’.
                </p>
              </div>
            ) : (
              <>
                <p className="text-meta text-muted" aria-live="polite">
                  {response.total} {response.total === 1 ? "profile" : "profiles"} found
                </p>
                <ul id={listId} role="listbox" aria-label="Search results" className="flex flex-col gap-2">
                  {response.items.map((result, index) => (
                    <ResultRow
                      key={result.profile_id}
                      id={optionId(index)}
                      result={result}
                      active={active === index}
                      pending={pendingProfile === result.profile_id}
                      onChoose={() => void openResult(result)}
                    />
                  ))}
                </ul>
                {response.next_offset !== null ? (
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className={`${buttonStyles.secondary} self-center`}
                  >
                    {loadingMore ? "Loading…" : "Show more results"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-slate-50 px-4 py-2 text-meta text-muted">
        <p className="flex items-center gap-1">
          <LightbulbIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
          Tip: mention a sector, stage, city or cheque size.
        </p>
        {variant === "dialog" ? (
          <p className="hidden items-center gap-2 sm:flex">
            <kbd className={kbdClass}>↑↓</kbd> Navigate <kbd className={kbdClass}>↵</kbd> Select{" "}
            <kbd className={kbdClass}>esc</kbd> Close
          </p>
        ) : null}
      </div>
    </div>
  );
}
