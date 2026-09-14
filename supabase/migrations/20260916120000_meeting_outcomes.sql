-- S4: per-party meeting outcomes plus the prompt / reminder / unknown lifecycle.

alter table public.meetings
  -- Set when the first real outcome (not "cancelled") is logged (S4 AC3 completed=true).
  add column completed_at timestamptz,
  add column outcome_prompt_sent_at timestamptz,
  add column outcome_reminder_sent_at timestamptz,
  -- Nobody logged an outcome within 14 days: dropped from the retraining signal (S4 AC4).
  add column outcome_unknown_at timestamptz;

create index meetings_outcome_pending_idx on public.meetings (ends_at)
  where status = 'scheduled' and outcome_unknown_at is null;

-- Both parties log separately; conflicting outcomes are kept (retraining weighs them later).
create table public.meeting_outcomes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  outcome text not null check (outcome in ('great_fit', 'not_a_fit', 'undecided', 'cancelled')),
  -- Private to the author: never shown to the other party.
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, profile_id)
);

create index meeting_outcomes_profile_idx on public.meeting_outcomes (profile_id);
create index meeting_outcomes_created_at_idx on public.meeting_outcomes (created_at);

create trigger meeting_outcomes_set_updated_at
before update on public.meeting_outcomes
for each row execute function private.set_updated_at();

alter table public.meeting_outcomes enable row level security;
revoke all on public.meeting_outcomes from anon;

create policy "meeting outcomes read own"
on public.meeting_outcomes for select to authenticated
using (
  profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (
    kind in (
      'new_match', 'new_matches', 'intro_received', 'mutual_match', 'match_interest',
      'matching_paused', 'intro_cancelled',
      'meeting_booked', 'meeting_reminder', 'meeting_invite', 'scheduling_link_request',
      'meeting_outcome_prompt'
    )
  );
