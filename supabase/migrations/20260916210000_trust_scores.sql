-- S7: nightly trust & responsiveness. Only categorical badges are shown; numbers stay internal.

create table public.trust_scores (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  -- Mean of the daily raw scores over the last 30 days (smooths week-over-week swings).
  score double precision check (score between 0 and 1),
  previous_score double precision check (previous_score between 0 and 1),
  -- Null until the profile has at least 10 interactions (new users are never penalised).
  badge text check (badge in ('high', 'medium', 'low')),
  message text,
  interactions integer not null default 0 check (interactions >= 0),
  response_rate double precision check (response_rate between 0 and 1),
  median_response_hours double precision check (median_response_hours >= 0),
  meeting_completion_rate double precision check (meeting_completion_rate between 0 and 1),
  follow_through_rate double precision check (follow_through_rate between 0 and 1),
  computed_at timestamptz not null default now(),
  check ((badge is null) = (message is null))
);

create table public.trust_score_history (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  computed_on date not null,
  raw_score double precision not null check (raw_score between 0 and 1),
  interactions integer not null check (interactions >= 0),
  primary key (profile_id, computed_on)
);

create index trust_score_history_computed_on_idx on public.trust_score_history (computed_on);

-- Service role only: the API exposes badges, never the underlying numbers.
alter table public.trust_scores enable row level security;
alter table public.trust_score_history enable row level security;
revoke all on public.trust_scores from anon, authenticated;
revoke all on public.trust_score_history from anon, authenticated;
