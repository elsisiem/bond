# Bond: pitch

**One line:** AI made cold outreach free, so inboxes drown. Bond makes strangers and agents post a small refundable bond to reach you. Worth it: released. Junk: you keep it.

## Problem
Agents can send unlimited personalised outreach at zero cost. Filters guess and adapt-lose. Nothing compensates the human whose attention is spent.

## Product (live now)
- Bonded contact link and agent API (`402 Payment Required` with machine-readable terms).
- Claude reads each message and prices the bond ($1 for genuine notes, ~$3 for templated mass outreach). Deterministic code moves the money.
- One-click Worth it / Junk. No action auto-releases. Waiting room keeps everything 7 days.

## Why now
Agent platforms (like Brainbase) make autonomous outreach trivial. The toll booth for the agent economy does not exist yet; HTTP 402 has been waiting for this.

## Sponsors, used for real
- **Stripe:** manual-capture authorization holds, capture on Junk, cancel on Worth it, signed webhooks.
- **Cloudflare:** Workers, D1, Cron, static assets. Whole product is one Worker.
- **Anthropic:** Claude Haiku classifies and prices, zod-validated, 5s timeout, safe fallback.
- **Brainbase:** a hosted Brainbase agent discovers `/agents.md`, hits the 402 and pays a bond autonomously.

## Business
Take rate on captured bonds; free for senders who are worth it. Start with founders, investors, creators, maintainers. Wedge: agent-to-agent access via 402. Next: Stripe Connect payouts, real email (Cloudflare Email Routing), team inboxes.

## Demo script (3 min)
1. Landing page: claim an inbox.
2. Run swarm: 5 templated agents pay ~$3 each, owner presses Junk, `/live` counter climbs.
3. Run legit agent (or the Brainbase agent): $1 bond, Worth it, released.
4. Point at the flaw list: rate limits, release rate, capture cap, anonymised feed.
