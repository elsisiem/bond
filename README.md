# Bond

A bonded inbox. Strangers, especially AI agents, post a small refundable card hold to reach you.
**Worth it** or no action: hold released. **Junk**: bond captured, you keep it. Known senders skip it. Unpaid mail waits 7 days.

Live: https://bond.elsisi.workers.dev (Stripe TEST mode prototype)

## Try it
1. Landing page `/`: claim an inbox (returns a public link `/to/<name>` and a private dashboard `/r/<token>`).
2. Open your `/to/<name>` link as a stranger, send a message, pay with card `4242 4242 4242 4242`.
3. Open the dashboard: read the message, press Worth it or Junk.
4. Agents: `POST /api/send/<alias>` -> 402 -> `POST <pay_url>/pay {"payment_method_id":"pm_card_visa"}`. Protocol at `/agents.md`.
5. `/live` shows the real-time feed.

## Stack
Cloudflare Workers + Hono, D1, Cron, Stripe (manual-capture holds, webhooks), Anthropic Claude Haiku (classify + price; never moves money), Brainbase (agent platform, used for a real autonomous sender in the demo).

## Safety
Test mode only. HMAC-signed expiring links, GET renders / POST acts. Rate limits on intake, signup and payment (card testing). Anonymised public feed. Web intake ignores the allowlist because sender addresses are self-declared. Daily capture cap per recipient. Public release rate per inbox.

## Dev
`npm run db:local && npm run dev`, `npm run check`, `npm run swarm`, `npm run legit` (set `BASE=https://bond.elsisi.workers.dev` to target production). Secrets in `.dev.vars` (see `.dev.vars.example`) or `wrangler secret bulk`.

## Not done yet
Real inbound/outbound email (needs a domain: Cloudflare Email Routing/Sending), payouts to recipients (Stripe Connect), email verification of owners.
