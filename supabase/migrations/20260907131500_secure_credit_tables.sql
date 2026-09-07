alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
revoke all on public.credit_accounts from anon, authenticated;
revoke all on public.credit_ledger from anon, authenticated;
