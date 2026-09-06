# ReplyRadar

Find the conversations worth joining. Next.js application with Supabase Auth/PostgreSQL, a standalone Node worker, deterministic mock/official X providers, scored matches, Telegram/Discord/Resend notifications, and Stripe subscriptions.

## Quick start

Node 22+ (24 recommended).

```sh
npm ci
cp .env.example .env.local
# Fill Supabase auth values, DATABASE_URL and REDIS_URL.
# Generate INTEGRATION_ENCRYPTION_KEY using: openssl rand -hex 32
npm run db:migrate
npm run dev
# Separate terminal:
npm run worker
```

The web process loads `.env.local` through Next.js. Worker and operator commands load it through Node. In production, use environment variables managed by the host. Do not commit `.env.local`.

`SOCIAL_PROVIDER=mock` requires no X credentials. It does not replace Supabase or Redis: accounts, matches, queues and quota remain real. The landing-page walkthrough is explicitly illustrative. There is no anonymous dashboard or development authentication bypass.

## Architecture

- **Web:** Next.js App Router, React, TypeScript, Tailwind, Lucide, React Hook Form, Zod. Public marketing/auth routes; session-protected application routes; same-origin authenticated mutations.
- **Auth:** Supabase SSR cookies, verified `getUser()` identity on every API call. Proxy refreshes sessions. Email confirmation and recovery use PKCE.
- **Database:** Supabase PostgreSQL. Direct server `pg` pool handles transactional operations. The browser never receives database credentials. Data API tables are read-only under tenant RLS; integration credentials and internal jobs have no browser grants.
- **Durable queue:** PostgreSQL `scan_jobs` and `notification_deliveries`, an equivalent durable queue instead of BullMQ. Match insertion and delivery-outbox insertion share a transaction. Redis provides atomic API rate limits.
- **Worker:** independent Node process. Scheduler, scanning and notification delivery run without any browser session. Account advisory transaction locks and radar/job row locks serialize scanning and quota changes. Jobs survive worker restarts. Plan downgrades allow only the oldest N enabled radars to scan.
- **Providers:** normalized `SocialSearchProvider`; official X Recent Search with since_id and pagination; deterministic mock provider. X does not require a logged-in user browser. Query validation errors appear in history.
- **Billing:** signed Stripe webhooks fetch current subscription state under an account lock and maintain an event ledger. Redirects grant nothing. Upgrade/downgrade/cancel through Checkout and Customer Portal.

## Supabase setup

Use a dedicated ReplyRadar project. Run `npm run db:migrate` once with its database connection string. The migration was created using the Supabase CLI and is under `supabase/migrations/`.

Tables: profiles, subscriptions, radars, posts, matches, scan_runs, integrations, radar_integrations, notification_deliveries, usage_events, muted_authors, scan_jobs, telegram_links, stripe_events, worker_heartbeats. The migration runner records applied filenames in replyradar_migrations.

Get `DATABASE_URL` from Supabase **Connect → Session pooler**. URL-encode the database password. Use the supplied TLS settings; certificate verification is never disabled. Optional `DATABASE_CA_CERT` accepts a trusted CA PEM. The runtime needs a trusted server database role with table access; the Supabase postgres role works. Keep it exclusively in server environments.

Set Supabase Auth Site URL to your web URL and add `<APP_URL>/auth/callback` to allowed redirect URLs. Enable email/password and email confirmations. Configure production SMTP in Supabase separately from Resend match-alert delivery. The publishable key is preferred; the legacy anon key is supported as a fallback. `SUPABASE_SERVICE_ROLE_KEY` is not needed by this architecture.

## Redis

Supply `REDIS_URL` (`rediss://` for a hosted TLS Redis). Redis is required for mutations and auth rate limiting and fails closed if unavailable. For local Redis: `docker run --rm -p 6379:6379 redis:7-alpine`; use `redis://localhost:6379`. For production enable persistence and authentication on your Redis service.

## X and mock mode

Use `SOCIAL_PROVIDER=x` and `X_BEARER_TOKEN` from your X developer account with Recent Search permission. Existing radar provider choices are persisted; to switch existing mock radars, run an operator-controlled database update setting `provider='x', provider_cursor=null, next_scan_at=now()` after configuring credentials. Never mix mock cursors with X IDs.

Mock queries support `[empty]`, `[error]`, and `[rate-limit]` to simulate zero results, failures and 429s. Otherwise three realistic posts are produced per minute bucket, including overlap with prior scans. Mock X links open the query on X; they never pretend to be real posts by example authors.

X pagination is bounded to 10 pages per scan. If more pages remain, the scan fails with `X_QUERY_TOO_BROAD` without advancing the cursor. Narrow the query. Initial searches use the Recent Search window. Provider errors retry no sooner than the plan interval and upstream reset time. Non-retryable failures defer for an hour for operator intervention.

## Notifications

Each radar selects its integrations in the editor. Connect channels before selecting them, or edit a radar after connecting. Email supports instant and high-opportunity-only (80+) modes. Radar minimum score applies to all its alerts. Discord is enforced for Growth.

All sensitive destinations are AES-256-GCM encrypted with `INTEGRATION_ENCRYPTION_KEY`. Generate one 32-byte key, expressed as 64 hexadecimal characters, and use the same key on web and worker. Back it up securely: replacing it without re-encrypting stored destinations requires reconnecting integrations.

