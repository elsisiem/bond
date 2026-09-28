import { Hono } from "hono";
import type { Env, Inbound } from "./types";
import { esc, logEvent, now, usd, verifyToken } from "./lib/util";
import { decide, decisionToken, getBond, markHeld, sweep } from "./lib/bonds";
import { ensureDemoRecipient, processInbound } from "./lib/pipeline";
import { stripeClient, verifyStripeEvent } from "./lib/stripe";
import { TERMS, page } from "./lib/views";
import { AGENTS_MD } from "./lib/agents";

export type { Env };
const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true, name: "bond" }));

// ---------- dev / simulation ----------
const devOk = (c: any) => !!c.env.DEV_SIMULATE_SECRET && c.req.header("x-dev-secret") === c.env.DEV_SIMULATE_SECRET;

app.post("/api/dev/inbound", async (c) => {
  if (!devOk(c)) return c.json({ error: "forbidden" }, 403);
  await ensureDemoRecipient(c.env);
  const b = await c.req.json<any>();
  const inb: Inbound = {
    to: b.to || `${c.env.DEMO_ALIAS}@${c.env.ROOT_DOMAIN}`,
    from: String(b.from || ""),
    subject: String(b.subject || "(no subject)"),
    text: String(b.text || ""),
    headers: Object.fromEntries(Object.entries(b.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)])),
  };
  return c.json(await processInbound(c.env, inb));
});

app.post("/api/dev/reset", async (c) => {
  if (!devOk(c)) return c.json({ error: "forbidden" }, 403);
  for (const t of ["messages", "bonds", "ledger", "events", "senders", "allowlist", "processed_events"]) await c.env.DB.prepare(`DELETE FROM ${t}`).run();
  return c.json({ ok: true });
});

app.get("/api/dev/demo", async (c) => {
  if (!devOk(c)) return c.json({ error: "forbidden" }, 403);
  await ensureDemoRecipient(c.env);
  const r = await c.env.DB.prepare("SELECT dashboard_token FROM recipients WHERE alias=?").bind(c.env.DEMO_ALIAS).first<any>();
  return c.json({ dashboard: `${c.env.PUBLIC_BASE_URL}/r/${r.dashboard_token}` });
});

// ---------- pay page ----------
async function loadPay(c: any, token: string) {
  const p = await verifyToken<{ t: string; b: string }>(c.env.TOKEN_SECRET, token);
  if (!p || p.t !== "pay") return null;
  const bond = await getBond(c.env, p.b);
  if (!bond) return null;
  const m: any = await c.env.DB.prepare("SELECT * FROM messages WHERE id=?").bind(bond.message_id).first();
  const r: any = await c.env.DB.prepare("SELECT * FROM recipients WHERE id=?").bind(bond.recipient_id).first();
  const st: any = await c.env.DB.prepare("SELECT SUM(status='released') rel, SUM(status IN ('released','captured')) dec FROM bonds WHERE recipient_id=?").bind(bond.recipient_id).first();
  const rate = st?.dec ? Math.round((100 * (st.rel || 0)) / st.dec) : null;
  return { bond, m, r, rate, decided: st?.dec || 0 };
}
const termsText = (env: Env) => TERMS.replace("{H}", env.BOND_HOLD_HOURS);

