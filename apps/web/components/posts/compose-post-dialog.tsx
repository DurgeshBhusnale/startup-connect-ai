"use client";

import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { createPost, updatePost } from "@/app/(app)/profile/post-actions";
import { AlignLeftIcon, FlagIcon, ImageIcon, UploadCloudIcon, XIcon } from "@/components/icons";
import { ApiError, apiUpload } from "@/lib/api";
import { formatBytes } from "@/lib/founder-profile";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_POST_IMAGES,
  MILESTONE_DESCRIPTION_MAX,
  MILESTONE_VALUE_MAX,
  MILESTONE_VALUE_MIN,
  POST_BODY_MAX,
  milestoneTypes,
  textStarters,
  todayInIndia,
} from "@/lib/posts";
import { buttonStyles } from "@/lib/ui";

import { MilestoneCard } from "./milestone-card";

import type { IconComponent } from "@/components/icons";
import type { MediaUploadResponse, MilestoneType, PostItem, PostKind } from "@/lib/api-types";
import type { DragEvent } from "react";

type ImageSlot = {
  key: string;
  name: string;
  size: number | null;
  previewUrl: string | null;
  localPreview: boolean;
  mediaId: string | null;
  status: "uploading" | "ready" | "error";
  error: string | null;
};

const tabs: readonly { kind: PostKind; label: string; icon: IconComponent }[] = [
  { kind: "text", label: "Text", icon: AlignLeftIcon },
  { kind: "image", label: "Image", icon: ImageIcon },
  { kind: "milestone", label: "Milestone", icon: FlagIcon },
];

const fieldClass =
  "mt-2 w-full rounded-md border border-muted bg-white px-3 py-3 text-base text-ink placeholder:text-muted";
const labelClass = "text-small font-medium text-ink";

// PRD M4 AC2: amber below 50 and red at 0. Amber can't be body text (contrast), so it's a dot.
function Counter({ remaining, id }: { remaining: number; id: string }) {
  const dot = remaining === 0 ? "bg-alert-red" : remaining < 50 ? "bg-alert-amber" : null;
  return (
    <p
      id={id}
      className={`flex items-center gap-2 font-mono text-meta ${remaining === 0 ? "text-alert-red" : "text-muted"}`}
    >
      {dot ? <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} /> : null}
      {remaining} {remaining === 1 ? "character" : "characters"} left
    </p>
  );
}

function describeUploadError(error: unknown): string {
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Upload timed out. Try again.";
  }
  if (error instanceof ApiError) {
    if (error.status === 413) return "Images must be 5MB or smaller.";
    if (error.status < 500 && error.problem?.detail) return error.problem.detail;
  }
  return "Upload failed. Try again.";
}

type ComposePostDialogProps = {
  /** Present when editing: the post type can't change. */
  existing?: PostItem;
  onClose: (saved: boolean) => void;
};

