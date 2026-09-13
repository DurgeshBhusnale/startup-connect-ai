-- Week 1 schema: identity, role profiles, investor thesis, mentor expertise, DPDP consent log.
-- Auth is Clerk (third-party auth): the Clerk user id arrives as the JWT `sub` claim.
-- Writes go through the FastAPI backend (service role). Browser clients only get read-own policies.

create type public.app_role as enum ('founder', 'investor', 'mentor');

create type public.consent_scope as enum (
  'terms_privacy',
  'match_processing',
  'email_notifications',
  'whatsapp_notifications'
);

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- users
create table public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null unique,
  role public.app_role,
  email text not null,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

create index users_email_idx on public.users (email);
create index users_created_at_idx on public.users (created_at);

comment on column public.users.role is 'Role picked at sign-up. profiles.kind is the source of truth for what roles a user holds.';

-- Resolves the calling Clerk user to users.id without tripping RLS on users itself.
create or replace function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.users where clerk_id = (select auth.jwt() ->> 'sub');
$$;

revoke all on function private.current_user_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_id() to authenticated;

-- ------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind public.app_role not null,
  l1_data jsonb not null default '{}'::jsonb,
  ask_pin text,
  embedding_v integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

create index profiles_kind_idx on public.profiles (kind);
create index profiles_created_at_idx on public.profiles (created_at);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- ------------------------------------------------------ investor_thesis
create table public.investor_thesis (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  sectors text[] not null default '{}',
  stages text[] not null default '{}',
  cheque_min integer check (cheque_min >= 0),
  cheque_max integer check (cheque_max >= 0),
  geographies text[] not null default '{}',
  no_gos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investor_thesis_cheque_range check (
    cheque_min is null or cheque_max is null or cheque_min <= cheque_max
  )
);

comment on column public.investor_thesis.cheque_min is 'Rupees';
comment on column public.investor_thesis.cheque_max is 'Rupees';

create trigger investor_thesis_set_updated_at
before update on public.investor_thesis
for each row execute function private.set_updated_at();

-- ----------------------------------------------------- mentor_expertise
create table public.mentor_expertise (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  areas text[] not null default '{}',
  availability jsonb not null default '{}'::jsonb,
  session_fee integer check (session_fee >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.mentor_expertise.session_fee is 'Rupees; null means free';

create trigger mentor_expertise_set_updated_at
before update on public.mentor_expertise
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------- consent_log
-- Append-only: every grant or withdrawal is a new row (DPDP audit trail).
create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  scope public.consent_scope not null,
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);

create index consent_log_user_created_idx on public.consent_log (user_id, created_at desc);

-- ------------------------------------------------------------------ RLS
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.investor_thesis enable row level security;
alter table public.mentor_expertise enable row level security;
alter table public.consent_log enable row level security;

revoke all on public.users, public.profiles, public.investor_thesis,
  public.mentor_expertise, public.consent_log from anon;

create policy "users read own row"
on public.users for select to authenticated
using (clerk_id = (select auth.jwt() ->> 'sub'));

create policy "profiles read own"
on public.profiles for select to authenticated
using (user_id = (select private.current_user_id()));

create policy "investor_thesis read own"
on public.investor_thesis for select to authenticated
using (
  profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);

create policy "mentor_expertise read own"
on public.mentor_expertise for select to authenticated
using (
  profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);

create policy "consent_log read own"
on public.consent_log for select to authenticated
using (user_id = (select private.current_user_id()));
