create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);
create unique index if not exists admin_users_email_lower_idx on public.admin_users(lower(email));
insert into public.admin_users(user_id,email,role)
select id,email,'admin' from auth.users where lower(email)=lower('deployhatch@gmail.com')
on conflict (user_id) do update set email=excluded.email, role='admin';

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_admin_idx on public.admin_audit_log(admin_user_id,created_at desc);
