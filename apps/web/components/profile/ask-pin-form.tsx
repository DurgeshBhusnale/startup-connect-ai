"use client";

import { useId, useState, useTransition } from "react";

import { clearAskPin, saveAskPin } from "@/app/(app)/profile/ask-pin-actions";
import { ASK_PIN_MAX, normalizeAskPin } from "@/lib/ask-pin";
import { buttonStyles } from "@/lib/ui";

type AskPinFormProps = {
  initialText: string | null;
};

export function AskPinForm({ initialText }: AskPinFormProps) {
  const inputId = useId();
  const hintId = useId();
  const [saved, setSaved] = useState(initialText ?? "");
  const [value, setValue] = useState(initialText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const normalized = normalizeAskPin(value);
  const tooLong = normalized.length > ASK_PIN_MAX;
  const dirty = normalized !== saved;

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    if (!normalized) {
      setError("Write what you’re asking for, or clear the pin.");
      return;
    }
    if (tooLong) {
      setError(`Keep your ask to ${ASK_PIN_MAX} characters or fewer.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveAskPin(normalized);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const text = result.data.ask_pin ?? "";
      setSaved(text);
      setValue(text);
      setStatus("Pinned to the top of your profile.");
    });
  };

  const clear = () => {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      const result = await clearAskPin();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved("");
      setValue("");
      setStatus("Ask removed from your profile.");
    });
  };

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-small font-medium text-ink">
          Currently asking for
        </label>
        <span
          className={`font-mono text-meta ${tooLong ? "text-alert-red" : "text-muted"}`}
          aria-live="polite"
        >
          {normalized.length}/{ASK_PIN_MAX}
        </span>
      </div>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setStatus(null);
        }}
        placeholder="Intros to D2C brands in Pune for our receivables pilot"
        aria-invalid={error || tooLong ? true : undefined}
        aria-describedby={hintId}
        className="w-full rounded-md border border-muted px-3 py-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-emerald/30"
      />
      <p id={hintId} className="text-meta text-muted">
        One line, up to {ASK_PIN_MAX} characters. Shown at the top of your profile to everyone
        who can see it.
      </p>

      {error ? (
        <p role="alert" className="text-meta text-alert-red">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-meta text-emerald-deep">
          {status}
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {saved ? (
          <button type="button" onClick={clear} disabled={isPending} className={buttonStyles.ghost}>
            Clear ask
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isPending || !dirty || tooLong}
          className={buttonStyles.primary}
        >
          {isPending ? "Saving…" : saved ? "Update ask" : "Pin ask"}
        </button>
      </div>
    </form>
  );
}
