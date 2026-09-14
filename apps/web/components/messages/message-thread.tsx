"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { loadMessages, markThreadRead, sendMessage } from "@/app/(app)/messages/actions";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CircleUserIcon,
  LockIcon,
} from "@/components/icons";
import { firstNameOf, initialsOf } from "@/lib/feedback";
import { MESSAGE_MAX, MESSAGES_PAGE_SIZE, dayKey, dayLabel, messageTime } from "@/lib/messages";
import { buttonStyles } from "@/lib/ui";

import { useRealtime } from "./realtime-provider";

import type { MessageItem, ThreadItem } from "@/lib/api-types";
import type { KeyboardEvent } from "react";

type LocalMessage = MessageItem & { status: "sent" | "sending" | "failed" };

type MessageThreadProps = {
  thread: ThreadItem;
  initialMessages: MessageItem[];
  hasMore: boolean;
  /** "page" shows the conversation header; "embedded" sits inside Match Detail's Messages tab. */
  variant: "page" | "embedded";
};

const POLL_MS = 10_000;
const COUNTER_FROM = 1800;
const READ_DELAY_MS = 400;
const MAX_INPUT_PX = 160;

function byTime(a: LocalMessage, b: LocalMessage): number {
  return Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id);
}

function merge(current: LocalMessage[], incoming: MessageItem[]): LocalMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    // A confirmed message replaces its optimistic copy, matched by client_ref.
    if (message.client_ref) {
      for (const [id, local] of byId) {
        if (local.status !== "sent" && local.client_ref === message.client_ref) byId.delete(id);
      }
    }
    const existing = byId.get(message.id);
    byId.set(message.id, {
      ...message,
      read_at: message.read_at ?? existing?.read_at ?? null,
      status: "sent",
    });
  }
  return [...byId.values()].sort(byTime);
}

