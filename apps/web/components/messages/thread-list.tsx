"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { MessageSquareIcon, SearchIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { initialsOf } from "@/lib/feedback";
import { threadTimeLabel } from "@/lib/messages";
import { roleLabels } from "@/lib/roles";

import { useRealtime } from "./realtime-provider";

import type { ThreadItem } from "@/lib/api-types";

type Filter = "all" | "unread";

type ThreadListProps = {
  threads: ThreadItem[];
  activeMatchId: string | null;
};

const segment = "rounded px-3 py-2 text-small font-medium transition";

export function ThreadList({ threads: initialThreads, activeMatchId }: ThreadListProps) {
  const searchId = useId();
  const { subscribe } = useRealtime();
  const [threads, setThreads] = useState(initialThreads);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  // Server data wins whenever the page refreshes.
  useEffect(() => {
    setThreads(
      initialThreads.map((thread) =>
        thread.match_id === activeMatchId ? { ...thread, unread_count: 0 } : thread,
      ),
    );
  }, [initialThreads, activeMatchId]);

  useEffect(
    () =>
      subscribe((event) => {
        if (event.type !== "message.created") return false;
        setThreads((current) => {
          const index = current.findIndex((thread) => thread.match_id === event.match_id);
          const thread = current[index];
          if (!thread) return current;
          const counts = !event.message.sender_is_me && event.match_id !== activeMatchId;
          const updated: ThreadItem = {
            ...thread,
            last_message: {
              body: event.message.body,
              created_at: event.message.created_at,
              sender_is_me: event.message.sender_is_me,
            },
            last_activity_at: event.message.created_at,
            unread_count: counts ? thread.unread_count + 1 : thread.unread_count,
          };
          return [updated, ...current.filter((_, position) => position !== index)];
        });
        return false;
      }),
    [subscribe, activeMatchId],
  );

  const unreadThreads = threads.filter((thread) => thread.unread_count > 0).length;
  const needle = query.trim().toLowerCase();
  const visible = threads.filter(
    (thread) =>
      (filter === "all" || thread.unread_count > 0) &&
      (!needle ||
        thread.partner.display_name.toLowerCase().includes(needle) ||
        thread.partner.headline.toLowerCase().includes(needle)),
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-h2 text-ink">Messages</h1>
          {unreadThreads > 0 ? (
            <span className="rounded-full bg-emerald-bright/15 px-3 py-1 font-mono text-meta text-emerald-deep">
              {unreadThreads} unread
            </span>
          ) : null}
        </div>
        {threads.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
              {(["all", "unread"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={filter === option}
                  onClick={() => setFilter(option)}
                  className={`${segment} ${
                    filter === option ? "bg-ink text-white" : "text-ink hover:bg-white"
                  }`}
                >
                  {option === "all" ? `All ${threads.length}` : `Unread ${unreadThreads}`}
                </button>
              ))}
            </div>
            <div className="relative">
              <label htmlFor={searchId} className="sr-only">
                Search conversations
              </label>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or company"
                className="w-full rounded-md border border-muted py-2 pl-8 pr-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-emerald/30"
              />
            </div>
          </>
        ) : null}
      </div>

      {threads.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<MessageSquareIcon className="h-8 w-8" />}
            title="No conversations yet"
            body="A conversation opens when an intro is accepted and you’re a mutual match."
            action={{ href: "/matches", label: "Go to matches" }}
          />
        </div>
      ) : visible.length === 0 ? (
        <p className="p-6 text-small text-muted">
          {filter === "unread" && !needle ? "You’re all caught up." : "No conversations match."}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {visible.map((thread) => {
            const active = thread.match_id === activeMatchId;
            const unread = thread.unread_count > 0;
            const name = thread.partner.display_name;
            const last = thread.last_message;
            return (
              <li key={thread.match_id}>
                <Link
                  href={`/messages/${thread.match_id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex gap-3 border-l-4 p-4 transition ${
                    active ? "border-emerald-deep bg-slate-50" : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-small font-semibold text-white"
                  >
                    {initialsOf(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-base text-ink ${unread ? "font-semibold" : "font-medium"}`}
                      >
                        {name}
                      </span>
                      <time
                        dateTime={thread.last_activity_at}
                        suppressHydrationWarning
                        className={`shrink-0 font-mono text-meta ${unread ? "text-emerald-deep" : "text-muted"}`}
                      >
                        {threadTimeLabel(thread.last_activity_at)}
                      </time>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 font-mono text-meta uppercase tracking-wider text-ink">
                        {roleLabels[thread.partner.kind]}
                      </span>
                      <span className="rounded bg-emerald-bright/15 px-2 font-mono text-meta text-emerald-deep">
                        {Math.round(thread.fit_score * 100)}% match
                      </span>
                      {thread.can_send ? null : (
                        <span className="rounded border border-line px-2 font-mono text-meta text-muted">
                          Read-only
                        </span>
                      )}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-small ${
                          unread ? "font-medium text-ink" : "text-muted"
                        }`}
                      >
                        {last
                          ? `${last.sender_is_me ? "You: " : ""}${last.body}`
                          : "No messages yet. Say hello."}
                      </span>
                      {unread ? (
                        <>
                          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-deep" />
                          <span className="sr-only">{thread.unread_count} unread</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
