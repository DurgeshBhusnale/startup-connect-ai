"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  savePriorInvestments,
  skipPriorInvestments,
} from "@/app/onboarding/investor/prior-investments/actions";
import { ArrowRightIcon, GlobeIcon, PlusCircleIcon, TrashIcon } from "@/components/icons";
import {
  MAX_PRIOR_INVESTMENTS,
  MIN_PRIOR_INVESTMENTS,
  emptyRow,
  initialSavePriorInvestmentsState,
  isBlankRow,
  itemToRow,
  validatePriorInvestments,
} from "@/lib/investor-profile";
import { investmentStages, sectors } from "@/lib/taxonomy";
import { buttonStyles } from "@/lib/ui";

import type { PriorInvestmentItem } from "@/lib/api-types";
import type {
  InvestmentRow,
  InvestmentRowField,
  SavePriorInvestmentsState,
} from "@/lib/investor-profile";
import type { FormEvent } from "react";

const rowGrid =
  "md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_3rem]";

function cellClass(invalid: boolean): string {
  return `w-full rounded-md border bg-white px-3 py-2 text-small text-ink placeholder:text-muted ${
    invalid ? "border-alert-red" : "border-muted"
  }`;
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

type PriorInvestmentsFormProps = {
  initialItems: PriorInvestmentItem[];
  hideChequeAmounts: boolean;
  crunchbaseUrl: string | null;
  completed: boolean;
};

export function PriorInvestmentsForm({
  initialItems,
  hideChequeAmounts,
  crunchbaseUrl,
  completed,
}: PriorInvestmentsFormProps) {
  const [rows, setRows] = useState<InvestmentRow[]>(() =>
    initialItems.length > 0
      ? initialItems.map((item, index) => itemToRow(item, `row-${index}`))
      : Array.from({ length: MIN_PRIOR_INVESTMENTS }, (_, index) => emptyRow(`row-${index}`)),
  );
  const nextKey = useRef(Math.max(initialItems.length, MIN_PRIOR_INVESTMENTS));
  const [hideCheques, setHideCheques] = useState(hideChequeAmounts);
  const [crunchbase, setCrunchbase] = useState(crunchbaseUrl ?? "");
  const [crunchbaseChanged, setCrunchbaseChanged] = useState(false);
  const [changedRows, setChangedRows] = useState<ReadonlySet<string>>(() => new Set());
  const [clientResult, setClientResult] = useState<SavePriorInvestmentsState | null>(null);
  const [state, formAction] = useActionState(savePriorInvestments, initialSavePriorInvestmentsState);

  const shown = clientResult ?? state;
  const rowError = (key: string, field: InvestmentRowField) =>
    changedRows.has(key) ? undefined : shown.rowErrors[key]?.[field];
  const crunchbaseError = crunchbaseChanged ? null : shown.crunchbaseError;
  const filledCount = rows.filter((row) => !isBlankRow(row)).length;

  function newKey(): string {
    const key = `row-${nextKey.current}`;
    nextKey.current += 1;
    return key;
  }

  function updateRow(key: string, patch: Partial<InvestmentRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setChangedRows((current) => new Set(current).add(key));
  }

  function addRow() {
    if (rows.length >= MAX_PRIOR_INVESTMENTS) return;
    setRows((current) => [...current, emptyRow(newKey())]);
  }

  function removeRow(key: string) {
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.key !== key) : [emptyRow(newKey())],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter?.dataset.intent === "skip") return;

    const result = validatePriorInvestments(rows, {
      hideChequeAmounts: hideCheques,
      crunchbaseUrl: crunchbase,
      currentYear: new Date().getFullYear(),
    });
    setChangedRows(new Set());
    setCrunchbaseChanged(false);
    if (!result.data) {
      event.preventDefault();
      setClientResult({
        rowErrors: result.rowErrors,
        formError: result.formError,
        crunchbaseError: result.crunchbaseError,
      });
      return;
    }
    setClientResult(null);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <input type="hidden" name="entries_json" value={JSON.stringify(rows)} />

      <section aria-labelledby="deals-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="deals-heading" className="font-sans text-base font-semibold text-ink">
            Add your deals
          </h2>
          <p className="font-mono text-meta text-muted">
            {filledCount} added · {MIN_PRIOR_INVESTMENTS}–{MAX_PRIOR_INVESTMENTS} needed
          </p>
        </div>
        <p className="text-small text-muted">
          Add companies you’ve invested in. Cheque size is optional, like 15L or 1.2Cr.
        </p>

        <div className="overflow-hidden rounded-lg border border-line">
          <div
            aria-hidden="true"
            className={`hidden gap-3 bg-slate-50 px-4 py-3 font-mono text-meta uppercase tracking-wider text-ink md:grid ${rowGrid}`}
          >
            <span>Company</span>
            <span>Sector</span>
            <span>Stage</span>
            <span>Cheque</span>
            <span>Year</span>
            <span />
          </div>
          <ol className="divide-y divide-line">
            {rows.map((row, index) => {
              const ids = {
                company: `${row.key}-company`,
                sector: `${row.key}-sector`,
                stage: `${row.key}-stage`,
                cheque: `${row.key}-cheque`,
                year: `${row.key}-year`,
              };
              return (
                <li key={row.key} className={`grid grid-cols-2 gap-3 p-4 md:items-start ${rowGrid}`}>
                  <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
                    <label htmlFor={ids.company} className="text-meta text-muted md:sr-only">
                      Company
                    </label>
                    <input
                      id={ids.company}
                      value={row.company}
                      maxLength={120}
                      placeholder="e.g. Khatabook"
                      onChange={(event) => updateRow(row.key, { company: event.target.value })}
                      aria-invalid={rowError(row.key, "company") ? true : undefined}
                      className={cellClass(Boolean(rowError(row.key, "company")))}
                    />
                    {rowError(row.key, "company") ? (
                      <p className="text-meta text-alert-red">{rowError(row.key, "company")}</p>
                    ) : null}
                  </div>
                  <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
                    <label htmlFor={ids.sector} className="text-meta text-muted md:sr-only">
                      Sector
                    </label>
                    <select
                      id={ids.sector}
                      value={row.sector}
                      onChange={(event) => updateRow(row.key, { sector: event.target.value })}
                      aria-invalid={rowError(row.key, "sector") ? true : undefined}
                      className={cellClass(Boolean(rowError(row.key, "sector")))}
                    >
                      <option value="">Select…</option>
                      {sectors.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                    {rowError(row.key, "sector") ? (
                      <p className="text-meta text-alert-red">{rowError(row.key, "sector")}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={ids.stage} className="text-meta text-muted md:sr-only">
                      Stage
                    </label>
                    <select
                      id={ids.stage}
                      value={row.stage}
                      onChange={(event) => updateRow(row.key, { stage: event.target.value })}
                      aria-invalid={rowError(row.key, "stage") ? true : undefined}
                      className={cellClass(Boolean(rowError(row.key, "stage")))}
                    >
                      <option value="">Select…</option>
                      {investmentStages.map((stage) => (
                        <option key={stage.value} value={stage.value}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                    {rowError(row.key, "stage") ? (
                      <p className="text-meta text-alert-red">{rowError(row.key, "stage")}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={ids.cheque} className="text-meta text-muted md:sr-only">
                      Cheque (optional)
                    </label>
                    <input
                      id={ids.cheque}
                      value={row.cheque}
                      inputMode="decimal"
                      placeholder="₹15L"
                      onChange={(event) => updateRow(row.key, { cheque: event.target.value })}
                      aria-invalid={rowError(row.key, "cheque") ? true : undefined}
                      className={cellClass(Boolean(rowError(row.key, "cheque")))}
                    />
                    {rowError(row.key, "cheque") ? (
                      <p className="text-meta text-alert-red">{rowError(row.key, "cheque")}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={ids.year} className="text-meta text-muted md:sr-only">
                      Year
                    </label>
                    <input
                      id={ids.year}
                      value={row.year}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder={String(new Date().getFullYear())}
                      onChange={(event) => updateRow(row.key, { year: event.target.value })}
                      aria-invalid={rowError(row.key, "year") ? true : undefined}
                      className={cellClass(Boolean(rowError(row.key, "year")))}
                    />
                    {rowError(row.key, "year") ? (
                      <p className="text-meta text-alert-red">{rowError(row.key, "year")}</p>
                    ) : null}
                  </div>
                  <div className="flex items-end justify-end md:items-start">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove investment ${index + 1}`}
                      className="flex h-12 w-12 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-alert-red md:h-8 md:w-8"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= MAX_PRIOR_INVESTMENTS}
            className="flex w-full items-center justify-center gap-2 border-t border-line bg-slate-50 px-4 py-3 text-small font-medium text-emerald-deep hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-muted"
          >
            <PlusCircleIcon />
            {rows.length >= MAX_PRIOR_INVESTMENTS
              ? `Up to ${MAX_PRIOR_INVESTMENTS} investments`
              : "Add another investment"}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <label htmlFor="crunchbase_url" className="text-small font-medium text-ink">
          Crunchbase profile <span className="font-normal text-muted">(optional)</span>
        </label>
        <div
          className={`flex items-center gap-2 rounded-md border bg-white px-3 focus-within:ring-2 focus-within:ring-emerald/30 ${
            crunchbaseError ? "border-alert-red" : "border-muted"
          }`}
        >
          <GlobeIcon className="h-4 w-4 shrink-0 text-muted" />
          <input
            id="crunchbase_url"
            name="crunchbase_url"
            inputMode="url"
            placeholder="https://www.crunchbase.com/person/your-name"
            value={crunchbase}
            onChange={(event) => {
              setCrunchbase(event.target.value);
              setCrunchbaseChanged(true);
            }}
            aria-invalid={crunchbaseError ? true : undefined}
            aria-describedby="crunchbase-help"
            className="w-full min-w-0 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-0"
          />
        </div>
        <p
          id="crunchbase-help"
          className={`text-meta ${crunchbaseError ? "text-alert-red" : "text-muted"}`}
        >
          {crunchbaseError ??
            "We save this link on your profile. Automatic import from Crunchbase isn’t available yet."}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-slate-50 p-4">
        <input
          type="checkbox"
          name="hide_cheque_amounts"
          checked={hideCheques}
          onChange={(event) => setHideCheques(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-emerald-deep"
        />
        <span>
          <span className="block text-base font-medium text-ink">
            Hide cheque amounts from founders
          </span>
          <span className="mt-1 block text-small text-muted">
            Only stage and sector will show on your profile. Exact cheque sizes stay private.
          </span>
        </span>
      </label>

      {shown.formError ? (
        <p
          role="alert"
          className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
        >
          {shown.formError}
        </p>
      ) : null}

      {/* Save comes first in the DOM so pressing Enter in a row never triggers "Skip for now". */}
      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row-reverse sm:items-center sm:justify-between">
        <SubmitButton label={completed ? "Save investments" : "Save & complete setup"} />
        {completed ? (
          <Link href="/home" className={buttonStyles.ghost}>
            Cancel
          </Link>
        ) : (
          <button
            type="submit"
            formAction={skipPriorInvestments}
            formNoValidate
            data-intent="skip"
            className={buttonStyles.ghost}
          >
            Skip for now
          </button>
        )}
      </div>
    </form>
  );
}
