"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveThesis } from "@/app/onboarding/investor/actions";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  GlobeIcon,
  MapPinIcon,
  XIcon,
} from "@/components/icons";
import { formatRupees, lakhsToRupees } from "@/lib/currency";
import {
  MAX_NO_GOS,
  initialSaveThesisState,
  thesisToFormValues,
  validateThesis,
} from "@/lib/investor-profile";
import { geographies, investmentStages, investorSectors } from "@/lib/taxonomy";
import { buttonStyles } from "@/lib/ui";

import type { ThesisData } from "@/lib/api-types";
import type { ThesisField, ThesisFieldErrors, ThesisFormValues } from "@/lib/investor-profile";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";

type ListField = "sectors" | "stages" | "geographies";

const fieldOrder: readonly ThesisField[] = [
  "sectors",
  "stages",
  "cheque_min",
  "cheque_max",
  "geographies",
  "no_gos",
];

function chipClass(checked: boolean): string {
  const base =
    "inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-2 text-small transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald/30";
  return checked
    ? `${base} border-emerald-deep bg-emerald-deep font-medium text-white`
    : `${base} border-line bg-slate-50 text-ink hover:border-muted`;
}

function SectionLegend({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
}) {
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

type ChequeInputProps = {
  id: "cheque_min" | "cheque_max";
  name: string;
  label: string;
  example: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

function ChequeInput({ id, name, label, example, value, error, onChange }: ChequeInputProps) {
  const rupees = lakhsToRupees(value);
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-4">
      <label htmlFor={id} className="font-mono text-meta uppercase tracking-wider text-muted">
        {label}
      </label>
      <div
        className={`mt-2 flex items-stretch overflow-hidden rounded-md border bg-white focus-within:ring-2 focus-within:ring-emerald/30 ${
          error ? "border-alert-red" : "border-muted"
        }`}
      >
        <span aria-hidden="true" className="flex items-center pl-3 text-base text-muted">
          ₹
        </span>
        <input
          id={id}
          name={name}
          data-field={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder={example}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help`}
          className="w-full min-w-0 bg-transparent px-2 py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span aria-hidden="true" className="flex items-center pr-3 font-heading text-h4 text-ink">
          L
        </span>
      </div>
      <p id={`${id}-help`} className={`mt-2 text-meta ${error ? "text-alert-red" : "text-muted"}`}>
        {error ?? (rupees ? `₹${formatRupees(rupees)} per deal` : `In lakhs, e.g. ${example} for ₹${example}L`)}
      </p>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles.primary}>
      {pending ? "Saving…" : label}
      {pending ? null : <ArrowRightIcon />}
    </button>
  );
}

type InvestorThesisFormProps = {
  thesis: ThesisData | null;
  mode: "onboarding" | "edit";
};

export function InvestorThesisForm({ thesis, mode }: InvestorThesisFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<ThesisFormValues>(() => thesisToFormValues(thesis));
  const [clientErrors, setClientErrors] = useState<ThesisFieldErrors>({});
  const [changed, setChanged] = useState<ReadonlySet<ThesisField>>(() => new Set());
  const [noGoInput, setNoGoInput] = useState("");
  const [state, formAction] = useActionState(saveThesis, initialSaveThesisState);

  const errorFor = (field: ThesisField) =>
    changed.has(field) ? undefined : (clientErrors[field] ?? state.fieldErrors[field]);
  const hasFieldErrors = fieldOrder.some((field) => errorFor(field));

  function markChanged(field: ThesisField) {
    setChanged((current) => new Set(current).add(field));
  }

  function toggle(field: ListField, value: string) {
    setValues((current) => {
      const list = current[field];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [field]: next };
    });
    markChanged(field);
  }

  function setCheque(key: "cheque_min_lakhs" | "cheque_max_lakhs", value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    markChanged(key === "cheque_min_lakhs" ? "cheque_min" : "cheque_max");
    if (key === "cheque_min_lakhs") markChanged("cheque_max");
  }

  function addNoGo() {
    const tag = noGoInput.trim().replace(/,+$/, "").trim().toLowerCase().slice(0, 60);
    setNoGoInput("");
    if (tag.length < 2 || values.no_gos.includes(tag) || values.no_gos.length >= MAX_NO_GOS) return;
    setValues((current) => ({ ...current, no_gos: [...current.no_gos, tag] }));
    markChanged("no_gos");
  }

  function removeNoGo(tag: string) {
    setValues((current) => ({ ...current, no_gos: current.no_gos.filter((item) => item !== tag) }));
    markChanged("no_gos");
  }

  function handleNoGoKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addNoGo();
    } else if (event.key === "Backspace" && noGoInput === "" && values.no_gos.length > 0) {
      removeNoGo(values.no_gos[values.no_gos.length - 1]);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const result = validateThesis(values);
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
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <input type="hidden" name="mode" value={mode} />

      <fieldset aria-describedby={errorFor("sectors") ? "sectors-error" : undefined}>
        <SectionLegend
          title="Sectors"
          description="Select all that apply"
          aside={
            <span className="font-mono text-meta text-emerald-deep">
              {values.sectors.length} selected
            </span>
          }
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {investorSectors.map((sector, index) => {
            const checked = values.sectors.includes(sector);
            return (
              <label key={sector} className={chipClass(checked)}>
                <input
                  type="checkbox"
                  name="sectors"
                  value={sector}
                  checked={checked}
                  onChange={() => toggle("sectors", sector)}
                  data-field={index === 0 ? "sectors" : undefined}
                  className="sr-only"
                />
                {checked ? <CheckIcon className="h-4 w-4" /> : null}
                {sector}
              </label>
            );
          })}
        </div>
        <FieldError id="sectors-error" message={errorFor("sectors")} />
      </fieldset>

      <fieldset aria-describedby={errorFor("stages") ? "stages-error" : undefined}>
        <SectionLegend title="Stages" description="Investment stages you lead or participate in" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                    {stage.detail}
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

      <fieldset>
        <SectionLegend title="Cheque range" description="Typical ticket size per initial investment" />
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <ChequeInput
            id="cheque_min"
            name="cheque_min_lakhs"
            label="Minimum cheque"
            example="5"
            value={values.cheque_min_lakhs}
            error={errorFor("cheque_min")}
            onChange={(value) => setCheque("cheque_min_lakhs", value)}
          />
          <ChequeInput
            id="cheque_max"
            name="cheque_max_lakhs"
            label="Maximum cheque"
            example="50"
            value={values.cheque_max_lakhs}
            error={errorFor("cheque_max")}
            onChange={(value) => setCheque("cheque_max_lakhs", value)}
          />
        </div>
      </fieldset>

      <fieldset aria-describedby={errorFor("geographies") ? "geographies-error" : undefined}>
        <SectionLegend title="Geographies" description="Founders based in or registered in these regions" />
        <div className="mt-3 flex flex-wrap gap-2">
          {geographies.map((geography, index) => {
            const checked = values.geographies.includes(geography.value);
            const Icon = geography.kind === "city" ? MapPinIcon : GlobeIcon;
            return (
              <label key={geography.value} className={chipClass(checked)}>
                <input
                  type="checkbox"
                  name="geographies"
                  value={geography.value}
                  checked={checked}
                  onChange={() => toggle("geographies", geography.value)}
                  data-field={index === 0 ? "geographies" : undefined}
                  className="sr-only"
                />
                <Icon className="h-4 w-4" />
                {geography.label}
              </label>
            );
          })}
        </div>
        <FieldError id="geographies-error" message={errorFor("geographies")} />
      </fieldset>

      <div>
        <label htmlFor="no_gos" className="block">
          <span className="block text-base font-semibold text-ink">No-gos</span>
          <span className="block text-small text-muted">
            Sectors or topics you never invest in
          </span>
        </label>
        <div
          className={`mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-emerald/30 ${
            errorFor("no_gos") ? "border-alert-red" : "border-muted"
          }`}
        >
          {values.no_gos.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded border border-alert-red/20 bg-alert-red/5 py-1 pl-2 pr-1 text-small text-alert-red"
            >
              {tag}
              <input type="hidden" name="no_gos" value={tag} />
              <button
                type="button"
                onClick={() => removeNoGo(tag)}
                aria-label={`Remove ${tag}`}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-alert-red/10"
              >
                <XIcon />
              </button>
            </span>
          ))}
          <input
            id="no_gos"
            data-field="no_gos"
            value={noGoInput}
            maxLength={60}
            disabled={values.no_gos.length >= MAX_NO_GOS}
            placeholder={values.no_gos.length > 0 ? "Add another" : "e.g. gambling, tobacco"}
            onChange={(event) => setNoGoInput(event.target.value)}
            onKeyDown={handleNoGoKey}
            onBlur={addNoGo}
            aria-describedby="no_gos-help"
            className="min-w-0 flex-1 bg-transparent py-1 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-0 disabled:cursor-not-allowed"
          />
        </div>
        <p id="no_gos-help" className={`mt-2 text-meta ${errorFor("no_gos") ? "text-alert-red" : "text-muted"}`}>
          {errorFor("no_gos") ?? "Press Enter or comma to add. Founders in these areas won’t be matched to you."}
        </p>
      </div>

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

      <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-meta text-muted">
          Your thesis is only used to filter and rank founder matches.
        </p>
        <SubmitButton label={mode === "edit" ? "Save changes" : "Save & continue"} />
      </div>
    </form>
  );
}