app.get("/b/:token", async (c) => {
  const token = c.req.param("token");
  const x = await loadPay(c, token);
  if (!x) return page("Invalid link", "<h1>Link invalid or expired</h1>", 404);
  const { bond, r, rate, decided } = x;
  if ((c.req.header("accept") || "").includes("application/json")) {
    return c.json(
      {
        error: "payment_required",
        status: bond.status,
        amount_cents: bond.amount_cents,
        currency: "usd",
        type: "authorization_hold",
        recipient: `${r.alias}@${c.env.ROOT_DOMAIN}`,
        recipient_release_rate: rate === null ? null : rate / 100,
        recipient_decisions: decided,
        terms: termsText(c.env),
        pay: { method: "POST", url: `${c.env.PUBLIC_BASE_URL}/b/${token}/pay`, body: { payment_method_id: "pm_..." } },
        docs: `${c.env.PUBLIC_BASE_URL}/agents.md`,
      },
      bond.status === "pending" ? 402 : 200,
      { "X-Bond-Amount-Cents": String(bond.amount_cents) },
    );
  }
  if (bond.status !== "pending")
    return page("Bond", `<h1>${bond.status === "held" ? "Bond posted ✓" : "Nothing to pay"}</h1><p class="muted">Status: ${esc(bond.status)}</p>`);
  return page(
    "Post a bond",
    `<h1>Post a ${usd(bond.amount_cents)} bond</h1>
<p class="muted">to reach <b>${esc(r.alias)}@${esc(c.env.ROOT_DOMAIN)}</b> · ${rate === null ? "new recipient" : `${rate}% of bonds released (${decided} decisions)`}</p>
<div class="card"><div class="big">${usd(bond.amount_cents)}</div><p>This is a <b>card hold, not a charge</b>. Your message: <i>${esc(x.m.subject)}</i></p>
<form method="post" action="/b/${esc(token)}/checkout"><button>Post bond securely with Stripe</button></form></div>
<p class="muted">${esc(termsText(c.env))}</p>`,
  );
});

app.post("/b/:token/checkout", async (c) => {
  const token = c.req.param("token");
  const x = await loadPay(c, token);
  if (!x || x.bond.status !== "pending") return page("Unavailable", "<h1>Not available</h1>", 400);
  const base = c.env.PUBLIC_BASE_URL;
  const meta = { bond_id: x.bond.id, message_id: x.bond.message_id };
  const s = await stripeClient(c.env).checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: x.bond.amount_cents,
          product_data: { name: `Refundable bond to reach ${x.r.alias}@${c.env.ROOT_DOMAIN}`, description: "Card hold. Released unless the recipient marks your message unwanted." },
        },
      },
    ],
    payment_intent_data: { capture_method: "manual", metadata: meta },
    metadata: meta,
    success_url: `${base}/b/${token}/done?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/b/${token}`,
  });
  await c.env.DB.prepare("UPDATE bonds SET session_id=? WHERE id=?").bind(s.id, x.bond.id).run();
  return c.redirect(s.url!, 303);
});

// Success redirect: verify with Stripe directly (webhook is the backup path).
app.get("/b/:token/done", async (c) => {
  const x = await loadPay(c, c.req.param("token"));
  const sid = c.req.query("session_id");
  if (!x || !sid) return page("Invalid", "<h1>Invalid</h1>", 400);
  const s = await stripeClient(c.env).checkout.sessions.retrieve(sid);
  if (s.metadata?.bond_id !== x.bond.id) return page("Invalid", "<h1>Invalid</h1>", 400);
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
  if (s.status === "complete" && pi) await markHeld(c.env, x.bond.id, pi);
  return page("Bond posted", `<h1>Bond posted ✓</h1><p>Your message was delivered. The ${usd(x.bond.amount_cents)} hold is released automatically unless the recipient marks it unwanted.</p><p class="muted">${esc(termsText(c.env))}</p>`);
});

// Agent path: POST {payment_method_id}
app.post("/b/:token/pay", async (c) => {
  const x = await loadPay(c, c.req.param("token"));
  if (!x) return c.json({ error: "invalid_or_expired" }, 404);
  if (x.bond.status !== "pending") return c.json({ error: "not_payable", status: x.bond.status }, 409);
  const body = await c.req.json<{ payment_method_id?: string }>().catch(() => ({}) as { payment_method_id?: string });
  if (!body.payment_method_id || !/^pm_/.test(body.payment_method_id)) return c.json({ error: "payment_method_id required" }, 400);
  try {
    const pi = await stripeClient(c.env).paymentIntents.create({
      amount: x.bond.amount_cents,
      currency: "usd",
      capture_method: "manual",
      confirm: true,
      payment_method: body.payment_method_id,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { bond_id: x.bond.id, message_id: x.bond.message_id },
    });
    if (pi.status !== "requires_capture") return c.json({ error: "payment_failed", status: pi.status }, 402);
    await markHeld(c.env, x.bond.id, pi.id);
    return c.json({ ok: true, status: "held", amount_cents: x.bond.amount_cents, message: "delivered" });
  } catch (e) {
    return c.json({ error: "payment_failed", detail: (e as Error).message }, 402);
  }
});

