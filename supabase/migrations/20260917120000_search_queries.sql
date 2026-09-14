-- S2: each user's recent search queries (the S-21 "Recent searches" list). Only the last 10 are kept.
create table public.search_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  query text not null check (char_length(query) between 2 and 200),
  result_count integer not null default 0 check (result_count >= 0),
  created_at timestamptz not null default now()
);

create index search_queries_user_idx on public.search_queries (user_id, created_at desc);
create index search_queries_created_at_idx on public.search_queries (created_at);

alter table public.search_queries enable row level security;
revoke all on public.search_queries from anon;

create policy "search queries read own"
on public.search_queries for select to authenticated
using (user_id = (select private.current_user_id()));
