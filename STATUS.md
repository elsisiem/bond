# STATUS
## Now
M0 bootstrap (12:35 PT).
## Done
Handoff files, package.json, deps installed, wrangler.toml.
## Next 3
1. src/index.ts hello + tsc check, commit  2. Human steps (wrangler login, Stripe/Anthropic keys)  3. M1 schema + pipeline
## Blockers
Awaiting user keys in .dev.vars; wrangler login; D1 create.
## How to run
npm run check; npm run dev
## Environment state
Secrets: placeholders only. Webhook: none. Routing: none. Deployed: no.
## Gotchas
Repo moved out of System32 (permissions). Use `git -c safe.directory=*` not needed in new dir.
