import {
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
  CircleCheckIcon,
  ClockIcon,
  InboxIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryButton } from "@/components/ui/retry-button";
import { getNotifications } from "@/lib/notifications-api";
import { buttonStyles, cardStyles } from "@/lib/ui";

import { markAllNotificationsRead, openNotification } from "./actions";

import type { IconComponent } from "@/components/icons";
import type { NotificationItem, NotificationKind } from "@/lib/api-types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications" };

const TIME_ZONE = "Asia/Kolkata";
const DAY_MS = 86_400_000;
const dayParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const relativeFormat = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const kindStyles: Record<NotificationKind, { icon: IconComponent; tone: string }> = {
  new_match: { icon: SparklesIcon, tone: "bg-emerald/10 text-emerald-deep" },
  new_matches: { icon: SparklesIcon, tone: "bg-emerald/10 text-emerald-deep" },
  intro_received: { icon: InboxIcon, tone: "bg-slate-100 text-ink" },
  mutual_match: { icon: CircleCheckIcon, tone: "bg-emerald-bright/15 text-emerald-deep" },
  match_interest: { icon: BellIcon, tone: "bg-alert-amber/10 text-alert-amber" },
  matching_paused: { icon: ShieldCheckIcon, tone: "bg-slate-100 text-ink" },
  intro_cancelled: { icon: InboxIcon, tone: "bg-slate-100 text-muted" },
  meeting_booked: { icon: CalendarIcon, tone: "bg-emerald-bright/15 text-emerald-deep" },
  meeting_reminder: { icon: ClockIcon, tone: "bg-slate-100 text-ink" },
  meeting_invite: { icon: CalendarIcon, tone: "bg-emerald/10 text-emerald-deep" },
  scheduling_link_request: { icon: CalendarIcon, tone: "bg-alert-amber/10 text-alert-amber" },
  meeting_outcome_prompt: { icon: MessageSquareIcon, tone: "bg-slate-100 text-ink" },
};

// Calendar days in IST, so "Today" matches what users in India see on the clock.
function calendarDay(date: Date): number {
  const [year = 1970, month = 1, day = 1] = dayParts.format(date).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function timeAgo(created: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - created.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return relativeFormat.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativeFormat.format(-hours, "hour");
  const days = Math.round((calendarDay(now) - calendarDay(created)) / DAY_MS);
  if (days < 7) return relativeFormat.format(-days, "day");
  return dateFormat.format(created);
}

type Group = { label: string; items: NotificationItem[] };

function groupByDay(items: NotificationItem[], now: Date): Group[] {
  const today: Group = { label: "Today", items: [] };
  const thisWeek: Group = { label: "This week", items: [] };
  const older: Group = { label: "Older", items: [] };
  const todayKey = calendarDay(now);
  for (const item of items) {
    const days = Math.round((todayKey - calendarDay(new Date(item.created_at))) / DAY_MS);
    (days <= 0 ? today : days < 7 ? thisWeek : older).items.push(item);
  }
  return [today, thisWeek, older].filter((group) => group.items.length > 0);
}

function NotificationRow({ item, now }: { item: NotificationItem; now: Date }) {
  const { icon: Icon, tone } = kindStyles[item.kind];
  const created = new Date(item.created_at);
  return (
    <li className={`flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-6 ${item.read ? "bg-white" : "bg-slate-50"}`}>
      <span
        aria-hidden="true"
        className={`mt-6 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-emerald-bright"}`}
      />
      <span
        aria-hidden="true"
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tone}`}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className={`text-small text-ink ${item.read ? "" : "font-semibold"}`}>
            {item.read ? null : <span className="sr-only">Unread: </span>}
            {item.title}
          </p>
          {item.body ? <p className="mt-1 text-small text-muted">{item.body}</p> : null}
          <p className="mt-1 font-mono text-meta text-muted">
            <time dateTime={item.created_at} title={dateFormat.format(created)}>
              {timeAgo(created, now)}
            </time>
          </p>
        </div>
        {item.action_href && item.action_label ? (
          <form action={openNotification} className="shrink-0">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="href" value={item.action_href} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md py-2 text-small font-medium text-emerald-deep hover:underline"
            >
              {item.action_label}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

export default async function NotificationsPage() {
  const result = await getNotifications();
  const now = new Date();

  return (
    <div className="mx-auto flex max-w-feed flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-h1 text-ink">Notifications</h1>
          <p className="text-small text-muted">Intro requests, mutual matches, and new matches.</p>
        </div>
        {result.status === "ok" && result.data.unread_count > 0 ? (
          <form action={markAllNotificationsRead}>
            <button type="submit" className={buttonStyles.ghost}>
              Mark all read ({result.data.unread_count})
            </button>
          </form>
        ) : null}
      </div>

      {result.status === "unavailable" ? (
        <section className={`${cardStyles} flex flex-col items-center gap-4 p-6`}>
          <EmptyState
            icon={<BellIcon className="h-8 w-8" />}
            title="Couldn’t load notifications"
            body="Something went wrong on our side. Try again in a moment."
          />
          <RetryButton />
        </section>
      ) : result.data.items.length === 0 ? (
        <section className={`${cardStyles} p-6`}>
          <EmptyState
            icon={<BellIcon className="h-8 w-8" />}
            title="You’re all caught up"
            body="Intro requests, mutual matches, and new matches will show up here."
            action={{ href: "/matches", label: "Browse matches" }}
          />
        </section>
      ) : (
        groupByDay(result.data.items, now).map((group) => (
          <section key={group.label} aria-labelledby={`group-${group.label}`} className="flex flex-col gap-2">
            <h2
              id={`group-${group.label}`}
              className="px-1 font-mono text-meta uppercase tracking-wider text-muted"
            >
              {group.label}
            </h2>
            <ul className={`${cardStyles} divide-y divide-line overflow-hidden`}>
              {group.items.map((item) => (
                <NotificationRow key={item.id} item={item} now={now} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
