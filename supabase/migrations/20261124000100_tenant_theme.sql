-- Visual theme per rental partner. 'va' is the Van Ameyde default; 'partner_red' is a neutral
-- demo theme without customer logos or images.
alter table public.tenants add column theme text not null default 'va' check (theme in ('va', 'partner_red'));
