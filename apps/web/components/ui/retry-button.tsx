"use client";

import { useRouter } from "next/navigation";

import { buttonStyles } from "@/lib/ui";

export function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.refresh()} className={buttonStyles.secondary}>
      {label}
    </button>
  );
}
