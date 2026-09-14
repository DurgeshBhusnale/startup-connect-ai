// Mirrors MESSAGE_MAX in apps/api/app/models/messages.py.
export const MESSAGE_MAX = 2000;
export const MESSAGES_PAGE_SIZE = 50;

const TIME_ZONE = "Asia/Kolkata";
const DAY_MS = 86_400_000;
const dayParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});
const weekdayFormat = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short" });
const shortDateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});
const longDateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** WebSocket URL for the API (same host as NEXT_PUBLIC_API_URL). */
export function realtimeUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  const url = new URL("/v1/ws", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/** Calendar day in IST as "YYYY-MM-DD". */
export function dayKey(iso: string): string {
  return dayParts.format(new Date(iso));
}

function daysBetween(fromIso: string, to: Date): number {
  return Math.round((Date.parse(dayKey(to.toISOString())) - Date.parse(dayKey(fromIso))) / DAY_MS);
}

export function dayLabel(iso: string, now = new Date()): string {
  const days = daysBetween(iso, now);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return longDateFormat.format(new Date(iso));
}

export function messageTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Compact time for the conversation list: "5m", "2h", "Yesterday", "Tue", "15 Sep". */
export function threadTimeLabel(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  const days = daysBetween(iso, now);
  if (days === 0) {
    if (minutes < 1) return "Now";
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return weekdayFormat.format(new Date(iso));
  return shortDateFormat.format(new Date(iso));
}
