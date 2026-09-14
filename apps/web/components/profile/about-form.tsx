"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveAbout } from "@/app/(app)/profile/about/actions";
import { GlobeIcon } from "@/components/icons";
import { BIO_MAX, initialSaveAboutState } from "@/lib/about";
import { buttonStyles } from "@/lib/ui";

import type { AppRole } from "@/lib/api-types";

const bioPlaceholders: Record<AppRole, string> = {
  founder: "Building Rupeez, an AI-powered receivables tool for D2C brands. Ex-fintech product lead.",
  investor: "Investing in early-stage fintech and B2B SaaS. Previously a founder.",
  mentor: "10 years scaling B2B SaaS. I help founders with GTM and pricing.",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles.primary}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

type AboutFormProps = {
  role: AppRole;
  bio: string;
  website: string;
};

export function AboutForm({ role, bio, website }: AboutFormProps) {
  const [state, formAction] = useActionState(saveAbout, initialSaveAboutState);
  const [bioValue, setBioValue] = useState(bio);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="role" value={role} />

      <div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="bio" className="text-small font-medium text-ink">
            Short bio <span className="font-normal text-muted">(optional)</span>
          </label>
          <span className="font-mono text-meta text-muted">
            {bioValue.length} / {BIO_MAX}
          </span>
        </div>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          maxLength={BIO_MAX}
          value={bioValue}
          placeholder={bioPlaceholders[role]}
          onChange={(event) => setBioValue(event.target.value)}
          aria-invalid={state.fieldErrors.bio ? true : undefined}
          aria-describedby={state.fieldErrors.bio ? "bio-error" : undefined}
          className={`mt-2 w-full resize-y rounded-md border bg-white px-3 py-3 text-base text-ink placeholder:text-muted ${
            state.fieldErrors.bio ? "border-alert-red" : "border-muted"
          }`}
        />
        {state.fieldErrors.bio ? (
          <p id="bio-error" className="mt-2 text-meta text-alert-red">
            {state.fieldErrors.bio}
          </p>
        ) : null}
      </div>

      {role === "founder" ? (
        <div>
          <label htmlFor="website" className="text-small font-medium text-ink">
            Website <span className="font-normal text-muted">(optional)</span>
          </label>
          <div
            className={`mt-2 flex items-center gap-2 rounded-md border bg-white px-3 focus-within:ring-2 focus-within:ring-emerald/30 ${
              state.fieldErrors.website ? "border-alert-red" : "border-muted"
            }`}
          >
            <GlobeIcon className="h-4 w-4 shrink-0 text-muted" />
            <input
              id="website"
              name="website"
              inputMode="url"
              autoComplete="url"
              defaultValue={website}
              placeholder="https://rupeez.in"
              aria-invalid={state.fieldErrors.website ? true : undefined}
              aria-describedby={state.fieldErrors.website ? "website-error" : undefined}
              className="w-full min-w-0 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-0"
            />
          </div>
          {state.fieldErrors.website ? (
            <p id="website-error" className="mt-2 text-meta text-alert-red">
              {state.fieldErrors.website}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.formError ? (
        <p
          role="alert"
          className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
        >
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row-reverse sm:items-center sm:justify-between">
        <SubmitButton />
        <Link href="/profile" className={buttonStyles.ghost}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
