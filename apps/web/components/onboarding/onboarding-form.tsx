"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { completeOnboarding } from "@/app/onboarding/actions";
import {
  ArrowRightIcon,
  BanknoteIcon,
  CircleCheckIcon,
  LightbulbIcon,
  RocketIcon,
} from "@/components/icons";
import { initialOnboardingState } from "@/lib/onboarding";
import { buttonStyles } from "@/lib/ui";

import type { IconComponent } from "@/components/icons";
import type { AppRole } from "@/lib/api-types";
import type { ReactNode } from "react";

const roleOptions: ReadonlyArray<{
  value: AppRole;
  title: string;
  description: string;
  icon: IconComponent;
}> = [
  {
    value: "founder",
    title: "I’m a founder",
    description: "Building a startup, looking for investors and mentors.",
    icon: RocketIcon,
  },
  {
    value: "investor",
    title: "I’m an investor",
    description: "Angel or micro-VC looking for pre-filtered deal flow.",
    icon: BanknoteIcon,
  },
  {
    value: "mentor",
    title: "I’m a mentor",
    description: "Sector expert offering guidance to early-stage founders.",
    icon: LightbulbIcon,
  },
];

const legalLinkClass = "font-medium text-emerald-deep underline-offset-2 hover:underline";

const consentOptions: ReadonlyArray<{ name: string; required: boolean; label: ReactNode }> = [
  {
    name: "terms_privacy",
    required: true,
    label: (
      <>
        I agree to the{" "}
        <Link href="/terms" target="_blank" className={legalLinkClass}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" className={legalLinkClass}>
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  { name: "match_processing", required: true, label: "Use my profile data to compute AI matches" },
  {
    name: "email_notifications",
    required: false,
    label: "Send me email notifications about new matches",
  },
  {
    name: "whatsapp_notifications",
    required: false,
    label: "Send me WhatsApp notifications for intro requests",
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full text-base`}>
      {pending ? "Saving…" : "Continue"}
      {pending ? null : <ArrowRightIcon />}
    </button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useActionState(completeOnboarding, initialOnboardingState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset>
        <legend className="font-mono text-meta uppercase tracking-wider text-ink">
          Select your primary role
        </legend>
        <div className="mt-3 flex flex-col gap-3">
          {roleOptions.map((option, index) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-4 rounded-lg border border-line bg-slate-50 p-4 transition-colors hover:border-muted has-[:checked]:border-emerald has-[:checked]:bg-emerald/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald/30"
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                required
                defaultChecked={index === 0}
                className="peer sr-only"
              />
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white text-ink peer-checked:bg-emerald-bright/20 peer-checked:text-emerald-deep">
                <option.icon className="h-6 w-6" />
              </span>
              <span className="flex-1">
                <span className="block text-base font-medium text-ink">{option.title}</span>
                <span className="mt-1 block text-small text-muted">{option.description}</span>
              </span>
              <CircleCheckIcon className="h-6 w-6 shrink-0 text-emerald-deep opacity-0 peer-checked:opacity-100" />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Consent</legend>
        {consentOptions.map((option) => (
          <label key={option.name} className="flex items-start gap-3 text-small text-ink">
            <input
              type="checkbox"
              name={option.name}
              required={option.required}
              className="mt-1 h-4 w-4 shrink-0 accent-emerald-deep"
            />
            <span>
              {option.label}
              {option.required ? <span className="sr-only"> (required)</span> : null}
            </span>
          </label>
        ))}
        <p className="text-meta text-muted">
          Email and WhatsApp notifications aren’t live yet — we’ll respect these choices once they
          are.
        </p>
      </fieldset>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-alert-red/30 bg-alert-red/5 px-3 py-3 text-small text-alert-red"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
