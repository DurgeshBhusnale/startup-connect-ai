-- S9: the founder's "Currently asking for" pin is one line of at most 140 characters.
update public.profiles set ask_pin = null where ask_pin is not null and btrim(ask_pin) = '';

alter table public.profiles
  add constraint profiles_ask_pin_length
    check (ask_pin is null or char_length(ask_pin) between 1 and 140);
