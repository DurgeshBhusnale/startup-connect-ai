import Image from "next/image";

import { postKindLabels } from "@/lib/posts";
import { cardStyles } from "@/lib/ui";

import { MilestoneCard } from "./milestone-card";

import type { PostItem, PostMediaItem } from "@/lib/api-types";
import type { ReactNode } from "react";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

function PostImages({ media }: { media: PostMediaItem[] }) {
  const single = media.length === 1;
  return (
    <ul className={`grid gap-2 ${single ? "grid-cols-1" : "grid-cols-2"}`}>
      {media.map((item, index) => {
        const src = single ? item.url : item.thumbnail_url;
        return (
          <li
            key={item.media_id}
            className={`relative overflow-hidden rounded-md border border-line bg-slate-100 ${
              single ? "aspect-video" : "aspect-square"
            }`}
          >
            {src && item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open image ${index + 1} of ${media.length} in a new tab`}
                className="block h-full w-full"
              >
                {/* Signed URLs from a private bucket: served as-is, not through the optimizer. */}
                <Image
                  src={src}
                  alt={`Image ${index + 1} of ${media.length}`}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 640px, 90vw"
                  className="object-cover"
                />
              </a>
            ) : (
              <span className="flex h-full items-center justify-center p-2 text-center text-meta text-ink">
                Image unavailable
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type PostCardProps = {
  post: PostItem;
  actions?: ReactNode;
  /** Shown under a milestone: endorsement badges and the endorse control (S8). */
  claimFooter?: ReactNode;
};

export function PostCard({ post, actions, claimFooter }: PostCardProps) {
  const posted = dateFormat.format(new Date(post.created_at));
  return (
    <article
      aria-label={`${postKindLabels[post.kind]} posted ${posted}`}
      className={`${cardStyles} flex flex-col gap-4 p-6`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 font-mono text-meta uppercase tracking-wider text-muted">
          <span className="rounded bg-slate-100 px-2 py-1 text-ink">{postKindLabels[post.kind]}</span>
          <time dateTime={post.created_at}>{posted}</time>
          {post.edited ? <span>· Edited</span> : null}
        </p>
        {actions}
      </div>
      {post.kind === "milestone" && post.milestone_data ? (
        <MilestoneCard milestone={post.milestone_data} />
      ) : null}
      {post.kind === "milestone" ? claimFooter : null}
      {post.body ? (
        <p className="whitespace-pre-line break-words text-base text-ink">{post.body}</p>
      ) : null}
      {post.media.length > 0 ? <PostImages media={post.media} /> : null}
    </article>
  );
}
