-- M9: match feedback (save / not a fit / accept), founder intro requests, and the in-app notification feed (S-22).

alter table public.matches
  add column saved_at timestamptz,
  add column rejected_at timestamptz,
  add column reject_reason text
    check (reject_reason in ('wrong_sector', 'wrong_stage', 'wrong_geo', 'not_right_person', 'other'));

create index matches_saved_idx on public.matches (from_profile_id, saved_at desc)
  where saved_at is not null;

-- Every reaction to a match: the training signal for the collaborative ranker. Never deleted by app code.
create table public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  actor_profile_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (
    action in ('save', 'unsave', 'reject', 'restore', 'accept', 'request_intro', 'accept_intro', 'decline_intro')
  ),
  reason text,
  fit_score real,
  position smallint,
  created_at timestamptz not null default now()
);

create index feedback_events_actor_idx on public.feedback_events (actor_profile_id, created_at desc);
create index feedback_events_target_idx on public.feedback_events (target_profile_id);
create index feedback_events_match_idx on public.feedback_events (match_id);
create index feedback_events_created_at_idx on public.feedback_events (created_at);

alter table public.feedback_events enable row level security;
revoke all on public.feedback_events from anon;

create policy "feedback events read own"
on public.feedback_events for select to authenticated
using (
  actor_profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);

-- One row per founder <-> investor/mentor pair.
-- interested: the investor/mentor accepted first; pending: the founder requested an intro;
-- accepted: mutual match; declined: the investor/mentor passed.
create table public.intro_requests (
  id uuid primary key default gen_random_uuid(),
  founder_profile_id uuid not null references public.profiles (id) on delete cascade,
  partner_profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('interested', 'pending', 'accepted', 'declined')),
  message text check (char_length(message) <= 500),
  decline_reason text
    check (decline_reason in ('wrong_sector', 'wrong_stage', 'wrong_geo', 'not_right_person', 'other')),
  requested_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (founder_profile_id, partner_profile_id),
  check (founder_profile_id <> partner_profile_id)
);

create index intro_requests_partner_status_idx on public.intro_requests (partner_profile_id, status);
create index intro_requests_created_at_idx on public.intro_requests (created_at);

create trigger intro_requests_set_updated_at
before update on public.intro_requests
for each row execute function private.set_updated_at();

alter table public.intro_requests enable row level security;
revoke all on public.intro_requests from anon;

create policy "intro requests read own"
on public.intro_requests for select to authenticated
using (
  founder_profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
  or partner_profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (
    kind in ('new_match', 'new_matches', 'intro_received', 'mutual_match', 'match_interest')
  ),
  title text not null,
  body text,
  action_label text,
  action_href text check (action_href like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;

create policy "notifications read own"
on public.notifications for select to authenticated
using (user_id = (select private.current_user_id()));
