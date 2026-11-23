-- Private bucket for photos and documents. No storage policies for anon or authenticated:
-- uploads use short lived signed upload URLs created by the server for one incident and one slot,
-- reads use signed URLs created by the server after an access check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
