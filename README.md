# ReplyRadar

ReplyRadar monitors X for high-signal conversations worth joining. It is a Next.js application backed by Supabase/PostgreSQL, Redis rate limiting, a standalone Node worker, official X Recent Search, in-app notifications, and prepaid Stripe usage credits.

ReplyRadar does **not** send automated replies. It surfaces conversations; the user opens X and writes the reply.

## Current product model

- No monthly subscription plans.
- No Telegram, Discord, or email delivery.
- Notifications live inside ReplyRadar.
- Users buy prepaid $10, $25, $50, or $100 credit packs through Stripe Checkout.
- Every successful X scan debits usage credits.
- Monitoring pauses automatically when the balance is too low.
- Every radar has a 10–100 result ceiling per scan.
- Production defaults are capped at 25 results per scan.
- The worker performs at most **one X Recent Search request per scan**.
- Scans are never more frequent than every 10 minutes.

The initial customer charge model is based on the measured X cost of roughly half a cent per returned post and applies a 2× markup. Cost assumptions should be revisited as more real production data is collected.

## Architecture

### Web

Next.js App Router + React + TypeScript.

Responsibilities:
- marketing and authentication
- radar creation/editing
- matches and in-app notifications
- prepaid credit balance and ledger
- Stripe one-time credit purchases
- customer-safe scan history
- Redis-backed mutation/rate limits

### Worker

Production worker repository: `EnRICHedCreations/replyradar-worker`.

Responsibilities:
- schedule due radars
- enforce account credit balance before requesting X
- cap each scan to one X Recent Search request
- retrieve up to the radar result ceiling
- score posts
- discard results below the radar score threshold and `GENERAL_DISCUSSION`
- create qualified matches
- debit the credit ledger atomically
- maintain worker heartbeat

### Database

Supabase PostgreSQL stores:
- profiles
- radars
- posts
- matches
- scan runs
- scan jobs
- worker heartbeats
- usage events
- Stripe event ledger
- prepaid credit accounts
- prepaid credit ledger

Legacy subscription/integration tables may still exist in databases upgraded from earlier builds, but production user flows no longer depend on them. Legacy subscription and external-integration API endpoints return `410 Gone`.

Credit tables are server-only: RLS is enabled and Data API grants are revoked for `anon` and `authenticated` roles.

## X cost controls

The X provider uses the official Recent Search endpoint.

Each scan:
1. locks the account/radar work item
2. reads the customer credit balance
3. reduces the requested result cap if the balance cannot safely cover the configured ceiling
4. refuses to scan if fewer than 10 paid results can be safely covered
5. performs one X request
6. scores returned posts
7. stores only qualified matches
8. debits the actual returned-post charge
9. records billable posts and customer cost on `scan_runs`

The production customer UI never receives raw X response bodies, request IDs, credentials, or operator billing diagnostics. Internal provider details are stored in `scan_runs.error_message`; the specific customer history route exposes sanitized status only.

## In-app notifications

A qualifying match is the notification source of truth. `matches.read_at` tracks unread state.

The UI provides:
- notification bell + unread count
- recent notifications
- dedicated notifications page
- mark one read
- mark all read
- direct Open on X action

No external notification credential is required.

## Stripe prepaid credits

Required web environment variables:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

No Stripe Price IDs are required. Checkout uses one-time `price_data` for fixed packs.

Webhook endpoint:

```text
/api/stripe/webhook
```

At minimum configure Stripe to send `checkout.session.completed`.

The signed webhook is the authority that adds credits. Returning to `/billing?credits=added` does not grant credit by itself.

Credit mutations are stored in `credit_ledger` with a Stripe session uniqueness constraint and a separate `stripe_events` idempotency ledger.

## Production environment

See `ENVIRONMENT.md` for the full current environment list.

### Web

```env
NEXT_PUBLIC_APP_URL=https://replyradar.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
DATABASE_URL=
REDIS_URL=
SOCIAL_PROVIDER=x
X_BEARER_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

`X_BEARER_TOKEN` is primarily required by the worker; it can be omitted from the web service if no web-side provider code uses it.

### Worker

```env
DATABASE_URL=
SOCIAL_PROVIDER=x
X_BEARER_TOKEN=
PORT=3001
```

Do not add the removed Telegram, Discord, Resend, integration-encryption, or subscription-price environment variables.

## Deploy Hatch

### ReplyRadar web

Repository: `EnRICHedCreations/ReplyRadar`

Recommended configuration:
- Runtime: Node.js 24
- Service type: web
- Install: `npm install`
- Build: `npm run build`
- Start: `npm start`
- Memory: 2 GB
- CPU: 1

### ReplyRadar worker

Repository: `EnRICHedCreations/replyradar-worker`

Recommended configuration:
- Runtime: Node.js 24
- Service type: worker
- Install: `npm install`
- Build: none required
- Start: `npm run start`

## Database migrations

Apply all migrations under `supabase/migrations` to the ReplyRadar Supabase project.

Important later migrations include:
- in-app notification read state
- prepaid credit accounts/ledger
- per-scan billable post + cost fields
- per-radar result ceiling
- server-only security for credit tables
- safer 25-result production default

## Production smoke test

1. Confirm the worker is healthy and updating `worker_heartbeats`.
2. Confirm `/api/health` reports database, Redis, and worker healthy.
3. Sign in and open Credits.
4. In Stripe test mode, purchase the $10 pack.
5. Verify the signed webhook creates one positive `credit_ledger` entry and increments `credit_accounts.balance_cents` exactly once.
6. Create a narrow radar with a 10-result cap and a 1-hour interval.
7. Run a scan.
8. Verify at most 10 posts are returned/billed.
9. Verify only posts at or above the radar score threshold become matches.
10. Verify one negative scan ledger entry is created and the balance decreases.
11. Verify in-app notifications appear for qualified matches.
12. Verify scan history shows sanitized customer messages rather than raw X diagnostics.
13. Reduce the credit balance below the minimum safe request and verify the worker pauses with `CREDITS_REQUIRED` without calling X.

## Operational notes

- Redis is required for authenticated write rate limiting.
- The worker uses PostgreSQL advisory locks and row locks to serialize per-account scan work.
- X credentials and raw provider error details must never be returned to normal users.
- Keep queries narrow. Broad queries cost more because X billing is tied to returned data.
- Existing legacy subscription/integration tables can be physically removed in a future destructive cleanup after confirming no production data needs to be retained.
- Real X and Stripe costs should be periodically reconciled against the customer credit ledger before changing retail pricing.
