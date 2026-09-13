"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveFounderProfile } from "@/app/onboarding/founder/review/actions";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  TriangleAlertIcon,
  XIcon,
} from "@/components/icons";
import {
  DESCRIPTION_MAX,
  LOW_CONFIDENCE_THRESHOLD,
  MAX_COMPETITORS,
  businessModels,
  draftToFormValues,
  initialSaveProfileState,
  validateFounderProfile,
} from "@/lib/founder-profile";
import { founderSectors, founderStages } from "@/lib/taxonomy";
import { buttonStyles } from "@/lib/ui";

import type { FounderProfileDraft } from "@/lib/api-types";
import type { FounderField, FounderFieldErrors, FounderFormValues } from "@/lib/founder-profile";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";

// Form fields map onto the extraction keys used by the API's confidence map.
const confidenceKeys: Record<FounderField, string> = {
  startup_name: "startup_name",
  sector: "sector",
  stage: "stage",
  city: "city",
  business_model: "business_model",
  ask_amount: "ask_amount_inr",
  team_size: "team_size",
  description: "description",
  competitors: "competitors",
};

const allFields = Object.keys(confidenceKeys) as FounderField[];

function borderClasses(low: boolean, invalid: boolean): string {
  if (invalid) return "border-alert-red";
  return low ? "border-muted border-l-4 border-l-alert-amber" : "border-muted";
}

function controlClass(low: boolean, invalid: boolean): string {
  return `w-full rounded-md border bg-white px-3 py-3 text-base text-ink placeholder:text-muted ${borderClasses(low, invalid)}`;
}

function groupClass(low: boolean, invalid: boolean): string {
  return `flex overflow-hidden rounded-md border bg-white focus-within:ring-2 focus-within:ring-emerald/30 ${borderClasses(low, invalid)}`;
}

const bareInputClass =
  "w-full min-w-0 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-0";

