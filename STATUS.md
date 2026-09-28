# STATUS
## Now
Agent-first repositioning shipped: MCP server (/mcp: bond_terms, bond_send), webhook delivery (Slack/Discord/any), inbox-style dashboard, landing rewritten around deposits for agents. Next: gate middleware, agent budgets, pitch polish.
## Done
M0; M1 (code + e2e Stripe test). Stripe CLI installed; `stripe listen --api-key <sk> --events checkout.session.completed,payment_intent.amount_capturable_updated,payment_intent.canceled,payment_intent.succeeded --forward-to http://localhost:8787/webhooks/stripe`.
## Brainbase
VERIFIED: (1) hosted agent pays a bond autonomously (npm run brainbase). (2) AI TRIAGE: dashboard policy in plain English, "Run AI triage" starts a Brainbase agent with a 1h least-privilege token (read pending + recommend only, cannot decide); owner presses Apply. Tested on prod: 4/4 correct. Idea left: phone triage from +1 628 287 6528.
## Next 3
1. M5: README.md, PITCH.md, run demo 3x (reset via POST /api/dev/reset)
2. Browser Checkout click-through test (human card entry 4242)
3. M2 real email: needs domain + RESEND_API_KEY
## Blockers
Domain (M2). RESEND_API_KEY empty. Note: unused extra D1 interruption-bond (e63a...) auto-created by wrangler; ignore/delete. Push secrets via `wrangler secret bulk` JSON (piping adds newline).
## How to run
npm run db:local; npm run dev; stripe listen (above); POST /api/dev/inbound with x-dev-secret; agent pay: POST pay_url/pay {"payment_method_id":"pm_card_visa"}. npm run check.
## Gotchas
Bond mail/challenge sending stubbed (events only) until M2. Decision links on /r/{dashboardToken} (GET /api/dev/demo).







