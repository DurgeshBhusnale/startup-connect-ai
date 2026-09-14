"use client";

import { useFormStatus } from "react-dom";

import { RefreshIcon } from "@/components/icons";
import { buttonStyles } from "@/lib/ui";

export function RefreshButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles.secondary}>
      <RefreshIcon className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Refreshing…" : "Refresh matches"}
    </button>
  );
}
