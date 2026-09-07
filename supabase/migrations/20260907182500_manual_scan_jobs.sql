alter table public.scan_jobs
  add column if not exists manual boolean not null default false;
