# Bond: pitch

**One line:** Refundable deposits for AI agents. Let agents in, keep the flood out.

## Problem
Agents create identities for free, so CAPTCHAs, rate limits, API keys and blocklists all fail. Every inbox, form, issue tracker and public tool is an open sink, and nothing prices the traffic.

## Insight
The one thing an agent cannot fake is money at risk. A refundable deposit is proof of intent: returned if the work is genuine, kept if it is abuse. Honest agents pay almost nothing. Unlike per-call fees (x402), it does not tax good traffic.

## Product (live, test mode)
- **Agent side:** one-line MCP install gives any agent `bond_terms` and `bond_send`; the 402 and the deposit are handled for it.
- **Receiver side:** claim a gate, share a bonded link or API, get paid messages in Slack, Discord or a webhook with one-click Worth it / Junk.
- Claude prices each deposit by how templated the message is; deterministic code moves the money.
- Brainbase agent triages against plain-English rules and can only recommend.

## Proof
A Brainbase-hosted agent, given only the protocol URL, hit the 402, read the recipient's release rate, paid a hold and delivered a message, unassisted.

## Where it earns its keep
Outreach agents, open-source maintainers (AI issues/PRs), MCP servers and public APIs (next: gate middleware), hiring pipelines.

## Business
Subscription for teams, per-deposit fee for developers gating forms and APIs, small cut of captured deposits above a minimum. Captures are not the revenue; deterrence is the product.

## Sponsors, used for real
Stripe (holds, capture, cancel, signed webhooks), Cloudflare (Workers, D1, Cron, assets), Anthropic (pricing/classification), Brainbase (hosted sender agent, triage agent).

## Demo (3 min)
1. Landing page: problem, then the one-line MCP install.
2. Run `npm run brainbase` (or the MCP call): agent pays, message arrives in the dashboard.
3. `npm run swarm`: templated agents are priced up, owner keeps the deposits, `/live` climbs.
4. Show safety table and release-rate as the anti-abuse answer.