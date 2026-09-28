import type { Env } from "../types";
import { HOUR, limited, verifyToken } from "./util";
import { processInbound } from "./pipeline";
import { getBond, markHeld } from "./bonds";
import { stripeClient } from "./stripe";

// Minimal remote MCP server (streamable HTTP, JSON responses). Lets any MCP-capable agent reach a Bond inbox.
const TOOLS = [
  {
    name: "bond_send",
    description:
      "Send a message to a Bond-protected inbox. If the inbox requires a bond, this posts a refundable deposit (a Stripe card hold, not a charge) and delivers the message. Junk forfeits the deposit; otherwise it is released. TEST MODE: payment_method_id defaults to pm_card_visa.",
    inputSchema: {
      type: "object",
      properties: {
        alias: { type: "string", description: "Inbox name, e.g. 'demo' (from https://.../to/<alias>)" },
        from: { type: "string", description: "Your sender address or identity, e.g. agent@yourco.ai" },
        subject: { type: "string" },
        text: { type: "string", description: "The message. Be specific and human-relevant; templated mass outreach is priced higher." },
        payment_method_id: { type: "string", description: "Stripe payment method (pm_...). Optional in test mode." },
      },
      required: ["alias", "from", "subject", "text"],
    },
  },
  {
    name: "bond_terms",
    description: "Look up a Bond inbox's public terms: base bond and how often it releases deposits (its release rate). Check this before paying.",
    inputSchema: { type: "object", properties: { alias: { type: "string" } }, required: ["alias"] },
  },
];

const ok = (id: any, result: any) => ({ jsonrpc: "2.0", id, result });
const err = (id: any, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const text = (o: unknown, isError = false) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }], isError });

async function callTool(env: Env, name: string, a: any, ip: string) {
  const alias = String(a?.alias || "").toLowerCase();
  if (name === "bond_terms") {
    const r: any = await env.DB.prepare("SELECT id, base_cents, paused FROM recipients WHERE alias=?").bind(alias).first();
    if (!r) return text({ error: "unknown_alias" }, true);
    const st: any = await env.DB.prepare("SELECT SUM(status='released') rel, SUM(status IN ('released','captured')) dec FROM bonds WHERE recipient_id=?").bind(r.id).first();
    return text({ alias, base_bond_cents: r.base_cents, decisions: st?.dec || 0, release_rate: st?.dec ? (st.rel || 0) / st.dec : null, accepting: !r.paused });
  }
  if (name !== "bond_send") return text({ error: "unknown_tool" }, true);
  if (await limited(env.DB, `mcp:${ip}`, 40, HOUR)) return text({ error: "rate_limited" }, true);
  const res = await processInbound(env, {
    to: `${alias}@x`, from: String(a.from || ""), subject: String(a.subject || "").slice(0, 200), text: String(a.text || "").slice(0, 5000), headers: {}, unverified: true,
  });
  if (res.status !== "challenged") return text({ status: res.status, reason: res.reason ?? null });
  const p = await verifyToken<{ t: string; b: string }>(env.TOKEN_SECRET, String(res.pay_url).split("/b/")[1] || "");
  const bond = p ? await getBond(env, p.b) : null;
  if (!bond) return text({ error: "bond_unavailable" }, true);
  try {
    const pi = await stripeClient(env).paymentIntents.create({
      amount: bond.amount_cents, currency: "usd", capture_method: "manual", confirm: true,
      payment_method: String(a.payment_method_id || "pm_card_visa"),
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { bond_id: bond.id, message_id: bond.message_id },
    });
    if (pi.status !== "requires_capture") return text({ status: "payment_failed", detail: pi.status }, true);
    await markHeld(env, bond.id, pi.id);
    return text({ status: "delivered", deposit_cents: bond.amount_cents, category: res.category, note: "Deposit is held, not charged. It is released unless the recipient marks your message junk." });
  } catch (e) {
    return text({ status: "payment_failed", detail: (e as Error).message }, true);
  }
}

export async function handleMcp(env: Env, req: Request, ip: string): Promise<Response> {
  let msg: any;
  try { msg = await req.json(); } catch { return Response.json(err(null, -32700, "parse error"), { status: 400 }); }
  const one = async (m: any) => {
    const id = m?.id;
    switch (m?.method) {
      case "initialize":
        return ok(id, { protocolVersion: m.params?.protocolVersion || "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "bond", version: "0.1.0" }, instructions: "Bond gives agents a refundable-deposit way to reach protected inboxes. Use bond_terms then bond_send." });
      case "ping": return ok(id, {});
      case "tools/list": return ok(id, { tools: TOOLS });
      case "tools/call": return ok(id, await callTool(env, m.params?.name, m.params?.arguments, ip));
      default:
        return id === undefined ? null : err(id, -32601, "method not found");
    }
  };
  if (Array.isArray(msg)) {
    const out = (await Promise.all(msg.map(one))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 202 });
  }
  const out = await one(msg);
  return out ? Response.json(out) : new Response(null, { status: 202 });
}
