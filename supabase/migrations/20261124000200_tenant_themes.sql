-- White label theming per tenant.
-- A theme is only used on public pages when its brand use is confirmed (permission_by and
-- permission_at). A theme with a logo can not be saved at all without that confirmation.
alter table public.tenants drop column if exists theme;

create table public.tenant_themes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid unique references public.tenants(id) on delete cascade,
  is_default boolean not null default false,
  display_name text not null check (char_length(display_name) between 1 and 60),
  primary_color text not null check (primary_color ~ '^#[0-9A-F]{6}$'),
  accent_color text not null check (accent_color ~ '^#[0-9A-F]{6}$'),
  background_color text not null check (background_color ~ '^#[0-9A-F]{6}$'),
  text_color text not null check (text_color ~ '^#[0-9A-F]{6}$'),
  surface_color text check (surface_color is null or surface_color ~ '^#[0-9A-F]{6}$'),
  font_pair text not null check (font_pair in ('georgia_verdana', 'system_sans', 'trebuchet_verdana', 'palatino_arial')),
  contact_phone text check (char_length(contact_phone) <= 30),
  contact_email text check (char_length(contact_email) <= 254),
  footer_text text check (char_length(footer_text) <= 160),
  logo bytea check (logo is null or octet_length(logo) <= 204800),
  logo_mime text check (logo_mime in ('image/svg+xml', 'image/png')),
  permission_by text check (char_length(permission_by) <= 120),
  permission_at timestamptz,
  contrast_report jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  check ((logo is null) = (logo_mime is null)),
  -- Saving a logo requires the written permission confirmation, stored with name and date.
  check (logo is null or (permission_by is not null and permission_at is not null)),
  check ((permission_by is null) = (permission_at is null)),
  -- Exactly one default theme, and it belongs to no tenant.
  check (not is_default or tenant_id is null)
);
create unique index tenant_themes_one_default on public.tenant_themes (is_default) where is_default;

alter table public.tenant_themes enable row level security;
revoke all on public.tenant_themes from anon, authenticated;
-- No policies: only the server reads and writes themes.