// ---------- decision links (GET renders, POST acts) ----------
type Dec = { t: string; b: string; a: "worth" | "junk" };

app.get("/d/:token", async (c) => {
  const token = c.req.param("token");
  const p = await verifyToken<Dec>(c.env.TOKEN_SECRET, token);
  if (!p || p.t !== "dec") return page("Invalid", "<h1>Link invalid or expired</h1>", 404);
  const bond = await getBond(c.env, p.b);
  if (!bond) return page("Invalid", "<h1>Not found</h1>", 404);
  if (bond.status !== "held") return page("Done", `<h1>Already decided</h1><p class="muted">Bond status: ${esc(bond.status)}</p>`);
  const m: any = await c.env.DB.prepare("SELECT from_email, subject FROM messages WHERE id=?").bind(bond.message_id).first();
  const worth = p.a === "worth";
  return page(
    "Confirm",
    `<h1>${worth ? "Mark as Worth it?" : `Mark as Junk and keep ${usd(bond.amount_cents)}?`}</h1>
<div class="card"><p>From <b>${esc(m.from_email)}</b><br>${esc(m.subject)}</p>
<p class="muted">${worth ? "The bond is released and this sender is trusted from now on." : "The bond is captured and credited to you."}</p>
<form method="post" action="/d/${esc(token)}"><button class="${worth ? "green" : "red"}">${worth ? "Yes, worth it" : "Yes, junk"}</button></form></div>`,
  );
});

app.post("/d/:token", async (c) => {
  const p = await verifyToken<Dec>(c.env.TOKEN_SECRET, c.req.param("token"));
  if (!p || p.t !== "dec") return page("Invalid", "<h1>Link invalid or expired</h1>", 404);
  const r = await decide(c.env, p.b, p.a);
  if (!r.ok) return page("Done", `<h1>Already decided</h1><p class="muted">${esc(r.result)}</p>`);
  return page("Done", `<h1>${r.result === "captured" ? "Bond captured — it's yours." : "Bond released."} ✓</h1>`);
});

// ---------- dashboard ----------
app.get("/r/:token", async (c) => {
  const r: any = await c.env.DB.prepare("SELECT * FROM recipients WHERE dashboard_token=?").bind(c.req.param("token")).first();
  if (!r) return page("Not found", "<h1>Not found</h1>", 404);
  const earn: any = await c.env.DB.prepare("SELECT COALESCE(SUM(cents),0) s FROM ledger WHERE recipient_id=?").bind(r.id).first();
  const st: any = await c.env.DB.prepare("SELECT SUM(status='released') rel, SUM(status IN ('released','captured')) dec, SUM(status='held') held FROM bonds WHERE recipient_id=?").bind(r.id).first();
  const held = await c.env.DB.prepare("SELECT b.id, b.amount_cents, m.from_email, m.subject FROM bonds b JOIN messages m ON m.id=b.message_id WHERE b.recipient_id=? AND b.status='held' ORDER BY b.held_at DESC LIMIT 20").bind(r.id).all<any>();
  const wr = await c.env.DB.prepare("SELECT from_email, subject, reason FROM messages WHERE recipient_id=? AND status='waiting_room' ORDER BY created_at DESC LIMIT 20").bind(r.id).all<any>();
  let heldRows = "";
  for (const h of held.results) {
    heldRows += `<tr><td>${esc(h.from_email)}<br><span class="muted">${esc(h.subject)}</span></td><td>${usd(h.amount_cents)}</td><td><a class="btn green" href="/d/${await decisionToken(c.env, h.id, "worth")}">Worth it</a> <a class="btn red" href="/d/${await decisionToken(c.env, h.id, "junk")}">Junk</a></td></tr>`;
  }
  return page(
    "Dashboard",
    `<h1>${esc(r.alias)}@${esc(c.env.ROOT_DOMAIN)}</h1><p class="muted">Delivers to ${esc(r.email)} · base bond ${usd(r.base_cents)}</p>
<div class="card"><div class="big">${usd(earn.s)}</div><span class="muted">earned from junk · ${st.dec ? Math.round((100 * (st.rel || 0)) / st.dec) + "% release rate" : "no decisions yet"} · ${st.held || 0} bonds held</span></div>
<h2>Pending decisions</h2><div class="card"><table>${heldRows || '<tr><td class="muted">None</td></tr>'}</table></div>
<h2>Waiting room</h2><div class="card"><table>${wr.results.map((w) => `<tr><td>${esc(w.from_email)}</td><td>${esc(w.subject)}</td><td><span class="pill">${esc(w.reason)}</span></td></tr>`).join("") || '<tr><td class="muted">Empty</td></tr>'}</table></div>`,
  );
});

