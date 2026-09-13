"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  ArrowRightIcon,
  CircleCheckIcon,
  FileTextIcon,
  LinkedinIcon,
  SparklesIcon,
  UploadCloudIcon,
  XIcon,
} from "@/components/icons";
import { ApiError, apiUpload } from "@/lib/api";
import { MAX_DECK_BYTES, formatBytes, isLinkedInProfileUrl } from "@/lib/founder-profile";
import { buttonStyles } from "@/lib/ui";

import type { AutobuildResponse } from "@/lib/api-types";
import type { DragEvent, FormEvent } from "react";

const MANUAL_ENTRY_HREF = "/onboarding/founder/review?manual=1";
const LINKEDIN_ERROR =
  "That doesn’t look like a LinkedIn profile URL — it should look like https://linkedin.com/in/yourname.";

type UploadError = {
  message: string;
  field: "deck" | "linkedin" | null;
  offerManual: boolean;
};

function describeUploadError(error: unknown): UploadError {
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return {
      message: "This is taking longer than expected. Please try again.",
      field: null,
      offerManual: true,
    };
  }
  if (!(error instanceof ApiError)) {
    return {
      message: "Upload failed — check your connection and try again.",
      field: null,
      offerManual: false,
    };
  }

  switch (error.problem?.type) {
    case "/problems/deck-too-large":
      return { message: "Please compress your deck to under 20MB.", field: "deck", offerManual: false };
    case "/problems/deck-unreadable":
      return {
        message: error.problem?.detail ?? "We couldn’t read this PDF. Export it again and retry.",
        field: "deck",
        offerManual: true,
      };
    case "/problems/deck-no-text":
      return {
        message:
          "We couldn’t find readable text in this deck — it may be made of images. You can enter your details manually.",
        field: "deck",
        offerManual: true,
      };
    case "/problems/invalid-linkedin-url":
      return { message: LINKEDIN_ERROR, field: "linkedin", offerManual: false };
    case "/problems/extraction-failed":
      return {
        message: "Auto-fill didn’t work this time — you can enter your details manually.",
        field: null,
        offerManual: true,
      };
    default:
      break;
  }

  if (error.status === 401) {
    return {
      message: "Your session expired. Refresh the page and sign in again.",
      field: null,
      offerManual: false,
    };
  }
  return { message: "Upload failed — please try again in a moment.", field: null, offerManual: true };
}