export function ComposePostDialog({ existing, onClose }: ComposePostDialogProps) {
  const { getToken } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const slotsRef = useRef<ImageSlot[]>([]);
  const ids = useId();
  const editing = existing !== undefined;

  const [kind, setKind] = useState<PostKind>(existing?.kind ?? "text");
  const [body, setBody] = useState(existing?.body ?? "");
  const [slots, setSlots] = useState<ImageSlot[]>(
    () =>
      existing?.media.map((item, index) => ({
        key: item.media_id,
        name: `Image ${index + 1}`,
        size: null,
        previewUrl: item.thumbnail_url,
        localPreview: false,
        mediaId: item.media_id,
        status: "ready",
        error: null,
      })) ?? [],
  );
  const [milestoneType, setMilestoneType] = useState<MilestoneType>(
    existing?.milestone_data?.type ?? "users",
  );
  const [milestoneValue, setMilestoneValue] = useState(existing?.milestone_data?.value ?? "");
  const [achievedOn, setAchievedOn] = useState(
    existing?.milestone_data?.achieved_on ?? todayInIndia(),
  );
  const [description, setDescription] = useState(existing?.milestone_data?.description ?? "");
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPosting, startPosting] = useTransition();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(
    () => () => {
      for (const slot of slotsRef.current) {
        if (slot.localPreview && slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
      }
    },
    [],
  );

  const close = () => dialogRef.current?.close();

  const uploadFile = async (file: File, key: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No session token");
      const form = new FormData();
      form.append("file", file);
      const uploaded = await apiUpload<MediaUploadResponse>("/v1/media/upload", {
        token,
        body: form,
        timeoutMs: 60_000,
      });
      setSlots((current) =>
        current.map((slot) =>
          slot.key === key ? { ...slot, mediaId: uploaded.media_id, status: "ready" } : slot,
        ),
      );
    } catch (uploadError) {
      setSlots((current) =>
        current.map((slot) =>
          slot.key === key
            ? { ...slot, status: "error", error: describeUploadError(uploadError) }
            : slot,
        ),
      );
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setFileError(null);
    const room = MAX_POST_IMAGES - slots.length;
    const picked = Array.from(files);
    if (picked.length > room) {
      setFileError(`You can add up to ${MAX_POST_IMAGES} images.`);
    }
    const added: ImageSlot[] = [];
    for (const file of picked.slice(0, Math.max(room, 0))) {
      // PRD M4 edge cases: reject non-images and files over 5MB before uploading.
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setFileError("Only JPG, PNG, or WebP images can be added.");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setFileError(`${file.name} is larger than 5MB.`);
        continue;
      }
      const key = crypto.randomUUID();
      added.push({
        key,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        localPreview: true,
        mediaId: null,
        status: "uploading",
        error: null,
      });
      void uploadFile(file, key);
    }
    if (added.length > 0) {
      setSlots((current) => [...current, ...added]);
    }
  };

  const removeSlot = (key: string) => {
    setSlots((current) => {
      const slot = current.find((item) => item.key === key);
      if (slot?.localPreview && slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
      return current.filter((item) => item.key !== key);
    });
    setFileError(null);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    addFiles(event.dataTransfer.files);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const uploading = slots.some((slot) => slot.status === "uploading");
  const failedUploads = slots.some((slot) => slot.status === "error");
  const readyMediaIds = slots.flatMap((slot) =>
    slot.status === "ready" && slot.mediaId ? [slot.mediaId] : [],
  );
  const canPost =
    !isPosting &&
    (kind === "text"
      ? body.trim().length > 0
      : kind === "image"
        ? readyMediaIds.length > 0 && !uploading && !failedUploads
        : milestoneValue.trim().length >= MILESTONE_VALUE_MIN && achievedOn !== "");

  const submit = () => {
    if (!canPost) return;
    setError(null);
    const input = {
      kind,
      body: kind === "milestone" ? "" : body.trim(),
      mediaIds: kind === "image" ? readyMediaIds : [],
      milestone:
        kind === "milestone"
          ? {
              type: milestoneType,
              value: milestoneValue.trim(),
              achieved_on: achievedOn,
              description: description.trim() || null,
            }
          : null,
    };
    startPosting(async () => {
      const result = existing
        ? await updatePost(existing.post_id, input)
        : await createPost(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose(true);
    });
  };

  const bodyCounterId = `${ids}-body-count`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${ids}-title`}
      onClose={() => onClose(false)}
      onCancel={(event) => {
        if (isPosting) event.preventDefault();
      }}
      className="w-full max-w-modal rounded-xl bg-white p-0 text-ink shadow-card backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${ids}-title`} className="text-h3">
            {editing ? "Edit post" : "New post"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-muted hover:bg-slate-50 hover:text-ink"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        <div role="tablist" aria-label="Post type" className="-mt-2 flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((tab) => {
            const selected = tab.kind === kind;
            return (
              <button
                key={tab.kind}
                type="button"
                role="tab"
                id={`${ids}-tab-${tab.kind}`}
                aria-selected={selected}
                aria-controls={`${ids}-panel`}
                disabled={editing && !selected}
                onClick={() => {
                  setKind(tab.kind);
                  setError(null);
                }}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-small font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "border-emerald-deep text-emerald-deep"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id={`${ids}-panel`}
          role="tabpanel"
          aria-labelledby={`${ids}-tab-${kind}`}
          className="flex flex-col gap-4"
        >
          {kind === "text" ? (
            <>
              {!editing && body === "" ? (
                <div className="flex flex-wrap gap-2">
                  {textStarters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => {
                        setBody(starter);
                        bodyRef.current?.focus();
                      }}
                      className="rounded-full border border-line bg-slate-50 px-3 py-1 text-small text-ink hover:bg-slate-100"
                    >
                      {starter.trim()}…
                    </button>
                  ))}
                </div>
              ) : null}
              <div>
                <label htmlFor={`${ids}-body`} className="sr-only">
                  Your update
                </label>
                <textarea
                  ref={bodyRef}
                  id={`${ids}-body`}
                  rows={6}
                  maxLength={POST_BODY_MAX}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Share what’s new: a launch, a win, a milestone…"
                  aria-describedby={bodyCounterId}
                  className={`${fieldClass} mt-0 resize-y`}
                />
                <div className="mt-2 flex justify-end">
                  <Counter remaining={POST_BODY_MAX - body.length} id={bodyCounterId} />
                </div>
              </div>
            </>
          ) : null}

          {kind === "image" ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                multiple
                tabIndex={-1}
                aria-label="Choose images"
                className="sr-only"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              {slots.length < MAX_POST_IMAGES ? (
                <div
                  onDragEnter={onDragOver}
                  onDragOver={onDragOver}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={onDrop}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
                    dragActive ? "border-emerald bg-emerald/5" : "border-muted/40 bg-slate-50"
                  }`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-emerald-deep">
                    <UploadCloudIcon className="h-6 w-6" />
                  </span>
                  <p className="mt-3 text-base text-ink">
                    Drop images or{" "}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded font-medium text-emerald-deep underline underline-offset-2"
                    >
                      browse files
                    </button>
                  </p>
                  <p className="mt-1 text-meta text-muted">
                    Up to {MAX_POST_IMAGES} images, 5MB each. JPG, PNG, or WebP.
                  </p>
                </div>
              ) : null}
              {fileError ? (
                <p role="alert" className="text-meta text-alert-red">
                  {fileError}
                </p>
              ) : null}
              {slots.length > 0 ? (
                <ul className="grid grid-cols-2 gap-3">
                  {slots.map((slot) => (
                    <li key={slot.key} className="overflow-hidden rounded-md border border-line bg-white">
                      <div className="relative aspect-video bg-slate-100">
                        {slot.previewUrl ? (
                          <Image
                            src={slot.previewUrl}
                            alt={slot.name}
                            fill
                            unoptimized
                            sizes="(min-width: 640px) 256px, 45vw"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-meta text-ink">
                            Preview unavailable
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeSlot(slot.key)}
                          aria-label={`Remove ${slot.name}`}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white hover:opacity-90"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="px-3 py-2">
                        <p className="truncate text-meta text-ink">{slot.name}</p>
                        <p
                          role={slot.status === "error" ? "alert" : undefined}
                          className={`font-mono text-meta ${slot.status === "error" ? "text-alert-red" : "text-muted"}`}
                        >
                          {slot.status === "uploading"
                            ? "Uploading…"
                            : slot.status === "error"
                              ? slot.error
                              : [slot.size ? formatBytes(slot.size) : null, "Ready"]
                                  .filter(Boolean)
                                  .join(" · ")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div>
                <label htmlFor={`${ids}-caption`} className={labelClass}>
                  Caption <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id={`${ids}-caption`}
                  rows={3}
                  maxLength={POST_BODY_MAX}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Add a caption…"
                  aria-describedby={bodyCounterId}
                  className={`${fieldClass} resize-y`}
                />
                <div className="mt-2 flex justify-end">
                  <Counter remaining={POST_BODY_MAX - body.length} id={bodyCounterId} />
                </div>
              </div>
            </>
          ) : null}

          {kind === "milestone" ? (
            <>
              <div>
                <label htmlFor={`${ids}-type`} className={labelClass}>
                  Milestone type
                </label>
                <select
                  id={`${ids}-type`}
                  value={milestoneType}
                  onChange={(event) => {
                    const option = milestoneTypes.find((item) => item.value === event.target.value);
                    if (option) setMilestoneType(option.value);
                  }}
                  className={fieldClass}
                >
                  {milestoneTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${ids}-value`} className={labelClass}>
                  What happened?
                </label>
                <input
                  id={`${ids}-value`}
                  type="text"
                  maxLength={MILESTONE_VALUE_MAX}
                  value={milestoneValue}
                  onChange={(event) => setMilestoneValue(event.target.value)}
                  placeholder="e.g. Crossed 1,000 paying users"
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor={`${ids}-date`} className={labelClass}>
                  Date achieved
                </label>
                <input
                  id={`${ids}-date`}
                  type="date"
                  max={todayInIndia()}
                  value={achievedOn}
                  onChange={(event) => setAchievedOn(event.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor={`${ids}-description`} className={labelClass}>
                  Description <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id={`${ids}-description`}
                  rows={3}
                  maxLength={MILESTONE_DESCRIPTION_MAX}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  aria-describedby={`${ids}-description-count`}
                  className={`${fieldClass} resize-y`}
                />
                <div className="mt-2 flex justify-end">
                  <Counter
                    remaining={MILESTONE_DESCRIPTION_MAX - description.length}
                    id={`${ids}-description-count`}
                  />
                </div>
              </div>
              <div>
                <p className="font-mono text-meta uppercase tracking-wider text-muted">Preview</p>
                <div className="mt-2">
                  <MilestoneCard
                    milestone={{
                      type: milestoneType,
                      value: milestoneValue.trim(),
                      achieved_on: achievedOn,
                      description: description.trim() || null,
                    }}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
          >
            {error}{" "}
            {error.includes("community guidelines") ? (
              <Link href="/terms" target="_blank" className="font-medium underline">
                Read the guidelines
              </Link>
            ) : null}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
          <button type="button" onClick={submit} disabled={!canPost} className={buttonStyles.primary}>
            {isPosting ? (editing ? "Saving…" : "Posting…") : editing ? "Save changes" : "Post"}
          </button>
          <button type="button" onClick={close} className={buttonStyles.ghost}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
