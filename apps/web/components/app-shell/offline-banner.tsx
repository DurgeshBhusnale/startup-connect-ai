"use client";

import { useSyncExternalStore } from "react";

import { TriangleAlertIcon } from "@/components/icons";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// S-28 offline pattern. Amber stays on the border and icon; the text is Ink for contrast.
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) {
    return null;
  }
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-alert-amber bg-alert-amber/10 px-4 py-2 text-small text-ink"
    >
      <TriangleAlertIcon className="h-4 w-4 shrink-0 text-alert-amber" />
      You’re offline. Some features won’t work and changes may not save until you reconnect.
    </div>
  );
}
