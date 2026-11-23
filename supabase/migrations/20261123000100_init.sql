-- Driver FNOL prototype: core schema.
-- Security model:
--   * The public driver flow never talks to the database directly. Next.js server routes
--     validate the signed token, rate limit and input, then use the service role.
--   * anon has no access to any table or function.
--   * authenticated (handlers, phase 2) can only READ rows of their own tenant.
--     All writes from the handler side go through server routes that write the audit log.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tenants and master data
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  retention_days int not null default 30 check (retention_days between 1 and 3650),
  created_at timestamptz not null default now()
);
comment on column public.tenants.retention_days is 'Days an incident is kept after submission (per tenant).';

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null unique,
  name text not null,
  city text not null,
  country char(2) not null,
  lat double precision,
  lng double precision
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  station_id uuid references public.stations(id) on delete set null,
  plate text not null,
  make_model text,
  unique (tenant_id, plate)
);

create table public.entry_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('station', 'vehicle', 'agreement')),
  station_id uuid not null references public.stations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  rental_agreement text,
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (kind <> 'vehicle' or vehicle_id is not null),
  check (kind <> 'agreement' or rental_agreement is not null)
);
comment on table public.entry_tokens is 'One row per printed QR code. Revoke to make a printed code stop working.';

create table public.handler_users (
  user_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('handler', 'admin')),
  display_name text not null,
  entra_oid text unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- incidents
create sequence public.incident_reference_seq;

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reference text not null unique,
  entry_token_id uuid references public.entry_tokens(id) on delete set null,
  station_id uuid references public.stations(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  locale text not null default 'en',
  current_step text,
  -- The whole driver draft, validated server side with the zod DraftSchema
  -- (src/lib/domain/schema.ts documents the purpose of every field).
  draft jsonb not null default '{}'::jsonb,
  incident_type text,
  completeness_score int not null default 0 check (completeness_score between 0 and 100),
  missing_items jsonb not null default '[]'::jsonb,
  first_submission_score int,
  first_submission_missing jsonb,
  is_test boolean not null default true,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  retention_until timestamptz not null default now() + interval '30 days'
);
create index incidents_tenant_status_idx on public.incidents (tenant_id, status, submitted_at desc);

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  requested_slots text[] not null check (cardinality(requested_slots) between 1 and 14),
  message text check (char_length(message) <= 500),
  channel text not null check (channel in ('email', 'sms', 'link')),
  recipient_masked text,
  status text not null default 'open' check (status in ('open', 'fulfilled', 'expired', 'revoked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  slot text not null,
  storage_path text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 15728640),
  captured_at timestamptz,
  lat double precision,
  lng double precision,
  source text not null default 'driver' check (source in ('driver', 'station', 'handler')),
  document_request_id uuid references public.document_requests(id) on delete set null,
  ai_result jsonb,
  created_at timestamptz not null default now()
);
create index evidence_items_incident_idx on public.evidence_items (incident_id);

-- Personal links. Only a hash of the token is stored; id is the token's jti.
create table public.access_links (
  id uuid primary key,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  purpose text not null check (purpose in ('incident', 'docreq')),
  document_request_id uuid references public.document_requests(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  recipient_masked text not null,
  template text not null,
  locale text not null,
  status text not null default 'mock_sent',
  created_at timestamptz not null default now()
);

-- Measurement for the business case. No personal data in here.
create table public.funnel_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete cascade,
  event text not null check (event in ('flow_started', 'flow_resumed', 'step_viewed', 'step_completed', 'evidence_added', 'submitted', 'docs_added')),
  step text check (char_length(step) <= 40),
  locale text,
  created_at timestamptz not null default now()
);
create index funnel_events_tenant_idx on public.funnel_events (tenant_id, created_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_type text not null check (actor_type in ('driver', 'handler', 'system')),
  actor_id text,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create table public.intake_deliveries (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  target text not null,
  payload jsonb not null,
  status text not null,
  response jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------- functions
create or replace function public.next_incident_reference()
returns text language sql volatile security definer set search_path = public as $$
  select 'FN-' || to_char(now() at time zone 'utc', 'YYYY') || '-' || lpad(nextval('public.incident_reference_seq')::text, 6, '0');
$$;

-- Fixed window rate limiter. Returns true when the request is allowed.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= p_max;
end;
$$;

-- Tenant of the signed in handler; null for everyone else.
create or replace function public.current_handler_tenant()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.handler_users where user_id = auth.uid();
$$;

create or replace function public.current_handler_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.handler_users where user_id = auth.uid()), false);
$$;

-- Removes incidents past their retention date. Storage objects are removed by the app job.
create or replace function public.purge_expired_incidents()
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  delete from public.incidents where retention_until < now();
  get diagnostics n = row_count;
  insert into public.audit_log (actor_type, action, entity, detail) values ('system', 'purge', 'incidents', jsonb_build_object('count', n));
  return n;
end;
$$;

-- ---------------------------------------------------------------- privileges and RLS
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function public.current_handler_tenant() to authenticated;
grant execute on function public.current_handler_is_admin() to authenticated;
grant execute on function public.next_incident_reference(), public.rate_limit_hit(text, int, int), public.purge_expired_incidents() to service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'tenants', 'stations', 'vehicles', 'entry_tokens', 'handler_users', 'incidents', 'document_requests',
    'evidence_items', 'access_links', 'outbound_messages', 'funnel_events', 'audit_log', 'intake_deliveries', 'rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Handlers read their own tenant. No write policies: writes go through audited server routes.
grant select on public.tenants, public.stations, public.vehicles, public.entry_tokens, public.incidents,
  public.document_requests, public.evidence_items, public.outbound_messages, public.funnel_events,
  public.handler_users, public.audit_log to authenticated;

create policy tenants_read on public.tenants for select to authenticated using (id = public.current_handler_tenant());
create policy stations_read on public.stations for select to authenticated using (tenant_id = public.current_handler_tenant());
create policy vehicles_read on public.vehicles for select to authenticated using (tenant_id = public.current_handler_tenant());
create policy entry_tokens_read on public.entry_tokens for select to authenticated using (tenant_id = public.current_handler_tenant());
create policy incidents_read on public.incidents for select to authenticated
  using (tenant_id = public.current_handler_tenant() and status = 'submitted');
create policy document_requests_read on public.document_requests for select to authenticated using (tenant_id = public.current_handler_tenant());
create policy evidence_items_read on public.evidence_items for select to authenticated using (tenant_id = public.current_handler_tenant());
create policy outbound_messages_read on public.outbound_messages for select to authenticated using (tenant_id = public.current_handler_tenant());
create policy funnel_events_read on public.funnel_events for select to authenticated using (tenant_id = public.current_handler_tenant());
create policy handler_users_read_self on public.handler_users for select to authenticated using (user_id = auth.uid());
create policy audit_log_read_admin on public.audit_log for select to authenticated
  using (tenant_id = public.current_handler_tenant() and public.current_handler_is_admin());
-- access_links, intake_deliveries and rate_limits: no policy, so no access for anon or authenticated.
