# ReplyRadar environment setup

Add these in Deploy Hatch's environment settings. Keep secret values there, not in GitHub. Values that belong to your accounts cannot be fabricated.

## Minimum for working mock monitoring

| Variable                               | Exact value or where to get it                                                              | Service |
| -------------------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| `NEXT_PUBLIC_APP_URL`                  | Your verified ReplyRadar web URL; no trailing slash                                         | Web     |
| `NEXT_PUBLIC_SUPABASE_URL`             | ReplyRadar Supabase project URL                                                             | Web     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project → API keys → publishable key                                               | Web     |
| `DATABASE_URL`                         | Supabase Connect → Session pooler connection string, with real URL-encoded password and TLS | Both    |
| `REDIS_URL`                            | Your Redis service connection URL; `rediss://` for TLS                                      | Web     |
| `SOCIAL_PROVIDER`                      | `mock`                                                                                      | Both    |
| `INTEGRATION_ENCRYPTION_KEY`           | Generate once: `openssl rand -hex 32`                                                       | Both    |

The older `NEXT_PUBLIC_SUPABASE_ANON_KEY` is an alternative to the publishable key, not an additional requirement. `SUPABASE_SERVICE_ROLE_KEY` is not used. `AI_API_KEY` and `AI_MODEL` are not used because query generation uses templates.

## Enable live X search

| Variable          | Value                                                  | Service |
| ----------------- | ------------------------------------------------------ | ------- |
| `SOCIAL_PROVIDER` | `x`                                                    | Both    |
| `X_BEARER_TOKEN`  | X developer app bearer token with Recent Search access | Worker  |

Reset stored cursors when switching existing radars from mock to X; see README.

## Enable notifications

| Variable                  | Value                                                                 | Service |
| ------------------------- | --------------------------------------------------------------------- | ------- |
| `TELEGRAM_BOT_TOKEN`      | BotFather token                                                       | Both    |
| `TELEGRAM_BOT_USERNAME`   | Bot username without `@`                                              | Web     |
| `TELEGRAM_WEBHOOK_SECRET` | Generate: `openssl rand -hex 32`; register as Telegram `secret_token` | Web     |
| `RESEND_API_KEY`          | Resend API key                                                        | Both    |
| `EMAIL_FROM`              | Sender address on your verified Resend domain                         | Both    |

Discord webhooks are connected by authenticated users in Integrations, encrypted in the database; no global Discord secret is needed.

## Enable Stripe

| Variable                | Value                                    | Service |
| ----------------------- | ---------------------------------------- | ------- |
| `STRIPE_SECRET_KEY`     | Stripe secret API key                    | Web     |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/stripe/webhook` | Web     |
| `STRIPE_PRICE_STARTER`  | Monthly $19 price ID                     | Web     |
| `STRIPE_PRICE_PRO`      | Monthly $49 price ID                     | Web     |
| `STRIPE_PRICE_GROWTH`   | Monthly $99 price ID                     | Web     |

Configure Stripe Customer Portal for plan changes/cancellation. Paid access is webhook-controlled.

## After entering values

1. Set DATABASE_URL for the selected Supabase project. Combined startup runs migrations automatically; split services require `npm run db:migrate`.
2. Configure Supabase Site URL and `/auth/callback` redirect allowlist, email confirmation, and production SMTP.
3. Redeploy ReplyRadar: the default start command supervises web and worker. Alternatively deploy them independently from the same revision.
4. Check `/api/health`: all three checks must be true.
5. Create and confirm an account, activate a mock radar, inspect its matches and history, connect a channel, and test delivery.
6. Test Stripe checkout and cancellation with test keys before switching to live keys.
