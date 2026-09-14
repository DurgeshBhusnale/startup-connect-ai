-- M10: account deletion grace period, matching-consent enforcement, per-topic notification
-- preferences, and the data export log.

alter table public.users
  add column deleted_at timestamptz,
  add column hard_delete_at timestamptz,
  add column purged_at timestamptz,
  add column matching_enabled boolean not null default true,
  add column notification_preferences jsonb not null default '{}'::jsonb;

comment on column public.users.hard_delete_at is
  'Set when deletion is requested (deleted_at + 30 days); the purge job erases the account after it.';
comment on column public.users.matching_enabled is
  'Mirrors the latest match_processing consent in consent_log (the audit source of truth).';

create index users_hard_delete_at_idx on public.users (hard_delete_at)
  where hard_delete_at is not null and purged_at is null;

create table public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  downloaded_at timestamptz
);

create index data_export_requests_user_idx on public.data_export_requests (user_id, requested_at desc);

alter table public.data_export_requests enable row level security;
revoke all on public.data_export_requests from anon;

create policy "data export requests read own"
on public.data_export_requests for select to authenticated
using (user_id = (select private.current_user_id()));

-- Intros are cancelled when either side deletes their account.
alter table public.intro_requests
  drop constraint intro_requests_status_check,
  add constraint intro_requests_status_check
    check (status in ('interested', 'pending', 'accepted', 'declined', 'cancelled'));

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (
    kind in (
      'new_match', 'new_matches', 'intro_received', 'mutual_match', 'match_interest',
      'matching_paused', 'intro_cancelled'
    )
  );
