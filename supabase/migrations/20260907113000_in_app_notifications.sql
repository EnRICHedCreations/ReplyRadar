alter table public.matches add column if not exists read_at timestamptz;
create index if not exists matches_unread on public.matches(user_id, detected_at desc) where notification_eligible and read_at is null and archived_at is null;
