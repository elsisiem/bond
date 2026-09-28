# STATUS
## Now
M1 VERIFIED against Stripe test mode (hold -> junk capture, hold -> worth release, webhook via stripe listen). Next: M4 demo scripts, then deploy.
## Done
M0; M1 (code + e2e Stripe test). Stripe CLI installed; `stripe listen --api-key <sk> --events checkout.session.completed,payment_intent.amount_capturable_updated,payment_intent.canceled,payment_intent.succeeded --forward-to http://localhost:8787/webhooks/stripe`.
## Next 3
1. Anthropic key needs workspace: send anthropic-workspace-id header or get workspace-scoped key (classifier currently falls back to base price)
2. M4: scripts/simulate-swarm.ts, scripts/legit-agent.ts, /live, landing
3. wrangler login, d1 create, deploy, prod webhook + whsec; M2 needs domain
## Blockers
Anthropic workspace scope. wrangler login + D1 database_id. Domain (M2). RESEND_API_KEY empty.
## How to run
npm run db:local; npm run dev; stripe listen (above); POST /api/dev/inbound with x-dev-secret; agent pay: POST pay_url/pay {"payment_method_id":"pm_card_visa"}. npm run check.
## Gotchas
Bond mail/challenge sending stubbed (events only) until M2. Decision links on /r/{dashboardToken} (GET /api/dev/demo).
