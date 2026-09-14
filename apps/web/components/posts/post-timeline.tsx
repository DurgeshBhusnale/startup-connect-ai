"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ClaimEndorsement } from "@/components/endorsements/claim-endorsement";
import { ArrowRightIcon, MessageSquareIcon, PlusIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { milestoneItemId } from "@/lib/endorsements";
import { buttonStyles, cardStyles } from "@/lib/ui";

import { ComposePostDialog } from "./compose-post-dialog";
import { DeletePostDialog } from "./delete-post-dialog";
import { PostCard } from "./post-card";

import type { PostItem } from "@/lib/api-types";
import type { EndorseContext } from "@/lib/endorsements";

type PostTimelineProps = {
  posts: PostItem[];
  nextCursor: string | null;
  /** Own profile: New post, Edit, and Delete (PRD M4 AC7). */
  editable: boolean;
  /** Page URL including its query, e.g. "/profile?tab=posts". */
  basePath: string;
  isFirstPage: boolean;
  /** Opens the composer on load (the "+ New post" link on My Profile). */
  autoCompose?: boolean;
  emptyTitle: string;
  emptyBody: string;
  /** Endorsements on milestone posts (S8): badges for everyone, the endorse control for endorsers. */
  endorse?: EndorseContext;
};

type Composer = { existing?: PostItem } | null;

export function PostTimeline({
  posts,
  nextCursor,
  editable,
  basePath,
  isFirstPage,
  autoCompose = false,
  emptyTitle,
  emptyBody,
  endorse,
}: PostTimelineProps) {
  const router = useRouter();
  const [composer, setComposer] = useState<Composer>(autoCompose && editable ? {} : null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const closeComposer = (saved: boolean) => {
    const wasEditing = composer?.existing !== undefined;
    setComposer(null);
    if (autoCompose) {
      router.replace(basePath, { scroll: false });
    }
    if (saved) {
      setNotice(wasEditing ? "Post updated." : "Post published.");
    }
  };

  return (
    <section aria-labelledby="posts-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="posts-heading" className="text-h3">
          Posts
        </h2>
        {editable ? (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setComposer({});
            }}
            className={buttonStyles.primary}
          >
            <PlusIcon className="h-4 w-4" />
            New post
          </button>
        ) : null}
      </div>

      <p role="status" className="text-small text-emerald-deep empty:hidden">
        {notice}
      </p>

      {posts.length === 0 ? (
        <section className={`${cardStyles} p-6`}>
          <EmptyState
            icon={<MessageSquareIcon className="h-8 w-8" />}
            title={emptyTitle}
            body={emptyBody}
          />
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {posts.map((post) => (
            <li key={post.post_id}>
              <PostCard
                post={post}
                claimFooter={
                  endorse && post.milestone_data ? (
                    <ClaimEndorsement
                      endorse={endorse}
                      itemId={milestoneItemId(post.post_id)}
                      itemKind="milestone"
                      label="Milestone"
                      value={post.milestone_data.value}
                      showBadge
                    />
                  ) : undefined
                }
                actions={
                  editable ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setComposer({ existing: post });
                        }}
                        className="rounded-md px-3 py-2 text-small font-medium text-emerald-deep hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setDeletingId(post.post_id);
                        }}
                        className="rounded-md px-3 py-2 text-small font-medium text-alert-red hover:bg-alert-red/5"
                      >
                        Delete
                      </button>
                    </div>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}

      {/* PRD M4 edge case: past 20 posts, older ones stay reachable page by page. */}
      {nextCursor || !isFirstPage ? (
        <nav aria-label="Post pages" className="flex items-center justify-between gap-3">
          {isFirstPage ? (
            <span />
          ) : (
            <Link href={basePath} className={buttonStyles.ghost}>
              Newest posts
            </Link>
          )}
          {nextCursor ? (
            <Link
              href={`${basePath}&cursor=${encodeURIComponent(nextCursor)}`}
              className={buttonStyles.secondary}
            >
              Older posts
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          ) : null}
        </nav>
      ) : null}

      {composer ? (
        <ComposePostDialog
          key={composer.existing?.post_id ?? "new"}
          existing={composer.existing}
          onClose={closeComposer}
        />
      ) : null}
      {deletingId ? (
        <DeletePostDialog
          postId={deletingId}
          onClose={(deleted) => {
            setDeletingId(null);
            if (deleted) setNotice("Post deleted.");
          }}
        />
      ) : null}
    </section>
  );
}
