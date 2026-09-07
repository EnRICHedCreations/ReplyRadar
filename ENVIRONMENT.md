# ReplyRadar production environment

ReplyRadar now uses in-app notifications and prepaid usage credits. External Telegram, Discord, and email integrations have been removed. Subscription price IDs are no longer used.

## Web service

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Production ReplyRadar URL, no trailing slash |
| `NEXT_PUBLIC_SUPABASE_URL` | ReplyRadar Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `DATABASE_URL` | Supabase Connect → Session pooler connection string |
| `REDIS_URL` | Hosted Redis URL, preferably `rediss://` |
| `SOCIAL_PROVIDER` | `x` in production |
| `X_BEARER_TOKEN` | Optional on web; worker is the service that performs X searches |
| `STRIPE_SECRET_KEY` | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/stripe/webhook` |

Do not add `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_CA_CERT`, or old integration variables unless the code explicitly requires them for a future change.

## Worker service

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Same Supabase Session Pooler URL as web |
| `SOCIAL_PROVIDER` | `x` |
| `X_BEARER_TOKEN` | X developer app bearer token with Recent Search access |
| `PORT` | Optional; Deploy Hatch workers do not require public HTTP ingress |

The worker performs at most one X Recent Search request per scan. Each radar has a 10–100 result ceiling, production defaults are capped at 25, scanning is never more frequent than every 10 minutes, and scans pause when the prepaid credit balance is too low to safely cover the configured request cap.

## Stripe

Stripe Checkout uses one-time payments for $10, $25, $50, and $100 credit packs. No Stripe Price IDs are required because Checkout creates one-time `price_data` dynamically.

Configure the production webhook endpoint:

`https://YOUR_DOMAIN/api/stripe/webhook`

At minimum subscribe to `checkout.session.completed`. The webhook is the authority that adds purchased credits to the account ledger; returning from Checkout never grants credits by itself.

## Supabase

Apply all migrations in `supabase/migrations`. Credit balances and ledgers are server-only: RLS is enabled and Data API access is revoked from `anon` and `authenticated` roles.

Configure Supabase Auth Site URL and the `/auth/callback` redirect allowlist for the production domain.

## Deploy Hatch

Web:
- Install: `npm install`
- Build: `npm run build`
- Start: `npm start`
- Recommended resources: 2 GB RAM, 1 CPU

Worker:
- Install: `npm install`
- Start: `npm run start`
- Service type: worker

## Production smoke test

1. Confirm `/api/health` reports the database, Redis, and worker healthy.
2. Sign up and confirm an account.
3. Buy a small test credit pack through Stripe test mode first, then verify the credit ledger increments only after the signed webhook.
4. Create a radar with a 10-result cap and a narrow query.
5. Run one scan and confirm the ledger shows a negative scan charge, the balance decreases, and only posts above the radar threshold become matches.
6. Confirm X/provider details appear only in internal `scan_runs.error_message`; the customer history endpoint must expose only sanitized error codes.
