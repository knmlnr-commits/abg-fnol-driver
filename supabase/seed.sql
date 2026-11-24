-- Fictional seed data. No real customers, stations, vehicles or people.
insert into public.tenants (id, name, retention_days) values
  ('00000000-0000-4000-8000-000000000001', 'Rental partner', 30)
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

-- ---------------------------------------------------------------- themes
-- Van Ameyde default theme.
insert into public.tenant_themes (is_default, display_name, primary_color, accent_color, background_color, text_color, surface_color, font_pair, permission_by, permission_at, updated_by)
values (true, 'Van Ameyde', '#07017E', '#00D8B9', '#FFFFFF', '#07017E', '#E5D3D1', 'georgia_verdana', 'Van Ameyde Systems (own brand)', now(), 'seed')
on conflict do nothing;

-- Northline Rental: a fictional demo brand designed for this prototype. Not a real company.
insert into public.tenants (id, name, retention_days) values
  ('00000000-0000-4000-8000-000000000002', 'Northline Rental', 30)
on conflict (id) do nothing;

insert into public.stations (id, tenant_id, code, name, city, country, lat, lng) values
  ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000002', 'NL-UTR-NL', 'Central station', 'Utrecht', 'NL', 52.0894, 5.1101),
  ('00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-000000000002', 'DE-KOE-NL', 'Airport station', 'Köln', 'DE', 50.8789, 7.1225)
on conflict (id) do nothing;

insert into public.vehicles (id, tenant_id, station_id, plate, make_model) values
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000111', 'NL-DMO-01', 'Compact hatchback'),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000112', 'K-NL 201', 'Estate')
on conflict (id) do nothing;

insert into public.entry_tokens (id, tenant_id, kind, station_id, vehicle_id, rental_agreement, label) values
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000002', 'station', '00000000-0000-4000-8000-000000000111', null, null, 'Station card Utrecht'),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000002', 'vehicle', '00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000211', null, 'Sticker NL-DMO-01'),
  ('00000000-0000-4000-8000-000000000313', '00000000-0000-4000-8000-000000000002', 'agreement', '00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-000000000212', 'NL-DEMO-55021', 'Rental agreement print')
on conflict (id) do nothing;

insert into public.tenant_themes (tenant_id, display_name, primary_color, accent_color, background_color, text_color, font_pair, contact_phone, contact_email, footer_text, logo, logo_mime, permission_by, permission_at, updated_by)
values ('00000000-0000-4000-8000-000000000002', 'Northline Rental', '#4A1F5C', '#0E7C86', '#FAF8F5', '#1E1B24', 'system_sans',
  '+31 10 000 0000', 'damage@northline.example', 'Northline Rental is a fictional brand for demonstrations.',
  convert_to('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 232 56" role="img" aria-label="Northline Rental">
  <path d="M8 38 L24 12 L40 38" fill="none" stroke="#0E7C86" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4 46 H44" fill="none" stroke="#4A1F5C" stroke-width="4" stroke-linecap="round"/>
  <text x="56" y="33" font-family="system-ui, -apple-system, ''Segoe UI'', Roboto, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="2.5" fill="#4A1F5C">NORTHLINE</text>
  <text x="57" y="49" font-family="system-ui, -apple-system, ''Segoe UI'', Roboto, Arial, sans-serif" font-size="10.5" font-weight="600" letter-spacing="5.2" fill="#0E7C86">RENTAL</text>
</svg>', 'UTF8'), 'image/svg+xml',
  'Van Ameyde Systems (owner of the fictional demo brand)', now(), 'seed')
on conflict (tenant_id) do nothing;
