import Link from "next/link";

import { LogoMarkIcon } from "@/components/icons";

type LogoProps = {
  tone?: "dark" | "light";
  href?: string;
};

export function Logo({ tone = "dark", href = "/" }: LogoProps) {
  const isLight = tone === "light";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md"
      aria-label="Startup Connect AI home"
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-md ${
          isLight ? "bg-emerald-bright/15 text-emerald-bright" : "bg-ink text-white"
        }`}
      >
        <LogoMarkIcon className="h-4 w-4" />
      </span>
      <span
        className={`font-heading text-base font-semibold ${isLight ? "text-white" : "text-ink"}`}
      >
        Startup Connect{" "}
        <span className={isLight ? "text-emerald-bright" : "text-emerald-deep"}>AI</span>
      </span>
    </Link>
  );
}
