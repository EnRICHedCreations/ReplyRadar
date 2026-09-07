create table if not exists public.credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents integer not null default 0 check (balance_cents >= 0),
  lifetime_purchased_cents integer not null default 0,
  lifetime_spent_cents integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null,
  kind text not null check (kind in ('purchase','scan','adjustment','refund')),
  radar_id uuid references public.radars(id) on delete set null,
  scan_run_id uuid references public.scan_runs(id) on delete set null,
  stripe_session_id text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_created on public.credit_ledger(user_id,created_at desc);
alter table public.scan_runs add column if not exists billable_posts integer not null default 0, add column if not exists cost_cents integer not null default 0;
alter table public.radars add column if not exists max_results_per_scan integer not null default 100 check (max_results_per_scan between 10 and 100);
