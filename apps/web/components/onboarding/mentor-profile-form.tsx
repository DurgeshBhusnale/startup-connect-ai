"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveMentorProfile } from "@/app/onboarding/mentor/actions";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  ClockIcon,
  LinkedinIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "@/components/icons";
import {
  HIGH_SESSION_FEE,
  MAX_MENTOR_STAGES,
  initialSaveMentorState,
  mentorToFormValues,
  parseSessionFee,
  validateMentorProfile,
} from "@/lib/mentor-profile";
import { expertiseAreas, investmentStages, mentorAvailabilityOptions } from "@/lib/taxonomy";
import { buttonStyles } from "@/lib/ui";

import type {
  InvestmentStage,
  MentorExpertiseData,
  MentorVerificationState,
} from "@/lib/api-types";
import type { MentorField, MentorFieldErrors, MentorFormValues } from "@/lib/mentor-profile";
import type { FormEvent, ReactNode } from "react";

const stageDetails: Record<InvestmentStage, string> = {
  "pre-seed": "Ideation to first MVP",
  seed: "Early traction & pilot customers",
  "series-a": "Repeatable scale & expansion",
  "series-b-plus": "Multi-market growth",
};

const fieldOrder: readonly MentorField[] = [
  "areas",
  "stages",
  "availability",
  "session_fee",
  "linkedin_url",
  "reference_emails",
];

const alertClass =
  "rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red";

function chipClass(checked: boolean): string {
  const base =
    "inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-2 text-small transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald/30";
  return checked
    ? `${base} border-emerald-deep bg-emerald-deep font-medium text-white`
    : `${base} border-line bg-slate-50 text-ink hover:border-muted`;
}

function inputGroupClass(invalid: boolean): string {
  return `flex items-stretch overflow-hidden rounded-md border bg-white focus-within:ring-2 focus-within:ring-emerald/30 ${
    invalid ? "border-alert-red" : "border-muted"
  }`;
}

const bareInputClass =
  "w-full min-w-0 bg-transparent px-3 py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-0";

function Legend({ title, description, aside }: { title: string; description: string; aside?: ReactNode }) {
  return (
    <legend className="flex w-full flex-wrap items-end justify-between gap-2">
      <span>
        <span className="block text-base font-semibold text-ink">{title}</span>
        <span className="block text-small text-muted">{description}</span>
      </span>
      {aside}
    </legend>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-2 text-meta text-alert-red">
      {message}
    </p>
  ) : null;
}

function FormButtons({ mode, showSkip }: { mode: "onboarding" | "edit"; showSkip: boolean }) {
  const { pending } = useFormStatus();
  // Save comes first in the DOM so pressing Enter never triggers "Skip".
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row-reverse sm:items-center sm:justify-between">
      <button type="submit" name="intent" value="save" disabled={pending} className={buttonStyles.primary}>
        {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save profile"}
        {pending ? null : <ArrowRightIcon />}
      </button>
      {mode === "edit" ? (
        <Link href="/profile" className={buttonStyles.ghost}>
          Cancel
        </Link>
      ) : showSkip ? (
        <button type="submit" name="intent" value="skip" disabled={pending} className={buttonStyles.ghost}>
          Skip verification for now
        </button>
      ) : null}
    </div>
  );
}

type MentorProfileFormProps = {
  expertise: MentorExpertiseData | null;
  verification: MentorVerificationState | null;
  mode: "onboarding" | "edit";
};

