-- Keep the RLS helper functions out of the exposed API schema (Supabase security advisor 0029).
-- Policies refer to the functions by id, so they keep working after the move.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.current_handler_tenant() set schema private;
alter function public.current_handler_is_admin() set schema private;
alter function private.current_handler_tenant() set search_path = public;
alter function private.current_handler_is_admin() set search_path = public;
