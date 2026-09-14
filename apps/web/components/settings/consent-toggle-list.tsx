"use client";

import { useId, useState, useTransition } from "react";

import { updateConsent } from "@/app/(app)/settings/actions";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { consentCopy } from "@/lib/privacy";
import { buttonStyles } from "@/lib/ui";

import type { ConsentItem, ConsentScope } from "@/lib/api-types";

export function ConsentToggleList({ items }: { items: ConsentItem[] }) {
  const idPrefix = useId();
  const [granted, setGranted] = useState<Partial<Record<ConsentScope, boolean>>>(() =>
    Object.fromEntries(items.map((item) => [item.scope, item.granted])),
  );
  const [confirmingPause, setConfirmingPause] = useState(false);
  const [busyScope, setBusyScope] = useState<ConsentScope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const commit = (scope: ConsentScope, next: boolean) => {
    const previous = granted[scope] ?? false;
    setError(null);
    setConfirmingPause(false);
    setGranted((current) => ({ ...current, [scope]: next }));
    setBusyScope(scope);
    startTransition(async () => {
      const result = await updateConsent(scope, next);
      setBusyScope(null);
      if (!result.ok) {
        setGranted((current) => ({ ...current, [scope]: previous }));
        setError(result.error);
      }
    });
  };

  const change = (scope: ConsentScope, next: boolean) => {
    // Withdrawing matching consent hides the profile (PRD M10 edge case), so confirm first.
    if (scope === "match_processing" && !next) {
      setConfirmingPause(true);
      return;
    }
    commit(scope, next);
  };

  return (
    <div>
      <ul className="divide-y divide-line">
        {items.map((item) => {
          const copy = consentCopy[item.scope];
          const labelId = `${idPrefix}-${item.scope}`;
          return (
            <li key={item.scope} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p
                    id={labelId}
                    className="flex flex-wrap items-center gap-2 text-small font-medium text-ink"
                  >
                    {copy.title}
                    {item.withdrawable ? null : (
                      <span className="rounded bg-slate-100 px-2 py-1 font-mono text-meta font-normal uppercase tracking-wider text-ink">
                        Required
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-small text-muted">{copy.body}</p>
                </div>
                <ToggleSwitch
                  checked={granted[item.scope] ?? false}
                  disabled={!item.withdrawable || busyScope !== null}
                  labelledBy={labelId}
                  onChange={(next) => change(item.scope, next)}
                />
              </div>
              {item.scope === "match_processing" && confirmingPause ? (
                <div
                  aria-live="polite"
                  className="mt-4 rounded-md border border-alert-amber bg-alert-amber/10 p-4"
                >
                  <p className="text-small font-medium text-ink">Pause matching?</p>
                  <p className="mt-1 text-small text-ink">
                    Your profile will be hidden, matching stops, and pending intros are paused until
                    you turn this back on.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => commit("match_processing", false)}
                      className={buttonStyles.primary}
                    >
                      Pause matching
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingPause(false)}
                      className={buttonStyles.ghost}
                    >
                      Keep matching on
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="mt-2 text-small text-alert-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
