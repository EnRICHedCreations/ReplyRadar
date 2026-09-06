create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,email text not null,display_name text not null default '',timezone text not null default 'UTC',preferences jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.subscriptions(user_id uuid primary key references auth.users(id) on delete cascade,stripe_customer_id text unique,stripe_subscription_id text unique,stripe_price_id text,plan text not null default 'free' check(plan in ('free','starter','pro','growth')),status text not null default 'active',current_period_end timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.radars(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,description text not null default '',query text not null check(length(query) between 2 and 512),enabled boolean not null default true,scan_interval_seconds int not null default 600 check(scan_interval_seconds>=30),timezone text not null default 'UTC',active_schedule_json jsonb,minimum_score int not null default 70 check(minimum_score between 0 and 100),provider text not null default 'mock' check(provider in ('mock','x')),provider_cursor text,last_scan_at timestamptz,last_successful_scan_at timestamptz,next_scan_at timestamptz not null default now(),last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index radars_user on public.radars(user_id);
create index radars_due on public.radars(next_scan_at) where enabled;
create table public.posts(id uuid primary key default gen_random_uuid(),platform text not null,external_id text not null,author_id text not null,username text not null,display_name text,text text not null,url text not null,posted_at timestamptz not null,likes int not null default 0,replies int not null default 0,reposts int not null default 0,quotes int not null default 0,followers int not null default 0,verified boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(platform,external_id));
create table public.matches(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,radar_id uuid not null references public.radars(id) on delete cascade,post_id uuid not null references public.posts(id) on delete cascade,score int not null check(score between 0 and 100),intent text not null,score_breakdown_json jsonb not null,detected_at timestamptz not null default now(),notification_eligible boolean not null,archived_at timestamptz,unique(radar_id,post_id));
create index matches_feed on public.matches(user_id,detected_at desc);
create index matches_post on public.matches(post_id);
create table public.scan_runs(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,radar_id uuid not null references public.radars(id) on delete cascade,started_at timestamptz not null default now(),completed_at timestamptz,status text not null,provider text not null,results_count int default 0,new_matches_count int default 0,duration_ms int,error_code text,error_message text,retryable boolean not null default false);
create index scan_history on public.scan_runs(radar_id,started_at desc);
create index scan_user on public.scan_runs(user_id,started_at);
create table public.integrations(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,type text not null check(type in ('telegram','discord','email')),encrypted_credentials text not null,enabled boolean not null default true,configuration_json jsonb not null default '{}',last_success_at timestamptz,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,type));
create table public.radar_integrations(radar_id uuid not null references public.radars(id) on delete cascade,integration_id uuid not null references public.integrations(id) on delete cascade,primary key(radar_id,integration_id));
create index radar_integrations_integration on public.radar_integrations(integration_id);
create table public.notification_deliveries(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,match_id uuid references public.matches(id) on delete cascade,integration_id uuid not null references public.integrations(id) on delete cascade,status text not null default 'queued' check(status in ('queued','sending','sent','failed','uncertain','cancelled')),attempt_count int not null default 0,queued_at timestamptz not null default now(),next_attempt_at timestamptz not null default now(),sent_at timestamptz,last_error text,unique(match_id,integration_id));
create index notification_due on public.notification_deliveries(next_attempt_at) where status='queued';
create index notification_user on public.notification_deliveries(user_id,queued_at desc);
create index notification_integration on public.notification_deliveries(integration_id);
create table public.usage_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,radar_id uuid references public.radars(id) on delete set null,type text not null,quantity int not null default 1,occurred_at timestamptz not null default now());
create index usage_month on public.usage_events(user_id,type,occurred_at);
create index usage_radar on public.usage_events(radar_id);
create table public.muted_authors(user_id uuid not null references auth.users(id) on delete cascade,author_id text not null,primary key(user_id,author_id));
create table public.scan_jobs(radar_id uuid primary key references public.radars(id) on delete cascade,available_at timestamptz not null default now(),requested_at timestamptz not null default now());
create table public.telegram_links(token_hash text primary key,user_id uuid not null references auth.users(id) on delete cascade,expires_at timestamptz not null);
create index telegram_links_user on public.telegram_links(user_id);
create table public.stripe_events(id text primary key,processed_at timestamptz not null default now());
create table public.worker_heartbeats(id text primary key,last_seen_at timestamptz not null default now());
-- All Data API access is read-only. Mutations go through session-authenticated,
-- ownership-checked server endpoints and serialized entitlement checks.
do $$ declare t text; begin
 foreach t in array array['profiles','subscriptions','radars','posts','matches','scan_runs','integrations','radar_integrations','notification_deliveries','usage_events','muted_authors','scan_jobs','telegram_links','stripe_events','worker_heartbeats'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
 foreach t in array array['subscriptions','radars','matches','scan_runs','notification_deliveries','usage_events','muted_authors'] loop
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 end loop;
end $$;
grant select on public.profiles,public.posts to authenticated;
create policy profile_read on public.profiles for select to authenticated using((select auth.uid())=id);
create policy matched_post_read on public.posts for select to authenticated using(exists(select 1 from public.matches m where m.post_id=posts.id and m.user_id=(select auth.uid())));
-- No Data API grant for encrypted credentials, jobs, links, billing event ledger,
-- or heartbeats. Direct database access belongs only to trusted server processes.