### Telegram

Create an operator-owned bot with BotFather. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (without @), and a generated `TELEGRAM_WEBHOOK_SECRET`. Register `<APP_URL>/api/telegram/webhook` using Telegram `setWebhook` with that exact `secret_token` and `allowed_updates=["message"]`. The setup values belong to the operator; end users never paste bot tokens.

Users connect through a one-time 10-minute deep-link token. Only private chats are accepted. The webhook consumes the hashed token atomically and queues a confirmation. Open Integrations afterward and select Telegram in the radar editor.

### Discord

Create a webhook in Discord channel settings. Paste the complete `https://discord.com/api/webhooks/...` URL into Integrations. Only exact discord.com HTTPS webhook paths are accepted; credentials, alternate hosts, ports, query strings and redirects are rejected. Mentions are disabled in deliveries.

### Email

Set `RESEND_API_KEY` and a verified `EMAIL_FROM` sender. Destinations are restricted to the authenticated user's confirmed email address. Resend receives a stable delivery ID as its idempotency key.

### Delivery semantics

Database uniqueness prevents duplicate match/integration jobs. Only acknowledged deliveries become `sent`. HTTP 429 responses retry with exponential backoff (maximum five attempts). Ambiguous network timeouts or process crashes after sending become `uncertain` and are **not automatically retried**. Telegram/Discord do not offer a general exactly-once delivery guarantee; claiming one would be incorrect. Investigate uncertain messages before manually deciding to retry. Definite non-rate-limit failures require operator action. Notification failure does not roll back a scan.

## Billing

Create monthly Stripe prices: Starter $19, Pro $49, Growth $99, then set `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_GROWTH`. Set `STRIPE_SECRET_KEY`. Register `<APP_URL>/api/stripe/webhook` for `customer.subscription.created`, `.updated`, and `.deleted`; set its signing secret as `STRIPE_WEBHOOK_SECRET`.

Enable Customer Portal with plan switching and cancellation and add all supported products/prices. Test with Stripe test keys first. The webhook API resource is retrieved from Stripe to avoid older events resurrecting stale access. Unrecognized prices grant free entitlements. Monthly scan quota uses calendar months in UTC, independently from Stripe billing-anniversary dates.

## Deployment with Deploy Hatch

Deploy the same repository (`EnRICHedCreations/ReplyRadar`, branch `main`) as two services:

| Setting      | ReplyRadar web  | ReplyRadar worker   |
| ------------ | --------------- | ------------------- |
| Runtime      | Node.js 24      | Node.js 24          |
| Service type | web             | worker              |
| Install      | `npm ci`        | `npm ci`            |
| Build        | `npm run build` | `npm run typecheck` |
| Start        | `npm start`     | `npm run worker`    |
| Memory       | 512 MB minimum  | 512 MB minimum      |

Do not run migrations in the build step. Apply them explicitly once before enabling users. Supply the environment values before the production build so Next.js public variables are compiled correctly. Redeploy after changing public auth values. Supply database, encryption and notification credentials to the worker too.

`/api/health` returns 200 only when database/schema, Redis and worker heartbeat are healthy. It returns 503 with `setup_required` when dependencies are missing. The landing page can be served before configuration, but this does **not** mean the application is operational. Auth pages clearly explain missing Supabase setup.

Worker exposes a separate HTTP health check on `PORT` (default 3001) and records a database heartbeat every 15 seconds. `npm run ops` is an operator-only CLI for users, plans, queue depth, failures and activity; database credentials are its authorization boundary. There is no hidden admin web route.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Tests execute real PostgreSQL semantics using PGlite, with only network providers and the pg connection adapter stubbed. They cover schema application, RLS, scan → match → delivery, deduplication, quota exhaustion, pause/schedules/DST, provider failure/cursor preservation, rate-limit retries, uncertain delivery behavior, encryption/SSRF protection, scoring, normalization, Stripe signatures, duplicate events and state reconciliation.

PGlite is a single-session database. These tests do not prove multi-process lock contention or managed Supabase Auth. `npm run test:e2e` is the browser test suite; use an isolated configured environment and the test values in `.env.example`. Full signup/confirmation/real integrations require live credentials. Never claim those flows passed based only on unit tests.

## Operational boundaries

- AI is optional in the brief; query generation uses deterministic editable templates. No AI API key is needed.
- Email digests, arbitrary outgoing webhooks and Google OAuth are not implemented. The brief allows instant/high-only email and optional OAuth. The initial Growth plan offers Discord; arbitrary URLs are deliberately not exposed as webhook destinations.
- One worker executes scans sequentially; deploy additional workers for volume. Account locks serialize one account's scans. Load-test provider budgets and database connection limits before increasing scale.
- A scan holds a database transaction during the bounded provider request. A process crash rolls back that attempt, so an upstream request already made may not be reflected in local usage. No cursor or matches are partially committed.
- No automated replies, impersonation or X scraping.
- Production signup, payment collection, external notifications and multi-process concurrency must be validated after credentials are configured. Live X data is not verified by mock tests.

## References

[Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [X Recent Search](https://docs.x.com/x-api/posts/search-recent-posts), [Stripe webhooks](https://docs.stripe.com/webhooks), [Telegram Bot API](https://core.telegram.org/bots/api), [Resend API](https://resend.com/docs/api-reference/emails/send-email).