export function DeckUploadForm() {
  const { getToken } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinTouched, setLinkedinTouched] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);

  const linkedinValid = isLinkedInProfileUrl(linkedinUrl);
  const linkedinError =
    (uploadError?.field === "linkedin" ? uploadError.message : null) ??
    (linkedinTouched && linkedinUrl.trim() !== "" && !linkedinValid ? LINKEDIN_ERROR : null);
  const deckError = fileError ?? (uploadError?.field === "deck" ? uploadError.message : null);
  const canSubmit = file !== null && linkedinValid && !uploading;

  function openFilePicker() {
    inputRef.current?.click();
  }

  function acceptFile(candidate: File | undefined) {
    if (!candidate) return;
    setUploadError(null);
    const isPdf =
      candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFileError("Upload your deck as a PDF file.");
      return;
    }
    if (candidate.size > MAX_DECK_BYTES) {
      setFileError("Please compress your deck to under 20MB.");
      return;
    }
    setFileError(null);
    setFile(candidate);
  }

  function removeFile() {
    setFile(null);
    setFileError(null);
    setUploadError(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLinkedinTouched(true);
    if (!file || !linkedinValid || uploading) return;

    setUploading(true);
    setUploadError(null);
    try {
      const token = await getToken();
      if (!token) {
        router.replace("/sign-in");
        return;
      }
      const body = new FormData();
      body.append("deck_file", file);
      body.append("linkedin_url", linkedinUrl.trim());
      await apiUpload<AutobuildResponse>("/v1/profiles/autobuild", { token, body, timeoutMs: 90_000 });
      router.push("/onboarding/founder/review");
    } catch (error) {
      if (error instanceof ApiError && error.problem?.type === "/problems/profile-already-completed") {
        router.replace("/home");
        return;
      }
      setUploadError(describeUploadError(error));
      setUploading(false);
    }
  }

  if (uploading) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center py-12 text-center">
        <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-emerald/10 text-emerald">
          <SparklesIcon className="h-8 w-8" />
        </span>
        <h2 className="mt-6 text-h3">Reading your deck… (~30 seconds)</h2>
        <p className="mt-2 max-w-sm text-small text-muted">
          We’re pulling out your sector, stage, ask, and team details. Keep this tab open.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div>
        <label htmlFor="deck-file" className="sr-only">
          Pitch deck (PDF, up to 20MB)
        </label>
        <input
          ref={inputRef}
          id="deck-file"
          type="file"
          accept="application/pdf,.pdf"
          tabIndex={-1}
          className="sr-only"
          aria-describedby={deckError ? "deck-error" : undefined}
          onChange={(event) => {
            acceptFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {file ? (
          <div className="rounded-lg border-2 border-emerald bg-emerald/5 p-4">
            <div className="flex items-center gap-3 rounded-md border border-line bg-white p-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-emerald/10 text-emerald-deep">
                <FileTextIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate text-small font-medium text-ink">{file.name}</span>
                  <span className="shrink-0 rounded bg-emerald-bright/15 px-1 font-mono text-meta uppercase text-emerald-deep">
                    Ready
                  </span>
                </p>
                <p className="font-mono text-meta text-muted">{formatBytes(file.size)} · PDF</p>
              </div>
              <button
                type="button"
                onClick={removeFile}
                aria-label={`Remove ${file.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-ink"
              >
                <XIcon />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-meta">
              <p className="flex items-center gap-1 text-ink">
                <CircleCheckIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
                Deck attached — we’ll read it when you build your profile.
              </p>
              <button
                type="button"
                onClick={openFilePicker}
                className="rounded-md font-medium text-emerald-deep hover:underline"
              >
                Replace file
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
              dragActive
                ? "border-emerald bg-emerald/5"
                : deckError
                  ? "border-alert-red bg-white"
                  : "border-muted/40 bg-white"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-emerald-deep">
              <UploadCloudIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-base font-medium text-ink">Drop your pitch deck here</p>
            <p className="mt-1 text-small text-muted">
              or{" "}
              <button
                type="button"
                onClick={openFilePicker}
                className="rounded font-medium text-emerald-deep underline underline-offset-2"
              >
                click to upload
              </button>
            </p>
            <p className="mt-3 inline-flex items-center gap-1 rounded border border-line bg-slate-50 px-2 py-1 font-mono text-meta text-muted">
              <FileTextIcon className="h-4 w-4" />
              PDF, up to 20MB
            </p>
          </div>
        )}
        {deckError ? (
          <p id="deck-error" role="alert" className="mt-2 text-meta text-alert-red">
            {deckError}
          </p>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="linkedin-url"
            className="font-mono text-meta uppercase tracking-wider text-ink"
          >
            Your LinkedIn URL
          </label>
          {linkedinValid ? (
            <span className="flex items-center gap-1 text-meta text-emerald-deep">
              <CircleCheckIcon className="h-4 w-4" />
              Looks good
            </span>
          ) : null}
        </div>
        <div
          className={`mt-2 flex items-center gap-2 rounded-md border bg-white px-3 focus-within:ring-2 focus-within:ring-emerald/30 ${
            linkedinError ? "border-alert-red" : linkedinValid ? "border-emerald" : "border-muted"
          }`}
        >
          <LinkedinIcon className="h-4 w-4 shrink-0 text-ink" />
          <input
            id="linkedin-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://linkedin.com/in/yourname"
            value={linkedinUrl}
            onChange={(event) => {
              setLinkedinUrl(event.target.value);
              if (uploadError?.field === "linkedin") setUploadError(null);
            }}
            onBlur={() => setLinkedinTouched(true)}
            aria-invalid={linkedinError ? true : undefined}
            aria-describedby="linkedin-help"
            className="w-full min-w-0 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-0"
          />
        </div>
        <p
          id="linkedin-help"
          className={`mt-2 text-meta ${linkedinError ? "text-alert-red" : "text-muted"}`}
        >
          {linkedinError ?? "We save this link on your profile. We don’t pull any data from LinkedIn."}
        </p>
      </div>

      {uploadError && uploadError.field === null ? (
        <p
          role="alert"
          className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
        >
          {uploadError.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={!canSubmit} className={`${buttonStyles.primary} w-full text-base`}>
          {uploadError ? "Try again" : "Build my profile"}
          <ArrowRightIcon />
        </button>
        <Link
          href={MANUAL_ENTRY_HREF}
          className={
            uploadError?.offerManual
              ? `${buttonStyles.secondary} w-full`
              : `${buttonStyles.ghost} w-full`
          }
        >
          {uploadError?.offerManual ? "Enter details manually" : "Fill manually instead"}
        </Link>
      </div>

      <p className="border-t border-line pt-6 text-center text-meta text-muted">
        We use your deck to auto-fill your profile, and you can edit everything in the next step.
        Decks are read once and never stored.
      </p>
    </form>
  );
}