function describedBy(id: string, low: boolean, error: string | undefined): string | undefined {
  const ids = [low ? `${id}-confidence` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function LowConfidenceNote({ id, percent }: { id: string; percent: number }) {
  return (
    <span
      id={id}
      title="Please verify — auto-extracted with low confidence"
      className="flex items-center gap-1 text-meta text-ink"
    >
      <TriangleAlertIcon className="h-4 w-4 shrink-0 text-alert-amber" />
      {percent > 0 ? `Please verify · ${percent}% confidence` : "Not found in your deck — please add"}
    </span>
  );
}

type FieldProps = {
  id: string;
  label: string;
  low: boolean;
  percent: number;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
};

function Field({ id, label, low, percent, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-small font-medium text-ink">
          {label}
        </label>
        {low ? <LowConfidenceNote id={`${id}-confidence`} percent={percent} /> : hint}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-meta text-alert-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FormSection({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`section-${index}`}
      className={`flex flex-col gap-6 ${index > 1 ? "border-t border-line pt-8" : ""}`}
    >
      <h2
        id={`section-${index}`}
        className="flex items-center gap-2 font-mono text-small uppercase tracking-wider text-ink"
      >
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-emerald" />
        Section {index} · {title}
      </h2>
      {children}
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles.primary}>
      {pending ? "Saving…" : "Continue"}
      {pending ? null : <ArrowRightIcon />}
    </button>
  );
}

type ProfileReviewFormProps = {
  draft: FounderProfileDraft | null;
  confidence: Record<string, number>;
  linkedinUrl: string | null;
};

export function ProfileReviewForm({ draft, confidence, linkedinUrl }: ProfileReviewFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FounderFormValues>(() => draftToFormValues(draft, linkedinUrl));
  const [edited, setEdited] = useState<ReadonlySet<FounderField>>(() => new Set());
  const [changedSinceSubmit, setChangedSinceSubmit] = useState<ReadonlySet<FounderField>>(
    () => new Set(),
  );
  const [clientErrors, setClientErrors] = useState<FounderFieldErrors>({});
  const [competitorInput, setCompetitorInput] = useState("");
  const [state, formAction] = useActionState(saveFounderProfile, initialSaveProfileState);

  const isLow = (field: FounderField) =>
    draft !== null &&
    !edited.has(field) &&
    (confidence[confidenceKeys[field]] ?? 0) < LOW_CONFIDENCE_THRESHOLD;
  const percent = (field: FounderField) =>
    Math.round((confidence[confidenceKeys[field]] ?? 0) * 100);
  const errorFor = (field: FounderField) =>
    changedSinceSubmit.has(field) ? undefined : (clientErrors[field] ?? state.fieldErrors[field]);
  const hasFieldErrors = allFields.some((field) => errorFor(field));

  function change(field: FounderField, patch: Partial<FounderFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setEdited((current) => new Set(current).add(field));
    setChangedSinceSubmit((current) => new Set(current).add(field));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const result = validateFounderProfile(values);
    setChangedSinceSubmit(new Set());
    if (result.errors) {
      event.preventDefault();
      setClientErrors(result.errors);
      const firstInvalid = allFields.find((field) => result.errors[field]);
      if (firstInvalid) {
        formRef.current?.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`)?.focus();
      }
      return;
    }
    setClientErrors({});
  }

  function addCompetitor() {
    const name = competitorInput.trim().replace(/,+$/, "").trim().slice(0, 60);
    setCompetitorInput("");
    if (!name || values.competitors.length >= MAX_COMPETITORS) return;
    if (values.competitors.some((existing) => existing.toLowerCase() === name.toLowerCase())) return;
    change("competitors", { competitors: [...values.competitors, name] });
  }

  function handleCompetitorKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addCompetitor();
    } else if (event.key === "Backspace" && competitorInput === "" && values.competitors.length > 0) {
      change("competitors", { competitors: values.competitors.slice(0, -1) });
    }
  }

  function stepTeamSize(delta: number) {
    const current = Number.parseInt(values.team_size, 10);
    const next = Math.min(10_000, Math.max(1, (Number.isNaN(current) ? 0 : current) + delta));
    change("team_size", { team_size: String(next) });
  }

  const competitorsFull = values.competitors.length >= MAX_COMPETITORS;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-8"
    >
      <input type="hidden" name="linkedin_url" value={values.linkedin_url} />

      <FormSection index={1} title="Basic details">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="startup_name"
            label="Startup name"
            low={isLow("startup_name")}
            percent={percent("startup_name")}
            error={errorFor("startup_name")}
          >
            <input
              id="startup_name"
              name="startup_name"
              data-field="startup_name"
              value={values.startup_name}
              maxLength={120}
              autoComplete="organization"
              onChange={(event) => change("startup_name", { startup_name: event.target.value })}
              aria-invalid={errorFor("startup_name") ? true : undefined}
              aria-describedby={describedBy("startup_name", isLow("startup_name"), errorFor("startup_name"))}
              className={controlClass(isLow("startup_name"), Boolean(errorFor("startup_name")))}
            />
          </Field>

          <Field
            id="sector"
            label="Sector"
            low={isLow("sector")}
            percent={percent("sector")}
            error={errorFor("sector")}
          >
            <div className="relative">
              <select
                id="sector"
                name="sector"
                data-field="sector"
                value={values.sector}
                onChange={(event) => change("sector", { sector: event.target.value })}
                aria-invalid={errorFor("sector") ? true : undefined}
                aria-describedby={describedBy("sector", isLow("sector"), errorFor("sector"))}
                className={`${controlClass(isLow("sector"), Boolean(errorFor("sector")))} appearance-none pr-12`}
              >
                <option value="" disabled>
                  Choose a sector
                </option>
                {founderSectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </Field>
        </div>

        <fieldset aria-describedby={describedBy("stage", isLow("stage"), errorFor("stage"))}>
          <legend className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 text-small font-medium text-ink">
            Stage
            {isLow("stage") ? <LowConfidenceNote id="stage-confidence" percent={percent("stage")} /> : null}
          </legend>
          <div
            className={`grid grid-cols-3 gap-2 ${
              isLow("stage") ? "rounded-md border-l-4 border-l-alert-amber pl-2" : ""
            }`}
          >
            {founderStages.map((stage, index) => (
              <label
                key={stage.value}
                className="flex cursor-pointer items-center justify-center rounded-md border border-line bg-slate-50 px-2 py-3 text-small text-ink transition-colors hover:border-muted has-[:checked]:border-emerald has-[:checked]:bg-emerald/10 has-[:checked]:font-medium has-[:checked]:text-emerald-deep has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald/30"
              >
                <input
                  type="radio"
                  name="stage"
                  value={stage.value}
                  checked={values.stage === stage.value}
                  onChange={() => change("stage", { stage: stage.value })}
                  data-field={index === 0 ? "stage" : undefined}
                  className="sr-only"
                />
                {stage.label}
              </label>
            ))}
          </div>
          {errorFor("stage") ? (
            <p id="stage-error" className="mt-2 text-meta text-alert-red">
              {errorFor("stage")}
            </p>
          ) : null}
        </fieldset>

        <Field
          id="city"
          label="City"
          low={isLow("city")}
          percent={percent("city")}
          error={errorFor("city")}
        >
          <input
            id="city"
            name="city"
            data-field="city"
            value={values.city}
            maxLength={80}
            autoComplete="address-level2"
            placeholder="Pune"
            onChange={(event) => change("city", { city: event.target.value })}
            aria-invalid={errorFor("city") ? true : undefined}
            aria-describedby={describedBy("city", isLow("city"), errorFor("city"))}
            className={controlClass(isLow("city"), Boolean(errorFor("city")))}
          />
        </Field>
      </FormSection>

      <FormSection index={2} title="Business">
        <Field
          id="business_model"
          label="Business model"
          low={isLow("business_model")}
          percent={percent("business_model")}
          error={errorFor("business_model")}
        >
          <div className="relative">
            <select
              id="business_model"
              name="business_model"
              data-field="business_model"
              value={values.business_model}
              onChange={(event) => change("business_model", { business_model: event.target.value })}
              aria-invalid={errorFor("business_model") ? true : undefined}
              aria-describedby={describedBy(
                "business_model",
                isLow("business_model"),
                errorFor("business_model"),
              )}
              className={`${controlClass(isLow("business_model"), Boolean(errorFor("business_model")))} appearance-none pr-12`}
            >
              <option value="" disabled>
                Choose a business model
              </option>
              {businessModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="ask_amount"
            label="Ask amount"
            low={isLow("ask_amount")}
            percent={percent("ask_amount")}
            error={errorFor("ask_amount")}
            hint={<span className="text-meta text-muted">e.g. 40L or 1.5Cr</span>}
          >
            <div className={`${groupClass(isLow("ask_amount"), Boolean(errorFor("ask_amount")))} items-stretch`}>
              <span
                aria-hidden="true"
                className="flex items-center border-r border-line bg-slate-50 px-3 text-base text-muted"
              >
                ₹
              </span>
              <input
                id="ask_amount"
                name="ask_amount"
                data-field="ask_amount"
                inputMode="decimal"
                placeholder="40L"
                value={values.ask_amount}
                onChange={(event) => change("ask_amount", { ask_amount: event.target.value })}
                aria-invalid={errorFor("ask_amount") ? true : undefined}
                aria-describedby={describedBy("ask_amount", isLow("ask_amount"), errorFor("ask_amount"))}
                className={`${bareInputClass} px-3`}
              />
            </div>
          </Field>

          <Field
            id="team_size"
            label="Team size"
            low={isLow("team_size")}
            percent={percent("team_size")}
            error={errorFor("team_size")}
          >
            <div className={`${groupClass(isLow("team_size"), Boolean(errorFor("team_size")))} items-stretch`}>
              <button
                type="button"
                onClick={() => stepTeamSize(-1)}
                aria-label="Decrease team size"
                className="flex w-12 shrink-0 items-center justify-center text-ink hover:bg-slate-50"
              >
                <MinusIcon />
              </button>
              <input
                id="team_size"
                name="team_size"
                data-field="team_size"
                type="number"
                min={1}
                max={10000}
                inputMode="numeric"
                value={values.team_size}
                onChange={(event) => change("team_size", { team_size: event.target.value })}
                aria-invalid={errorFor("team_size") ? true : undefined}
                aria-describedby={describedBy("team_size", isLow("team_size"), errorFor("team_size"))}
                className={`${bareInputClass} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              />
              <button
                type="button"
                onClick={() => stepTeamSize(1)}
                aria-label="Increase team size"
                className="flex w-12 shrink-0 items-center justify-center text-ink hover:bg-slate-50"
              >
                <PlusIcon />
              </button>
            </div>
          </Field>
        </div>
      </FormSection>

      <FormSection index={3} title="Context">
        <Field
          id="description"
          label="Short description"
          low={isLow("description")}
          percent={percent("description")}
          error={errorFor("description")}
          hint={
            <span className="font-mono text-meta text-muted">
              {values.description.length} / {DESCRIPTION_MAX}
            </span>
          }
        >
          <textarea
            id="description"
            name="description"
            data-field="description"
            rows={3}
            maxLength={DESCRIPTION_MAX}
            placeholder="What you build and who it’s for, in two sentences."
            value={values.description}
            onChange={(event) => change("description", { description: event.target.value })}
            aria-invalid={errorFor("description") ? true : undefined}
            aria-describedby={describedBy("description", isLow("description"), errorFor("description"))}
            className={`${controlClass(isLow("description"), Boolean(errorFor("description")))} resize-y`}
          />
        </Field>

        <Field
          id="competitor-input"
          label="Top 3 competitors"
          low={isLow("competitors")}
          percent={percent("competitors")}
          error={errorFor("competitors")}
          hint={<span className="text-meta text-muted">Press Enter to add</span>}
        >
          <div
            className={`${groupClass(isLow("competitors"), Boolean(errorFor("competitors")))} flex-wrap items-center gap-2 px-3 py-2`}
          >
            {values.competitors.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded border border-line bg-slate-50 py-1 pl-2 pr-1 text-small text-ink"
              >
                {name}
                <input type="hidden" name="competitors" value={name} />
                <button
                  type="button"
                  onClick={() =>
                    change("competitors", {
                      competitors: values.competitors.filter((existing) => existing !== name),
                    })
                  }
                  aria-label={`Remove ${name}`}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-slate-100 hover:text-ink"
                >
                  <XIcon />
                </button>
              </span>
            ))}
            <input
              id="competitor-input"
              data-field="competitors"
              value={competitorInput}
              maxLength={60}
              disabled={competitorsFull}
              placeholder={competitorsFull ? "Up to 3 competitors" : "+ Add competitor"}
              onChange={(event) => setCompetitorInput(event.target.value)}
              onKeyDown={handleCompetitorKey}
              onBlur={addCompetitor}
              aria-describedby={describedBy("competitor-input", isLow("competitors"), errorFor("competitors"))}
              className="min-w-0 flex-1 bg-transparent py-1 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-0 disabled:cursor-not-allowed"
            />
          </div>
        </Field>
      </FormSection>

      {hasFieldErrors ? (
        <p
          role="alert"
          className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
        >
          Fix the highlighted fields to continue.
        </p>
      ) : null}
      {state.formError ? (
        <p
          role="alert"
          className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
        >
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/onboarding/founder" className={buttonStyles.ghost}>
          Back
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
