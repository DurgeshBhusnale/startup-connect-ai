import type { Config } from "tailwindcss";

import {
  borderRadius,
  boxShadow,
  colors,
  fontFamily,
  fontSize,
  spacing,
} from "./lib/design-tokens";

// theme (not theme.extend) for tokens: Tailwind's default palette and scales are
// intentionally unavailable so off-system values fail to compile.
const config: Config = {
  content: ["./app/**/*.{ts,tsx,mdx}", "./components/**/*.{ts,tsx,mdx}"],
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
  },
  plugins: [],
};

export default config;
