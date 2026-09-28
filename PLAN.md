# Plan (scaled: start 12:29 PT, freeze 3:00 PT)
- [x] M0 Bootstrap: scaffold, handoff files, hello-world deploy
- [x] M1 Money loop (simulated inbound): schema, alias, /api/dev/inbound, pricing, /b pay + Checkout manual capture, webhook->held, /d confirm+POST, release/capture, ledger, cron
- [ ] M2 Real email: Email Worker inbound, challenge out, bonded delivery, backscatter guards
- [ ] M3 Intelligence: Claude classify+price (zod), clustering, release-rate stat  (CUT: digest, reputation if behind)
- [ ] M4 Demo: /live, scripts/simulate-swarm.ts, scripts/legit-agent.ts, /agents.md, landing
- [ ] M5 Harden: 3 demo runs, README, PITCH.md, final deploy, tag
Stretch: Connect payouts, x402/MPP, Brainbase agents, Slack webhook, /@name
Cut order: digest, reputation, clustering, real-email, setup page.
