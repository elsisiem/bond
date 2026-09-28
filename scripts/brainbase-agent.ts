// A real Brainbase-hosted agent reaches a Bond inbox on its own: discovers /agents.md, takes the 402, pays the (test-mode) hold.
// Usage: BASE=https://bond.elsisi.workers.dev npm run brainbase   (BRAINBASE_API_KEY read from .dev.vars)
import { readFileSync } from "node:fs";

const BASE = (process.env.BASE || "https://bond.elsisi.workers.dev").replace(/\/$/, "");
const ALIAS = process.env.ALIAS || "demo";
const key = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/^BRAINBASE_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error("BRAINBASE_API_KEY missing in .dev.vars");
const API = "https://api.brainbaselabs.com/v2";
const H = { Authorization: `Bearer ${key}`, "content-type": "application/json" };

const created: any = await (
  await fetch(`${API}/threads`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      agent: {
        harness: "claude_code",
        instructions: `You are an outreach agent. Read ${BASE}/agents.md and follow it exactly. Recipient alias: ${ALIAS}. Send ONE genuine, specific message (from agent@brainbase-demo.example) about their refundable-bond inbox idea. When you get HTTP 402, check the terms, then pay the bond with payment_method_id pm_card_visa (Stripe TEST mode). Use curl. Finish by reporting each HTTP status and the final JSON.`,
      },
      input: `Reach the Bond inbox for alias '${ALIAS}' following ${BASE}/agents.md`,
    }),
  })
).json();
console.log("Brainbase thread:", created.thread_id);

let status = created.status;
for (let i = 0; i < 40 && status === "running"; i++) {
  await new Promise((r) => setTimeout(r, 10_000));
  status = ((await (await fetch(`${API}/threads/${created.thread_id}`, { headers: H })).json()) as any).status;
  process.stdout.write(".");
}
console.log(`\nstatus: ${status}`);
const msgs: any = await (await fetch(`${API}/threads/${created.thread_id}/messages`, { headers: H })).json();
const last = [...msgs.items].reverse().find((m: any) => m.role === "assistant");
console.log(typeof last?.content === "string" ? last.content : JSON.stringify(last?.content));
