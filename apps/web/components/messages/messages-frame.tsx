import { LockIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryButton } from "@/components/ui/retry-button";
import { cardStyles } from "@/lib/ui";

import type { ReactNode } from "react";

type MessagesFrameProps = {
  list: ReactNode;
  children: ReactNode;
  /** On mobile only one column shows: the list, or the open conversation (S-18). */
  threadOpen: boolean;
};

export function MessagesFrame({ list, children, threadOpen }: MessagesFrameProps) {
  return (
    <div className="mx-auto max-w-content">
      <div
        className={`${cardStyles} grid h-[calc(100dvh-11rem)] min-h-[28rem] grid-rows-[minmax(0,1fr)] overflow-hidden lg:h-[calc(100dvh-9rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]`}
      >
        <div className={`min-h-0 border-line lg:block lg:border-r ${threadOpen ? "hidden" : "block"}`}>
          {list}
        </div>
        <div className={`min-h-0 lg:block ${threadOpen ? "block" : "hidden"}`}>{children}</div>
      </div>
    </div>
  );
}

export function MessagesUnavailable({ status }: { status: "incomplete" | "unavailable" }) {
  return (
    <div className="mx-auto max-w-content">
      <section className={`${cardStyles} flex flex-col items-center gap-4 p-6`}>
        {status === "incomplete" ? (
          <EmptyState
            icon={<LockIcon className="h-8 w-8" />}
            title="Messages aren’t available yet"
            body="Messaging opens once your profile is complete, matching is on, and you have a mutual match."
            action={{ href: "/profile", label: "Go to your profile" }}
          />
        ) : (
          <>
            <EmptyState
              icon={<LockIcon className="h-8 w-8" />}
              title="Couldn’t load messages"
              body="Something went wrong on our side. Try again in a moment."
            />
            <RetryButton />
          </>
        )}
      </section>
    </div>
  );
}