// ---------- events / static docs ----------
app.get("/api/events", async (c) => {
  const since = Number(c.req.query("since") || 0);
  const ev = await c.env.DB.prepare("SELECT id,ts,type,cents,data FROM events WHERE id>? ORDER BY id LIMIT 200").bind(since).all();
  const s = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM messages WHERE status='waiting_room') waiting,
            (SELECT COUNT(*) FROM messages WHERE status IN ('challenged','expired')) unpaid,
            (SELECT COUNT(*) FROM bonds WHERE status='held') held,
            (SELECT COUNT(*) FROM bonds WHERE status='released') released,
            (SELECT COUNT(*) FROM bonds WHERE status='captured') captured,
            (SELECT COALESCE(SUM(cents),0) FROM ledger) captured_cents,
            (SELECT COALESCE(SUM(amount_cents),0) FROM bonds WHERE status='held') held_cents,
            (SELECT COUNT(*) FROM messages) total`,
  ).first();
  return c.json({ events: ev.results, stats: s }, 200, { "cache-control": "no-store" });
});
app.get("/agents.md", (c) => c.text(AGENTS_MD.replaceAll("{BASE}", c.env.PUBLIC_BASE_URL), 200, { "content-type": "text/markdown; charset=utf-8" }));
app.get("/terms", (c) => page("Terms", `<h1>Terms</h1><p>${esc(termsText(c.env))}</p>`));

// ---------- Stripe webhook ----------
app.post("/webhooks/stripe", async (c) => {
  const raw = await c.req.text();
  let ev;
  try {
    ev = await verifyStripeEvent(c.env, raw, c.req.header("stripe-signature") || "");
  } catch {
    return c.text("bad signature", 400);
  }
  const ins = await c.env.DB.prepare("INSERT OR IGNORE INTO processed_events (id,ts) VALUES (?,?)").bind(ev.id, now()).run();
  if (!ins.meta.changes) return c.json({ received: true, duplicate: true });
  const o: any = ev.data.object;
  if (ev.type === "checkout.session.completed" && o.metadata?.bond_id && o.payment_intent) await markHeld(c.env, o.metadata.bond_id, o.payment_intent);
  else if (ev.type === "payment_intent.amount_capturable_updated" && o.metadata?.bond_id) await markHeld(c.env, o.metadata.bond_id, o.id);
  else if (ev.type === "payment_intent.canceled" || ev.type === "payment_intent.succeeded") await logEvent(c.env.DB, ev.type, null, o.amount ?? null, { pi: o.id });
  return c.json({ received: true });
});

app.get("/live", (c) => c.env.ASSETS.fetch(new Request(new URL("/live.html", c.req.url))));
app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  scheduled: async (_e: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(sweep(env));
  },
};
