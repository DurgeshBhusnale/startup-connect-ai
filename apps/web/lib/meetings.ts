import type { MeetingItem } from "@/lib/api-types";

// Mirrors `SchedulingLinkRequest` in apps/api/app/models/meetings.py.
const CAL_PATH = /^[A-Za-z0-9_.-]{1,64}(\/[A-Za-z0-9_.-]{1,64})?$/;
export const CAL_LINK_HINT = "Use your Cal.com booking link, like cal.com/yourname/30min.";

const TIME_ZONE = "Asia/Kolkata";
const dayFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDayFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

/** Cal.com link path ("riya/intro") from a pasted URL, or null when it isn't a cal.com link. */
export function toCalLink(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!value.includes("://")) {
    value = /^(www\.)?cal\.com\//i.test(value)
      ? `https://${value}`
      : `https://cal.com/${value.replace(/^\/+/, "")}`;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || (host !== "cal.com" && host !== "www.cal.com")) return null;
    if (url.search || url.hash) return null;
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    return CAL_PATH.test(path) ? path : null;
  } catch {
    return null;
  }
}

export function meetingDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

export function meetingShortDay(iso: string): string {
  return shortDayFormat.format(new Date(iso));
}

export function meetingTimeRange(meeting: Pick<MeetingItem, "scheduled_at" | "ends_at">): string {
  const start = timeFormat.format(new Date(meeting.scheduled_at));
  const end = timeFormat.format(new Date(meeting.ends_at));
  return `${start} – ${end} IST`;
}

function calendarStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(meeting: MeetingItem, title: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${calendarStamp(meeting.scheduled_at)}/${calendarStamp(meeting.ends_at)}`,
  });
  if (meeting.video_url) {
    params.set("location", meeting.video_url);
    params.set("details", `Join: ${meeting.video_url}`);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function meetingIcs(meeting: MeetingItem, title: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Startup Connect AI//Meetings//EN",
    "BEGIN:VEVENT",
    `UID:${meeting.meeting_id}@startupconnect.ai`,
    `DTSTAMP:${calendarStamp(new Date().toISOString())}`,
    `DTSTART:${calendarStamp(meeting.scheduled_at)}`,
    `DTEND:${calendarStamp(meeting.ends_at)}`,
    `SUMMARY:${icsText(title)}`,
    ...(meeting.video_url
      ? [`LOCATION:${icsText(meeting.video_url)}`, `URL:${meeting.video_url}`]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}
