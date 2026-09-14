-- S8: investors and mentors vouch for specific claims on a founder's profile.

create table public.endorsements (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Null once the endorser's account is purged: the endorsement stays, shown as inactive.
  endorser_profile_id uuid references public.profiles (id) on delete set null,
  target_item_kind text not null check (target_item_kind in ('profile_field', 'milestone')),
  -- "l1.<field>" for profile facts, "post:<uuid>" for milestone posts.
  target_item_id text not null
    check (target_item_id ~ '^(l1\.[a-z_]{1,40}|post:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  -- The claim as it read when endorsed (for the endorser's list and notices after an edit).
  claim_snapshot text check (char_length(claim_snapshot) <= 300),
  endorser_name text check (char_length(endorser_name) <= 200),
  created_at timestamptz not null default now(),
  check ((target_item_kind = 'milestone') = (target_item_id like 'post:%')),
  check (endorser_profile_id is null or endorser_profile_id <> target_profile_id)
);

create unique index endorsements_one_per_claim_idx
  on public.endorsements (endorser_profile_id, target_profile_id, target_item_id)
  where endorser_profile_id is not null;
create index endorsements_target_idx on public.endorsements (target_profile_id, target_item_id);
create index endorsements_endorser_idx on public.endorsements (endorser_profile_id);
create index endorsements_created_at_idx on public.endorsements (created_at);

alter table public.endorsements enable row level security;
revoke all on public.endorsements from anon;

create policy "endorsements read own"
on public.endorsements for select to authenticated
using (
  endorser_profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
  or target_profile_id in (
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
      'meeting_outcome_prompt', 'message_received',
      'endorsement_received', 'endorsement_removed'
    )
  );
