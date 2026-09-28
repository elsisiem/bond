# Bond (repo: interruption-bond)
Hackathon build (Startup Speedrun: Stripe, Cloudflare, Anthropic, Brainbase). Hacking ends 3:30 PM PT, CODE FREEZE 3:00 PM PT (2026-09-28).
Priorities: (1) demo never breaks, (2) credible startup path, (3) visible real use of Stripe/Cloudflare/Anthropic/Brainbase. Repo deployable at end of every milestone.

## Product
Bonded inbox. Strangers (esp. AI agents) post a small refundable bond (card AUTHORIZATION HOLD, capture_method=manual) to reach you. "Worth it" or no action -> hold released. "Junk" -> bond captured, recipient keeps it. Known senders skip it. Waiting room keeps unpaid mail 7 days; nothing is lost.

## Rules
1. Stripe TEST MODE only. pm_card_visa / 4242 4242 4242 4242.
2. Never email anyone except CONFIG addresses (OWNER_EMAIL / own test). Swarm demo = in-process sim via POST /api/dev/inbound (header x-dev-secret = DEV_SIMULATE_SECRET).
3. Secrets only in .dev.vars / `wrangler secret put`. Never print/log/commit. Keep .dev.vars.example names-only.
4. Fetch current docs before using: Cloudflare Email Workers/Service, Stripe manual-capture Checkout, Stripe webhooks constructEventAsync, Brainbase.
5. Ask human only for human-only steps; batch. Otherwise decide, log in DECISIONS.md.
6. Terse, targeted, no big refactors. 7. Simplest thing: D1 + Cron, no Durable Objects.

## Stack
TS, Cloudflare Workers + Hono, D1, R2 (optional; fallback D1 text cap 200KB), Cron, postal-mime, stripe (fetch client), Anthropic claude-haiku-4-5-20251001 for classification (zod-validated, 5s timeout, fallback base price), vitest, static assets in /public.

## Config (wrangler.toml [vars])
ROOT_DOMAIN, PUBLIC_BASE_URL, OWNER_EMAIL, DEMO_ALIAS=demo, DEFAULT_BOND_CENTS=100, MAX_BOND_CENTS=2500, BOND_HOLD_HOURS=72, WAITING_ROOM_DAYS=7.

## Inbound decision order
alias lookup -> size cap 1MB -> allowlist (free) -> bulk headers (waiting room, no challenge) -> SPF/DKIM/DMARC fail (waiting room) -> classify+price, store, challenge sender (max 1 challenge/sender/recipient/24h; reply only to envelope sender).
Price = base x (1 + 2*bulk_score + 0.25*dupes(cap 3) - rep_discount 0.5), clamp [50, MAX]. Claude never moves money.
Links: GET decision/pay pages only render; POST acts. HMAC-signed expiring tokens.

## Commands
npm run check | npm run dev | npm run db:local | npm run deploy | npm run swarm | npm run legit

## Tool-switch protocol
Repo is memory. Keep PLAN.md ticked, STATUS.md rewritten after every subtask, DECISIONS.md one line per choice. Commit per subtask (feat:/fix:/chore:), tag milestones. Keep `npm run check` green. Resume prompt in RESUME.md.

## Workflow note
Environment: Windows, Git Bash/PowerShell. Repo at C:\Users\hatem\interruption-bond.
