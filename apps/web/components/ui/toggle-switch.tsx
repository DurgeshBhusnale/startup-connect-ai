"use client";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Id of the visible label element; use `label` when there is none. */
  labelledBy?: string;
  label?: string;
};

export function ToggleSwitch({ checked, onChange, disabled, labelledBy, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "justify-end bg-emerald" : "justify-start bg-muted"
      }`}
    >
      <span aria-hidden="true" className="h-4 w-4 rounded-full bg-white shadow-card" />
    </button>
  );
}
