"use client";

import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect, useRef } from "react";

import { colors } from "@/lib/design-tokens";

import type { BookedEvent } from "@/app/(app)/matches/meeting-actions";

const NAMESPACE = "startup-connect-meeting";

type CalBookingEmbedProps = {
  calLink: string;
  name: string;
  email: string;
  /** Called with the booking the embed reports; uid is null when Cal.com didn't send one. */
  onBooked: (booking: Omit<BookedEvent, "uid"> & { uid: string | null }) => void;
};

// W5: Cal.com owns availability and booking; we only record what the embed reports.
export function CalBookingEmbed({ calLink, name, email, onBooked }: CalBookingEmbedProps) {
  const onBookedRef = useRef(onBooked);
  useEffect(() => {
    onBookedRef.current = onBooked;
  });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      const cal = await getCalApi({ namespace: NAMESPACE });
      if (!active) return;
      cal("ui", {
        theme: "light",
        hideEventTypeDetails: false,
        layout: "month_view",
        cssVarsPerTheme: { light: { "cal-brand": colors.ink }, dark: { "cal-brand": colors.ink } },
      });
      const callback = (event: { detail: { data: unknown } }) => {
        const data = event.detail.data as {
          uid?: string;
          title?: string;
          startTime?: string;
          endTime?: string;
          videoCallUrl?: string;
        };
        if (!data.startTime) return;
        onBookedRef.current({
          uid: data.uid ?? null,
          startTime: data.startTime,
          endTime: data.endTime ?? null,
          title: data.title ?? null,
          videoCallUrl: data.videoCallUrl ?? null,
        });
      };
      cal("on", { action: "bookingSuccessfulV2", callback });
      unsubscribe = () => cal("off", { action: "bookingSuccessfulV2", callback });
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return (
    <Cal
      namespace={NAMESPACE}
      calLink={calLink}
      config={{ name, email, layout: "month_view", theme: "light" }}
      className="min-h-screen w-full overflow-auto"
    />
  );
}
