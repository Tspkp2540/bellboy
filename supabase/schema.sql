-- BellDesk shared-state table.
-- The browser never receives the Supabase secret key. Requests go through /api/state,
-- which checks BELLDESK_SHARED_CODE and accesses this table server-side.
create table if not exists public.belldesk_state (
  key text primary key check (key ~ '^[a-z0-9_]{1,80}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.belldesk_state enable row level security;

revoke all on table public.belldesk_state from anon, authenticated;
grant all on table public.belldesk_state to service_role;

-- Do not add anon/authenticated policies. Only the Vercel API function
-- accesses this table with SUPABASE_SECRET_KEY.
