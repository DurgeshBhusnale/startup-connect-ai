import { MessageSquareIcon } from "@/components/icons";
import { MessagesFrame, MessagesUnavailable } from "@/components/messages/messages-frame";
import { ThreadList } from "@/components/messages/thread-list";
import { getThreads } from "@/lib/messages-api";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const result = await getThreads();
  if (result.status !== "ok") {
    return <MessagesUnavailable status={result.status} />;
  }

  return (
    <MessagesFrame
      threadOpen={false}
      list={<ThreadList threads={result.data.items} activeMatchId={null} />}
    >
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <MessageSquareIcon className="h-8 w-8 text-muted" />
        <p className="text-base font-medium text-ink">Select a conversation</p>
        <p className="max-w-empty text-small text-muted">
          Choose someone from the list to read and reply.
        </p>
      </div>
    </MessagesFrame>
  );
}
