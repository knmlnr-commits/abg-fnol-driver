-- Fictional seed data. No real customers, stations, vehicles or people.
insert into public.tenants (id, name, retention_days) values
  ('00000000-0000-4000-8000-000000000001', 'Demo rental company', 30)
on conflict (id) do nothing;

insert into public.stations (id, tenant_id, code, name, city, country, lat, lng) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'DE-HAM-AP', 'Airport station', 'Hamburg', 'DE', 53.6304, 9.9882),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'DE-MUC-HB', 'Central station', 'München', 'DE', 48.1402, 11.5600),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'NL-AMS-SD', 'City west', 'Amsterdam', 'NL', 52.3889, 4.8380),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'ES-MAD-AT', 'Central station', 'Madrid', 'ES', 40.4065, -3.6895),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'IT-MIL-CE', 'Central station', 'Milano', 'IT', 45.4862, 9.2046),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'FR-LYS-PD', 'City centre', 'Lyon', 'FR', 45.7606, 4.8593)
on conflict (id) do nothing;

-- Fictional plates in a plausible format; DEMO series so they cannot be confused with real cars.
insert into public.vehicles (id, tenant_id, station_id, plate, make_model) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'HH-VA 101', 'Compact hatchback'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'HH-VA 102', 'Estate'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'M-VA 201', 'SUV'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'VA-001-X', 'Compact hatchback'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104', '0001 VAX', 'Van')
on conflict (id) do nothing;

insert into public.entry_tokens (id, tenant_id, kind, station_id, vehicle_id, rental_agreement, label) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'station', '00000000-0000-4000-8000-000000000101', null, null, 'Station card Hamburg'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', 'vehicle', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', null, 'Sticker HH-VA 101'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', 'agreement', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', 'RA-DEMO-100234', 'Rental agreement print'),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000001', 'vehicle', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000203', null, 'Sticker M-VA 201'),
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000001', 'station', '00000000-0000-4000-8000-000000000103', null, null, 'Station card Amsterdam'),
  ('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000001', 'vehicle', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000205', null, 'Sticker 0001 VAX')
on conflict (id) do nothing;

-- Link underneath the rental company's emails: only the company is known.
insert into public.entry_tokens (id, tenant_id, kind, station_id, vehicle_id, rental_agreement, label) values
  ('00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000001', 'email', null, null, null, 'Link in rental emails')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- themes
-- Van Ameyde default theme. Other tenant themes are added in the admin, with brand permission.
insert into public.tenant_themes (is_default, display_name, primary_color, accent_color, background_color, text_color, surface_color, font_pair, permission_by, permission_at, updated_by)
values (true, 'Van Ameyde', '#07017E', '#00D8B9', '#FFFFFF', '#07017E', '#E5D3D1', 'georgia_verdana', 'Van Ameyde Systems (own brand)', now(), 'seed')
on conflict do nothing;
