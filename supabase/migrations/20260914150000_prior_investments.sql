-- Investor prior investments (M2): one row per disclosed deal. Manual entries are replaced on each save.
create table public.prior_investments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  company_name text not null check (char_length(company_name) between 1 and 120),
  sector text not null,
  stage text not null,
  cheque_inr bigint check (cheque_inr > 0),
  year smallint not null check (year between 1990 and 2100),
  source text not null default 'manual' check (source in ('manual', 'crunchbase')),
  created_at timestamptz not null default now()
);

create index prior_investments_profile_id_idx on public.prior_investments (profile_id);

alter table public.prior_investments enable row level security;
revoke all on public.prior_investments from anon;

create policy "prior_investments read own"
on public.prior_investments for select to authenticated
using (
  profile_id in (
    select id from public.profiles where user_id = (select private.current_user_id())
  )
);

-- Founders and investors now share one sector list; "Logistics" became "Logistics & Supply Chain".
update public.profiles
set l1_data = jsonb_set(l1_data, '{sector}', '"Logistics & Supply Chain"')
where kind = 'founder' and l1_data ->> 'sector' = 'Logistics';
