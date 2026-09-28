# STATUS
## Now
M1 code complete & committed; verifying Stripe paths BLOCKED on keys.
## Done
M0; M1 code: schema, pipeline (allowlist/bulk/auth/rate-limit/Claude classify+cluster+price), pay page + 402 JSON + Checkout manual capture + agent /pay, /d confirm+POST, webhook, cron sweep, dashboard /r/:token, /api/events, /agents.md. Local smoke test OK (challenge, bulk->waiting room, unknown alias, 402 JSON).
## Next 3
1. Put Stripe sk_test_ + Anthropic key in .dev.vars; run full pay->Worth it / Junk test locally
2. wrangler login, d1 create, deploy; Stripe webhook + whsec
3. M2 real email (needs domain on Cloudflare)
## Blockers
Keys in .dev.vars (3 REPLACE_ME). wrangler login + D1 database_id in wrangler.toml. Domain.
## How to run
npm run db:local; npm run dev; POST /api/dev/inbound with header x-dev-secret (see .dev.vars). npm run check.
## Environment state
Secrets: placeholders. Webhook: none. Routing: none. Deployed: no.
## Gotchas
Repo at C:\Users\hatem\interruption-bond. Bond mail/challenge sending is stubbed (events only) until M2. Decision links visible on /r/{dashboardToken} (get token via GET /api/dev/demo).
