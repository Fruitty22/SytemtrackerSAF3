-- Run this ONCE in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
--
-- The whole fleet database is one JSON document (row id = 'main'). "version"
-- goes up by one on every save, so two people saving at once can't overwrite
-- each other. Rows called 'snapshot:...' are copies kept so an import can be undone.

create table if not exists public.fleet_store (
  id          text primary key,
  version     bigint not null default 0,
  data        jsonb  not null,
  updated_at  timestamptz not null default now()
);

-- Lock the table: only the server (service-role key) can read or write it.
-- The public "anon" key and anyone on the internet get nothing.
alter table public.fleet_store enable row level security;
revoke all on public.fleet_store from anon, authenticated;
