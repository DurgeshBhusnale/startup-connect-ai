-- M7: materialized match candidates per viewer profile, plus display names cached from Clerk for match cards.
alter table public.users add column display_name text;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references public.profiles (id) on delete cascade,
  to_profile_id uuid not null references public.profiles (id) on delete cascade,
  fit_score real not null check (fit_score between 0 and 1),
  content_score real not null check (content_score between 0 and 1),
  collab_score real not null check (collab_score between 0 and 1),
  explanation jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

create index matches_from_fit_idx on public.matches (from_profile_id, fit_score desc);
create index matches_to_profile_id_idx on public.matches (to_profile_id);
create index matches_created_at_idx on public.matches (created_at);

create trigger matches_set_updated_at
before update on public.matches
for each row execute function private.set_updated_at();

alter table public.matches enable row level security;
revoke all on public.matches from anon;

create policy "matches read own"
on public.matches for select to authenticated
using (
  from_profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);
