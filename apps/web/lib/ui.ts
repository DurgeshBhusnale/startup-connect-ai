const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-small font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-ink text-white hover:opacity-90`,
  secondary: `${buttonBase} border border-ink bg-white text-ink hover:bg-slate-50`,
  ghost: `${buttonBase} text-emerald-deep hover:bg-slate-50`,
  inverse: `${buttonBase} bg-white text-ink hover:bg-slate-100`,
  outlineInverse: `${buttonBase} border border-white/30 text-white hover:bg-white/10`,
} as const;

export const cardStyles = "rounded-lg border border-line bg-white shadow-card";

export const eyebrowStyles = "font-mono text-meta uppercase tracking-wider text-emerald-deep";
