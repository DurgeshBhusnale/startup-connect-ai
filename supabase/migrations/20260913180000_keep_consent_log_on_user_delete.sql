-- Consent history is a DPDP audit record: a user who has consent rows cannot be hard-deleted.
-- Account erasure must anonymise the users row instead of deleting it.
alter table public.consent_log
  drop constraint consent_log_user_id_fkey,
  add constraint consent_log_user_id_fkey
    foreign key (user_id) references public.users (id) on delete restrict;
