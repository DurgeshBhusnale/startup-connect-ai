import Link from "next/link";

import { LockIcon } from "@/components/icons";
import { MessageThread } from "@/components/messages/message-thread";
import { MessagesFrame } from "@/components/messages/messages-frame";
import { ThreadList } from "@/components/messages/thread-list";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryButton } from "@/components/ui/retry-button";
import { getConversation, getThreads } from "@/lib/messages-api";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conversation" };

type ConversationPageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { matchId } = await params;
  const [threads, conversation] = await Promise.all([getThreads(), getConversation(matchId)]);

  const list =
    threads.status === "ok" ? (
      <ThreadList threads={threads.data.items} activeMatchId={matchId} />
    ) : (
      <p className="p-6 text-small text-muted">Couldn’t load your conversations.</p>
    );

  return (
    <MessagesFrame threadOpen list={list}>
      {conversation.status === "ok" ? (
        <MessageThread
          key={matchId}
          thread={conversation.thread}
          initialMessages={conversation.messages}
          hasMore={conversation.hasMore}
          variant="page"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50 p-6">
          {conversation.status === "closed" ? (
            <EmptyState
              icon={<LockIcon className="h-8 w-8" />}
              title="No conversation yet"
              body="You can message each other once you’re a mutual match."
              action={{ href: `/matches/${matchId}`, label: "Back to match" }}
            />
          ) : conversation.status === "private" ? (
            <EmptyState
              icon={<LockIcon className="h-8 w-8" />}
              title="Conversation not found"
              body="This conversation doesn’t exist or isn’t one of yours."
              action={{ href: "/messages", label: "All conversations" }}
            />
          ) : (
            <>
              <EmptyState
                icon={<LockIcon className="h-8 w-8" />}
                title="Couldn’t load this conversation"
                body="Something went wrong on our side. Try again in a moment."
              />
              <RetryButton />
            </>
          )}
          <Link
            href="/messages"
            className="rounded-md text-small font-medium text-emerald-deep hover:underline lg:hidden"
          >
            Back to conversations
          </Link>
        </div>
      )}
    </MessagesFrame>
  );
}
