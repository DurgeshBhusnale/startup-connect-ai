import type { Config } from "tailwindcss";

import {
  borderRadius,
  boxShadow,
  colors,
  fontFamily,
  fontSize,
  sizes,
  spacing,
} from "./lib/design-tokens";

// theme (not theme.extend) for tokens: Tailwind's default palette and scales are
// intentionally unavailable so off-system values fail to compile.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    colors,
    spacing,
    borderRadius,
    boxShadow,
    fontFamily: {
      sans: [...fontFamily.sans],
      heading: [...fontFamily.heading],
      mono: [...fontFamily.mono],
    },
    fontSize: Object.fromEntries(
      Object.entries(fontSize).map(([key, [size, opts]]) => [key, [size, { ...opts }]]),
    ),
    extend: {
      width: { sidebar: sizes.sidebar },
      maxWidth: {
        "auth-card": sizes["auth-card"],
        empty: sizes.empty,
        content: sizes.content,
        onboarding: sizes.onboarding,
        "onboarding-wide": sizes["onboarding-wide"],
        modal: sizes.modal,
      },
    },
  },
  plugins: [],
};

export default config;
