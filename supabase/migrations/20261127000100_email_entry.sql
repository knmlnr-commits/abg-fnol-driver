-- Fourth entry route: a link underneath the rental company's emails. Only the company is known,
-- so the link has no station, car or rental agreement.
alter table public.entry_tokens drop constraint if exists entry_tokens_kind_check;
alter table public.entry_tokens add constraint entry_tokens_kind_check check (kind in ('agreement', 'vehicle', 'station', 'email'));
alter table public.entry_tokens alter column station_id drop not null;
alter table public.entry_tokens add constraint entry_tokens_station_by_kind check ((kind = 'email') = (station_id is null));
alter table public.entry_tokens add constraint entry_tokens_email_has_nothing check (kind <> 'email' or (vehicle_id is null and rental_agreement is null));
comment on column public.entry_tokens.kind is 'agreement: all known; vehicle: agreement unknown; station: car and agreement unknown; email: only the rental company known.';

-- Which route a report came in through, for measurement per channel.
alter table public.incidents add column entry_kind text check (entry_kind in ('agreement', 'vehicle', 'station', 'email'));
update public.incidents i set entry_kind = e.kind from public.entry_tokens e where e.id = i.entry_token_id and i.entry_kind is null;
