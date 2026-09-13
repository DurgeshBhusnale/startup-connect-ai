// Single source of truth for the design system (CLAUDE.md "Design system", revised 2026-09-13).
// tailwind.config.ts consumes these; components use the generated classes, never raw hex.

export const colors = {
  transparent: "transparent",
  current: "currentColor",
  white: "#FFFFFF",
  ink: "#0B0F19",
  emerald: {
    DEFAULT: "#059669",
    bright: "#10B981",
    deep: "#047857",
  },
  slate: {
    50: "#F8FAFC",
    100: "#F1F5F9",
  },
  line: "#E2E8F0",
  muted: "#64748B",
  alert: {
    red: "#B91C1C",
    amber: "#D97706",
  },
} as const;

// Tailwind keys follow its 4px unit: 1 = 4px, 2 = 8px, … 24 = 96px.
export const spacing = {
  0: "0px",
  px: "1px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  12: "48px",
  16: "64px",
  24: "96px",
} as const;

export const borderRadius = {
  none: "0px",
  DEFAULT: "4px", // badges
  md: "6px", // buttons, inputs
  lg: "8px", // cards
  xl: "12px", // modals
  full: "9999px",
} as const;

export const boxShadow = {
  none: "none",
  card: "0 1px 3px rgba(0,0,0,0.06)",
} as const;

export const fontSize = {
  meta: ["12px", { lineHeight: "16px" }],
  small: ["14px", { lineHeight: "20px" }],
  base: ["16px", { lineHeight: "24px" }],
  h4: ["16px", { lineHeight: "24px" }],
  h3: ["20px", { lineHeight: "28px" }],
  h2: ["24px", { lineHeight: "32px" }],
  h1: ["32px", { lineHeight: "40px" }],
  hero: ["48px", { lineHeight: "56px" }],
  "hero-lg": ["56px", { lineHeight: "64px" }],
} as const satisfies Record<string, [string, { lineHeight: string }]>;

export const fontFamily = {
  sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
  heading: ["Georgia", "ui-serif", "serif"],
  mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
} as const;
