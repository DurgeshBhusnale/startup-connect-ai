import { colors } from "@/lib/design-tokens";

import type { SignIn } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type ClerkAppearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;

// Clerk renders inside our S-02 card, so its own card chrome, header, and footer link are removed.
export const clerkAppearance: ClerkAppearance = {
  layout: {
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    logoPlacement: "none",
  },
  variables: {
    colorPrimary: colors.ink,
    colorText: colors.ink,
    colorTextSecondary: colors.muted,
    colorBackground: colors.white,
    colorInputBackground: colors.white,
    colorInputText: colors.ink,
    colorDanger: colors.alert.red,
    colorSuccess: colors.emerald.deep,
    borderRadius: "6px",
    fontFamily: "var(--font-inter)",
    fontSize: "16px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full rounded-none border-0 shadow-none",
    card: "w-full gap-6 border-0 bg-transparent p-0 shadow-none",
    header: "hidden",
    footer: "bg-transparent",
    footerAction: "hidden",
    socialButtonsBlockButton: "rounded-md border border-line py-3 shadow-none hover:bg-slate-50",
    socialButtonsBlockButton__linkedin_oidc:
      "border-ink bg-ink text-white hover:bg-ink hover:opacity-90",
    socialButtonsBlockButtonText: "text-base font-medium",
    dividerText: "font-mono text-meta uppercase tracking-wider text-muted",
    formFieldLabel: "text-small font-medium text-ink",
    formFieldInput: "rounded-md border border-muted px-3 py-3 text-base",
    formFieldAction: "text-emerald-deep",
    formButtonPrimary: "rounded-md bg-ink py-3 text-base font-medium hover:bg-ink hover:opacity-90",
    footerActionLink: "text-emerald-deep",
  },
};