export function MessageThread({
  thread,
  initialMessages,
  hasMore: initialHasMore,
  variant,
}: MessageThreadProps) {
  const router = useRouter();
  const inputId = useId();
  const counterId = useId();
  const { status: socketStatus, subscribe } = useRealtime();
  const [messages, setMessages] = useState<LocalMessage[]>(() => merge([], initialMessages));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const restoreFrom = useRef<number | null>(null);
  const readTimer = useRef<number | null>(null);

  const matchId = thread.match_id;
  const name = thread.partner.display_name;
  const first = firstNameOf(name);

  // S6 AC3: incoming messages are marked read while the thread is on screen.
  const scheduleRead = useCallback(() => {
    if (readTimer.current !== null) return;
    readTimer.current = window.setTimeout(async () => {
      readTimer.current = null;
      if (document.visibilityState !== "visible") return;
      const result = await markThreadRead(matchId);
      if (result.ok && result.data.marked > 0) router.refresh();
    }, READ_DELAY_MS);
  }, [matchId, router]);

  useEffect(() => {
    scheduleRead();
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (readTimer.current !== null) window.clearTimeout(readTimer.current);
      readTimer.current = null;
    };
  }, [scheduleRead]);

  useEffect(
    () =>
      subscribe((event) => {
        if (!("match_id" in event) || event.match_id !== matchId) return false;
        if (event.type === "message.created") {
          setMessages((current) => merge(current, [event.message]));
          if (event.message.sender_is_me) return true;
          scheduleRead();
          return document.visibilityState === "visible";
        }
        if (event.type === "message.read") {
          const readAt = Date.parse(event.read_at);
          setMessages((current) =>
            current.map((message) =>
              message.sender_is_me &&
              message.status === "sent" &&
              !message.read_at &&
              Date.parse(message.created_at) <= readAt
                ? { ...message, read_at: event.read_at }
                : message,
            ),
          );
          return true;
        }
        return false;
      }),
    [subscribe, matchId, scheduleRead],
  );

  // Catch up after (re)connecting; poll every 10 seconds while the socket is down.
  useEffect(() => {
    const sync = async () => {
      if (document.visibilityState !== "visible") return;
      const result = await loadMessages(matchId, null);
      if (!result.ok) return;
      setMessages((current) => merge(current, result.data));
      if (result.data.some((message) => !message.sender_is_me && !message.read_at)) scheduleRead();
    };
    if (socketStatus === "open") {
      void sync();
      return;
    }
    if (socketStatus === "connecting") return;
    const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [socketStatus, matchId, scheduleRead]);

  const lastId = messages.at(-1)?.id;
  const firstId = messages[0]?.id;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (restoreFrom.current !== null) {
      list.scrollTop = list.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (nearBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [lastId, firstId]);

  const onScroll = () => {
    const list = listRef.current;
    if (list) nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  };

  const loadOlder = async () => {
    const oldest = messages.find((message) => message.status === "sent");
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const result = await loadMessages(matchId, oldest.created_at);
    setLoadingOlder(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const list = listRef.current;
    restoreFrom.current = list ? list.scrollHeight - list.scrollTop : null;
    nearBottom.current = false;
    setMessages((current) => merge(current, result.data));
    setHasMore(result.data.length === MESSAGES_PAGE_SIZE);
  };

  const deliver = async (local: LocalMessage) => {
    const result = await sendMessage(matchId, local.body, local.client_ref ?? "");
    if (!result.ok) {
      setMessages((current) =>
        current.map((message) => (message.id === local.id ? { ...message, status: "failed" } : message)),
      );
      setError(result.error);
      return;
    }
    setMessages((current) => merge(current, [result.data]));
  };

  const text = draft.trim();
  const tooLong = text.length > MESSAGE_MAX;

  const resizeInput = () => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_PX)}px`;
  };

  const send = () => {
    if (!text || tooLong || !thread.can_send) return;
    const clientRef = crypto.randomUUID();
    const local: LocalMessage = {
      id: `local-${clientRef}`,
      sender_id: "",
      body: text,
      created_at: new Date().toISOString(),
      sender_is_me: true,
      read_at: null,
      client_ref: clientRef,
      status: "sending",
    };
    nearBottom.current = true;
    setError(null);
    setDraft("");
    window.requestAnimationFrame(resizeInput);
    setMessages((current) => [...current, local]);
    void deliver(local);
  };

  const retry = (message: LocalMessage) => {
    setError(null);
    setMessages((current) =>
      current.map((item) => (item.id === message.id ? { ...item, status: "sending" } : item)),
    );
    void deliver(message);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const lastOwnSentId = [...messages]
    .reverse()
    .find((message) => message.sender_is_me && message.status === "sent")?.id;

  return (
    <section aria-label={`Conversation with ${name}`} className="flex h-full min-h-0 flex-col bg-slate-50">
      {variant === "page" ? (
        <header className="flex items-center gap-3 border-b border-line bg-white px-3 py-2 sm:px-4">
          <Link
            href="/messages"
            aria-label="Back to conversations"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-ink hover:bg-slate-50 lg:hidden"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </Link>
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-small font-semibold text-white"
          >
            {initialsOf(name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-ink">{name}</h2>
            <p className="truncate text-small text-muted">{thread.partner.headline}</p>
          </div>
          {thread.can_send ? (
            <Link
              href={`/matches/${matchId}/schedule`}
              aria-label={`Schedule a meeting with ${first}`}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-ink hover:bg-slate-50"
            >
              <CalendarIcon className="h-6 w-6" />
            </Link>
          ) : null}
          <Link
            href={`/matches/${matchId}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-emerald/10 px-3 py-2 text-small font-medium text-emerald-deep hover:bg-emerald/20"
          >
            <CircleUserIcon className="h-4 w-4" />
            Profile
          </Link>
        </header>
      ) : null}

      <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {hasMore ? (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="rounded-full border border-line bg-white px-3 py-1 text-meta font-medium text-ink hover:bg-slate-100 disabled:opacity-60"
            >
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-base font-medium text-ink">
              {thread.can_send ? "Start the conversation" : "No messages"}
            </p>
            <p className="max-w-empty text-small text-muted">
              {thread.can_send
                ? `Say hello to ${first}. Only the two of you can see this conversation.`
                : "No messages were sent in this conversation."}
            </p>
          </div>
        ) : (
          <ol role="log" aria-label="Messages" aria-live="polite" className="flex flex-col gap-3">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay = !previous || dayKey(previous.created_at) !== dayKey(message.created_at);
              const mine = message.sender_is_me;
              return (
                <Fragment key={message.id}>
                  {newDay ? (
                    <li className="flex justify-center py-2">
                      <span
                        suppressHydrationWarning
                        className="rounded-full bg-slate-100 px-3 py-1 font-mono text-meta uppercase tracking-wider text-ink"
                      >
                        {dayLabel(message.created_at)}
                      </span>
                    </li>
                  ) : null}
                  <li className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    {mine ? null : (
                      <span
                        aria-hidden="true"
                        className="mb-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-meta font-semibold text-white"
                      >
                        {initialsOf(name)}
                      </span>
                    )}
                    <div className={`flex max-w-[85%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                      <p className="sr-only">{mine ? "You said" : `${first} said`}</p>
                      <div
                        className={`whitespace-pre-wrap break-words rounded-lg px-4 py-3 text-small ${
                          mine ? "bg-emerald-deep text-white" : "border border-line bg-white text-ink"
                        } ${message.status === "sending" ? "opacity-60" : ""}`}
                      >
                        {message.body}
                      </div>
                      <p className="mt-1 flex items-center gap-2 font-mono text-meta text-muted">
                        <time dateTime={message.created_at} suppressHydrationWarning>
                          {messageTime(message.created_at)}
                        </time>
                        {message.status === "sending" ? <span>Sending…</span> : null}
                        {message.status === "failed" ? (
                          <>
                            <span className="text-alert-red">Not sent</span>
                            <button
                              type="button"
                              onClick={() => retry(message)}
                              className="rounded-md font-sans font-medium text-emerald-deep hover:underline"
                            >
                              Retry
                            </button>
                          </>
                        ) : null}
                        {message.id === lastOwnSentId ? (
                          <span>{message.read_at ? "Read" : "Sent"}</span>
                        ) : null}
                      </p>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}
      </div>

      {thread.can_send ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="border-t border-line bg-white p-3 sm:p-4"
        >
          {error ? (
            <p role="alert" className="mb-2 text-meta text-alert-red">
              {error}
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <label htmlFor={inputId} className="sr-only">
              Message {first}
            </label>
            <textarea
              id={inputId}
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                resizeInput();
              }}
              onKeyDown={onKeyDown}
              placeholder={`Message ${first}…`}
              aria-describedby={counterId}
              aria-invalid={tooLong ? true : undefined}
              className="min-h-12 min-w-0 flex-1 resize-none rounded-md border border-muted px-3 py-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-emerald/30"
            />
            <button
              type="submit"
              disabled={!text || tooLong}
              aria-label="Send message"
              className={`${buttonStyles.primary} h-12 shrink-0`}
            >
              <span className="hidden sm:inline">Send</span>
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 font-mono text-meta text-muted">
            <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
            <span id={counterId} aria-live="polite" className={tooLong ? "text-alert-red" : undefined}>
              {text.length >= COUNTER_FROM ? `${text.length}/${MESSAGE_MAX}` : ""}
            </span>
          </div>
          {socketStatus === "closed" ? (
            <p className="mt-1 text-meta text-muted">
              Live updates are reconnecting. New messages refresh every 10 seconds.
            </p>
          ) : null}
        </form>
      ) : (
        <p className="flex items-center gap-2 border-t border-line bg-white p-4 text-small text-muted">
          <LockIcon className="h-4 w-4 shrink-0" />
          This conversation is read-only because you’re no longer a mutual match.
        </p>
      )}
    </section>
  );
}
