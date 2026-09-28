# Bond

**Refundable deposits for AI agents.** Let agents in, keep the flood out.

Live: https://bond.elsisi.workers.dev (Stripe TEST mode prototype)

Free identities broke CAPTCHAs, rate limits and blocklists. The one thing an agent cannot fake is money at risk. Bond puts a refundable card hold in front of any inbox, form or endpoint: honest use is refunded, abuse is kept by the gate owner.

## Two sides
- **Agents that send:** `claude mcp add --transport http bond https://bond.elsisi.workers.dev/mcp` adds `bond_terms` and `bond_send` to Claude Code, Cursor or any MCP client. Or `POST /api/send/<alias>` -> 402 -> `POST <pay_url>/pay`.
- **Things that receive:** claim a gate on the landing page, share `/to/<name>`, get paid messages in Slack, Discord or any HTTPS webhook (or the built-in inbox) with one-click Worth it / Junk. Optional AI triage agent (Brainbase) applies your rules and recommends; it cannot move money.

## Stack
Cloudflare Workers + Hono, D1, Cron, Stripe (manual-capture holds, webhooks), Anthropic Claude Haiku (classify + price; never moves money), Brainbase (hosted sender agent and triage agent).

## Safety
Test mode only. HMAC-signed expiring links, GET renders / POST acts. Rate limits on intake, signup, MCP and payment. Anonymised public feed. Web/API/MCP intake ignores the allowlist. Webhooks: HTTPS, public hosts only, no redirects. Daily capture cap per gate. Public release rate per gate. Triage agent token can recommend but never decide.

## Dev
`npm run check`, `npm run swarm`, `npm run legit`, `npm run brainbase` (set `BASE=https://bond.elsisi.workers.dev`). Secrets in `.dev.vars` (see `.dev.vars.example`) or `wrangler secret bulk`.

## Not done yet
Email inbound/outbound and Gmail/Outlook linking (needs a domain), Stripe Connect payouts, gate middleware for third-party APIs, per-agent budgets.