-- S3: meetings between mutual matches, booked through an embedded Cal.com widget.

-- Cal.com booking link path ("username" or "username/event-slug"); the host is always cal.com.
alter table public.profiles
  add column cal_link text
    check (cal_link ~ '^[A-Za-z0-9_.-]{1,64}(/[A-Za-z0-9_.-]{1,64})?$');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  founder_profile_id uuid not null references public.profiles (id) on delete cascade,
  partner_profile_id uuid not null references public.profiles (id) on delete cascade,
  booked_by_profile_id uuid not null references public.profiles (id) on delete cascade,
  host_profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Reported by the Cal.com embed's booking event (not verified with Cal.com in v1).
  cal_booking_uid text not null unique,
  title text,
  scheduled_at timestamptz not null,
  ends_at timestamptz not null,
  video_url text check (video_url like 'https://%'),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > scheduled_at),
  check (founder_profile_id <> partner_profile_id)
);

create index meetings_founder_idx on public.meetings (founder_profile_id, scheduled_at desc);
create index meetings_partner_idx on public.meetings (partner_profile_id, scheduled_at desc);
create index meetings_booked_by_idx on public.meetings (booked_by_profile_id);
create index meetings_host_idx on public.meetings (host_profile_id);
create index meetings_upcoming_idx on public.meetings (scheduled_at) where status = 'scheduled';
create index meetings_created_at_idx on public.meetings (created_at);

create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function private.set_updated_at();

alter table public.meetings enable row level security;
revoke all on public.meetings from anon;

create policy "meetings read own"
on public.meetings for select to authenticated
using (
  founder_profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
  or partner_profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (
    kind in (
      'new_match', 'new_matches', 'intro_received', 'mutual_match', 'match_interest',
      'matching_paused', 'intro_cancelled',
      'meeting_booked', 'meeting_reminder', 'meeting_invite', 'scheduling_link_request'
    )
  );
