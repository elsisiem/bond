# STATUS
## Now
DEPLOYED: https://bond.elsisi.workers.dev (D1 bond 0230dedd..., prod smoke OK: Claude classify+price, hold). Waiting on prod Stripe webhook whsec.
## Done
M0; M1 (code + e2e Stripe test). Stripe CLI installed; `stripe listen --api-key <sk> --events checkout.session.completed,payment_intent.amount_capturable_updated,payment_intent.canceled,payment_intent.succeeded --forward-to http://localhost:8787/webhooks/stripe`.
## Next 3
1. Human: create Stripe webhook endpoint https://bond.elsisi.workers.dev/webhooks/stripe (4 events), give whsec -> secret STRIPE_WEBHOOK_SECRET
2. M4: scripts/simulate-swarm.ts, scripts/legit-agent.ts, /live, landing
3. M2 needs domain + RESEND_API_KEY
## Blockers
Prod whsec. Domain (M2). RESEND_API_KEY empty. Note: unused extra D1 interruption-bond (e63a...) auto-created by wrangler; ignore/delete. Push secrets via `wrangler secret bulk` JSON (piping adds newline).
## How to run
npm run db:local; npm run dev; stripe listen (above); POST /api/dev/inbound with x-dev-secret; agent pay: POST pay_url/pay {"payment_method_id":"pm_card_visa"}. npm run check.
## Gotchas
Bond mail/challenge sending stubbed (events only) until M2. Decision links on /r/{dashboardToken} (GET /api/dev/demo).

