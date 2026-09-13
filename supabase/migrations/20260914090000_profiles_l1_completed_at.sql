-- Set when a founder confirms their L1 profile; AI drafts in l1_data leave it null.
alter table public.profiles add column l1_completed_at timestamptz;
