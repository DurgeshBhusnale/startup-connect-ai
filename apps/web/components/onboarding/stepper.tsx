import { CheckIcon } from "@/components/icons";

// Founder steps 3–4 (momentum sources, first post) ship with M5/M4.
const flows = {
  founder: ["Your deck", "Review"],
  investor: ["Thesis", "Prior investments"],
} as const;

type OnboardingStepperProps = {
  flow: keyof typeof flows;
  current: 1 | 2;
};

export function OnboardingStepper({ flow, current }: OnboardingStepperProps) {
  const steps = flows[flow];
  return (
    <div className="flex flex-col items-center gap-3">
      <ol aria-label="Onboarding progress" className="flex items-center">
        {steps.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          return (
            <li key={label} className="flex items-center" aria-current={active ? "step" : undefined}>
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={`h-px w-12 sm:w-16 ${done || active ? "bg-emerald" : "bg-line"}`}
                />
              ) : null}
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-small font-semibold ${
                  done
                    ? "bg-emerald-deep text-white"
                    : active
                      ? "bg-ink text-white ring-4 ring-emerald/20"
                      : "border border-line bg-white text-muted"
                }`}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : <span aria-hidden="true">{step}</span>}
                <span className="sr-only">{`Step ${step}: ${label}${done ? " (completed)" : ""}`}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="rounded-full bg-emerald/10 px-3 py-1 font-mono text-meta uppercase tracking-wider text-emerald-deep">
        Step {current} of {steps.length} · {steps[current - 1]}
      </p>
    </div>
  );
}
