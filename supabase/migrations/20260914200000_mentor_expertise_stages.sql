-- M3: mentors pick the startup stages they help most with (S-08 "Stage focus").
alter table public.mentor_expertise add column stages text[] not null default '{}';