export function MentorProfileForm({ expertise, verification, mode }: MentorProfileFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingSubmitter = useRef<HTMLElement | null>(null);
  const unlimitedConfirmed = useRef(false);

  const [values, setValues] = useState<MentorFormValues>(() => mentorToFormValues(expertise));
  const [clientErrors, setClientErrors] = useState<MentorFieldErrors>({});
  const [changed, setChanged] = useState<ReadonlySet<MentorField>>(() => new Set());
  const [state, formAction] = useActionState(saveMentorProfile, initialSaveMentorState);

  const showVerification = verification === null;
  const errorFor = (field: MentorField) =>
    changed.has(field) ? undefined : (clientErrors[field] ?? state.fieldErrors[field]);
  const hasFieldErrors = fieldOrder.some((field) => errorFor(field));
  const fee = parseSessionFee(values.session_fee);
  const highFee = fee.ok && fee.fee !== null && fee.fee > HIGH_SESSION_FEE;

  function markChanged(field: MentorField) {
    setChanged((current) => new Set(current).add(field));
  }

  function update(field: MentorField, patch: Partial<MentorFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    markChanged(field);
  }

  function toggle(field: "areas" | "stages", value: string) {
    setValues((current) => {
      const list = current[field];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [field]: next };
    });
    markChanged(field);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const includeVerification = showVerification && submitter?.getAttribute("value") !== "skip";
    const result = validateMentorProfile(values, includeVerification);
    setChanged(new Set());
    if (result.errors) {
      event.preventDefault();
      setClientErrors(result.errors);
      const firstInvalid = fieldOrder.find((field) => result.errors[field]);
      if (firstInvalid) {
        formRef.current?.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`)?.focus();
      }
      return;
    }
    setClientErrors({});

    const needsConfirmation =
      values.availability === "unlimited" &&
      expertise?.availability !== "unlimited" &&
      !unlimitedConfirmed.current;
    if (needsConfirmation) {
      event.preventDefault();
      pendingSubmitter.current = submitter;
      dialogRef.current?.showModal();
    }
  }

  function confirmUnlimited() {
    unlimitedConfirmed.current = true;
    dialogRef.current?.close();
    formRef.current?.requestSubmit(pendingSubmitter.current);
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="include_verification" value={showVerification ? "true" : "false"} />

      <fieldset aria-describedby={errorFor("areas") ? "areas-error" : undefined}>
        <Legend
          title="Expertise areas"
          description="Select all that apply"
          aside={<span className="font-mono text-meta text-emerald-deep">{values.areas.length} selected</span>}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {expertiseAreas.map((area, index) => {
            const checked = values.areas.includes(area);
            return (
              <label key={area} className={chipClass(checked)}>
                <input
                  type="checkbox"
                  name="areas"
                  value={area}
                  checked={checked}
                  onChange={() => toggle("areas", area)}
                  data-field={index === 0 ? "areas" : undefined}
                  className="sr-only"
                />
                {area}
                {checked ? <CheckIcon className="h-4 w-4" /> : null}
              </label>
            );
          })}
        </div>
        <FieldError id="areas-error" message={errorFor("areas")} />
      </fieldset>

      <fieldset aria-describedby={errorFor("stages") ? "stages-error" : undefined}>
        <Legend
          title="Stage focus"
          description={`Select up to ${MAX_MENTOR_STAGES} stages where you provide the most value`}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {investmentStages.map((stage, index) => {
            const checked = values.stages.includes(stage.value);
            return (
              <label
                key={stage.value}
                className={`flex cursor-pointer items-start justify-between gap-2 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald/30 ${
                  checked ? "border-emerald bg-emerald/10" : "border-line bg-slate-50 hover:border-muted"
                }`}
              >
                <input
                  type="checkbox"
                  name="stages"
                  value={stage.value}
                  checked={checked}
                  onChange={() => toggle("stages", stage.value)}
                  data-field={index === 0 ? "stages" : undefined}
                  className="sr-only"
                />
                <span>
                  <span className={`block text-base font-semibold ${checked ? "text-emerald-deep" : "text-ink"}`}>
                    {stage.label}
                  </span>
                  <span
                    className={`mt-1 block font-mono text-meta uppercase tracking-wider ${
                      checked ? "text-emerald-deep" : "text-muted"
                    }`}
                  >
                    {stageDetails[stage.value]}
                  </span>
                </span>
                {checked ? (
                  <CircleCheckIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
                ) : (
                  <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-muted" />
                )}
              </label>
            );
          })}
        </div>
        <FieldError id="stages-error" message={errorFor("stages")} />
      </fieldset>

      <div>
        <label htmlFor="availability" className="block text-base font-semibold text-ink">
          How often would you like to meet founders?
        </label>
        <div className="relative mt-3">
          <select
            id="availability"
            name="availability"
            data-field="availability"
            value={values.availability}
            onChange={(event) => {
              unlimitedConfirmed.current = false;
              update("availability", { availability: event.target.value });
            }}
            aria-invalid={errorFor("availability") ? true : undefined}
            aria-describedby={errorFor("availability") ? "availability-error" : undefined}
            className={`w-full appearance-none rounded-md border bg-white px-3 py-3 pr-12 text-base text-ink ${
              errorFor("availability") ? "border-alert-red" : "border-muted"
            }`}
          >
            {mentorAvailabilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
        <FieldError id="availability-error" message={errorFor("availability")} />
      </div>

      <div>
        <label htmlFor="session_fee" className="block text-base font-semibold text-ink">
          Session fee <span className="font-normal text-muted">(optional)</span>
        </label>
        <div className={`mt-3 ${inputGroupClass(Boolean(errorFor("session_fee")))}`}>
          <span aria-hidden="true" className="flex items-center border-r border-line bg-slate-50 px-3 text-base text-muted">
            ₹
          </span>
          <input
            id="session_fee"
            name="session_fee"
            data-field="session_fee"
            inputMode="numeric"
            placeholder="Leave blank for free"
            value={values.session_fee}
            onChange={(event) => update("session_fee", { session_fee: event.target.value })}
            aria-invalid={errorFor("session_fee") ? true : undefined}
            aria-describedby="session_fee-help"
            className={bareInputClass}
          />
        </div>
        <p
          id="session_fee-help"
          className={`mt-2 flex items-start gap-2 text-meta ${errorFor("session_fee") ? "text-alert-red" : highFee ? "text-ink" : "text-muted"}`}
        >
          {errorFor("session_fee") ?? (
            highFee ? (
              <>
                <TriangleAlertIcon className="h-4 w-4 shrink-0 text-alert-amber" />
                Most founders don’t pay for mentorship on this platform. Consider making it free or
                lower to increase acceptance.
              </>
            ) : (
              "Most mentors are free. If you charge, we suggest ₹500–₹2,000 per session."
            )
          )}
        </p>
      </div>

      {showVerification ? (
        <fieldset className="rounded-lg border border-line bg-slate-50 p-4 sm:p-6">
          <legend className="sr-only">Verification</legend>
          <p className="flex items-center gap-2 text-base font-semibold text-ink">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-deep" />
            Get verified
          </p>
          <p className="mt-1 text-small text-muted">
            Verification helps founders trust your profile. We review each request before a
            verified badge appears. Choose one:
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex cursor-pointer flex-col gap-3 rounded-md border border-line bg-white p-4 has-[:checked]:border-emerald has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald/30">
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="verification_method"
                  value="linkedin"
                  checked={values.verification_method === "linkedin"}
                  onChange={() => update("linkedin_url", { verification_method: "linkedin" })}
                  className="mt-1 h-4 w-4 shrink-0 accent-emerald-deep"
                />
                <span>
                  <span className="flex flex-wrap items-center gap-2 text-base font-medium text-ink">
                    Link my LinkedIn
                    <span className="rounded bg-emerald/10 px-2 py-1 font-mono text-meta text-emerald-deep">
                      Recommended
                    </span>
                  </span>
                  <span className="mt-1 block text-small text-muted">
                    We’ll check your profile against the expertise you’ve listed.
                  </span>
                </span>
              </span>
            </label>
            {values.verification_method === "linkedin" ? (
              <div className="-mt-1 pl-4">
                <label htmlFor="linkedin_url" className="sr-only">
                  LinkedIn profile URL
                </label>
                <div className={inputGroupClass(Boolean(errorFor("linkedin_url")))}>
                  <span aria-hidden="true" className="flex items-center pl-3 text-ink">
                    <LinkedinIcon className="h-4 w-4" />
                  </span>
                  <input
                    id="linkedin_url"
                    name="linkedin_url"
                    data-field="linkedin_url"
                    inputMode="url"
                    placeholder="https://linkedin.com/in/yourname"
                    value={values.linkedin_url}
                    onChange={(event) => update("linkedin_url", { linkedin_url: event.target.value })}
                    aria-invalid={errorFor("linkedin_url") ? true : undefined}
                    aria-describedby={errorFor("linkedin_url") ? "linkedin_url-error" : undefined}
                    className={bareInputClass}
                  />
                </div>
                <FieldError id="linkedin_url-error" message={errorFor("linkedin_url")} />
              </div>
            ) : null}

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-white p-4 has-[:checked]:border-emerald has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald/30">
              <input
                type="radio"
                name="verification_method"
                value="references"
                checked={values.verification_method === "references"}
                onChange={() => update("reference_emails", { verification_method: "references" })}
                className="mt-1 h-4 w-4 shrink-0 accent-emerald-deep"
              />
              <span>
                <span className="block text-base font-medium text-ink">
                  Provide 2 founder references
                </span>
                <span className="mt-1 block text-small text-muted">
                  Emails of founders you’ve mentored. We won’t contact them until reference checks
                  launch.
                </span>
              </span>
            </label>
            {values.verification_method === "references" ? (
              <div className="-mt-1 grid gap-3 pl-4 sm:grid-cols-2">
                {(["reference_email_1", "reference_email_2"] as const).map((name, index) => (
                  <div key={name}>
                    <label htmlFor={name} className="text-meta text-muted">
                      Founder {index + 1} email
                    </label>
                    <input
                      id={name}
                      name={name}
                      type="email"
                      autoComplete="off"
                      data-field={index === 0 ? "reference_emails" : undefined}
                      placeholder={index === 0 ? "riya@rupeez.in" : "karan@buildkit.in"}
                      value={values[name]}
                      onChange={(event) => update("reference_emails", { [name]: event.target.value })}
                      aria-invalid={errorFor("reference_emails") ? true : undefined}
                      aria-describedby={errorFor("reference_emails") ? "reference_emails-error" : undefined}
                      className={`mt-1 w-full rounded-md border bg-white px-3 py-3 text-base text-ink placeholder:text-muted ${
                        errorFor("reference_emails") ? "border-alert-red" : "border-muted"
                      }`}
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <FieldError id="reference_emails-error" message={errorFor("reference_emails")} />
                </div>
              </div>
            ) : null}
          </div>
        </fieldset>
      ) : (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-line bg-slate-50 p-4">
          <ClockIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-deep" />
          <p className="text-small text-ink">
            Verification requested via{" "}
            {verification.method === "linkedin" ? "LinkedIn" : "founder references"} — pending
            review.
          </p>
        </div>
      )}

      <p className="flex items-start gap-2 text-meta text-muted">
        <ShieldCheckIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
        Founders only see your profile after they’re matched with you.
      </p>

      {hasFieldErrors ? (
        <p role="alert" className={alertClass}>
          Fix the highlighted fields to continue.
        </p>
      ) : null}
      {state.formError ? (
        <p role="alert" className={alertClass}>
          {state.formError}
        </p>
      ) : null}

      <FormButtons mode={mode} showSkip={showVerification} />

      <dialog
        ref={dialogRef}
        aria-labelledby="unlimited-title"
        aria-describedby="unlimited-body"
        className="w-full max-w-modal rounded-xl border border-line bg-white p-6 text-ink shadow-card backdrop:bg-ink/40"
      >
        <h2 id="unlimited-title" className="text-h3">
          Set unlimited availability?
        </h2>
        <p id="unlimited-body" className="mt-2 text-small text-muted">
          Setting unlimited availability means high volume of matches. Are you sure? You can update
          anytime.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => dialogRef.current?.close()} className={buttonStyles.secondary}>
            Go back
          </button>
          <button type="button" onClick={confirmUnlimited} className={buttonStyles.primary}>
            Yes, keep unlimited
          </button>
        </div>
      </dialog>
    </form>
  );
}
