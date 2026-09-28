import { Hono } from "hono";
import type { Env, Inbound } from "./types";
import { HOUR, esc, handle, limited, logEvent, maskEmail, now, uid, usd, verifyToken } from "./lib/util";
import { decide, decisionToken, getBond, markHeld, sweep } from "./lib/bonds";
import { ensureDemoRecipient, processInbound } from "./lib/pipeline";
import { stripeClient, verifyStripeEvent } from "./lib/stripe";
import { TERMS, page } from "./lib/views";
import { AGENTS_MD } from "./lib/agents";
import { DEFAULT_POLICY, startTriage, triageAuth } from "./lib/triage";
import { dashboardHtml } from "./lib/dash";
import { handleMcp } from "./lib/mcp";
import { pushWebhook, safeWebhook } from "./lib/deliver";

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
const ipOf = (c: any) => c.req.header("cf-connecting-ip") || "local";
// Card-testing guard: few attempts per bond and per IP.
async function payLimited(c: any, bondId: string) {
  if (devOk(c)) return false;
  return (await limited(c.env.DB, `paybond:${bondId}`, 6, HOUR)) || (await limited(c.env.DB, `payip:${ipOf(c)}`, 80, HOUR));
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
        recipient: handle(c.env, r.alias),
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
    return page("Bond", `<h1>${bond.status === "held" ? "Bond posted" : "Nothing to pay"}</h1><p class="muted">Status: ${esc(bond.status)}</p>`);
  return page(
    "Post a bond",
    `<h1>Post a ${usd(bond.amount_cents)} bond</h1>
<p class="muted">to reach <b>${esc(handle(c.env, r.alias))}</b> · ${rate === null ? "new recipient" : `${rate}% of bonds released (${decided} decisions)`}</p>
<div class="card"><div class="big">${usd(bond.amount_cents)}</div><p>This is a <b>card hold, not a charge</b>. Your message: <i>${esc(x.m.subject)}</i></p>
<form method="post" action="/b/${esc(token)}/checkout"><button>Post bond securely with Stripe</button></form></div>
<p class="muted">${esc(termsText(c.env))}</p>`,
  );
});

app.post("/b/:token/checkout", async (c) => {
  const token = c.req.param("token");
  const x = await loadPay(c, token);
  if (!x || x.bond.status !== "pending") return page("Unavailable", "<h1>Not available</h1>", 400);
  if (await payLimited(c, x.bond.id)) return page("Slow down", "<h1>Too many attempts</h1><p class=\"muted\">Try again in a few minutes.</p>", 429);
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
          product_data: { name: `Refundable bond to reach ${x.r.alias}`, description: "Card hold. Released unless the recipient marks your message unwanted." },
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
  return page("Bond posted", `<h1>Bond posted</h1><p>Your message was delivered. The ${usd(x.bond.amount_cents)} hold is released automatically unless the recipient marks it unwanted.</p><p class="muted">${esc(termsText(c.env))}</p>`);
});

// Agent path: POST {payment_method_id}
app.post("/b/:token/pay", async (c) => {
  const x = await loadPay(c, c.req.param("token"));
  if (!x) return c.json({ error: "invalid_or_expired" }, 404);
  if (x.bond.status !== "pending") return c.json({ error: "not_payable", status: x.bond.status }, 409);
  if (await payLimited(c, x.bond.id)) return c.json({ error: "rate_limited" }, 429);
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
  const f: any = await c.req.parseBody().catch(() => ({}));
  if (typeof f.back === "string" && /^[a-f0-9]{64}$/.test(f.back)) return c.redirect(`/r/${f.back}#inbox`, 303);
  if (!r.ok) return page("Done", `<h1>Already decided</h1><p class="muted">${esc(r.result)}</p>`);
  return page("Done", `<h1>${r.result === "captured" ? "Bond captured. It's yours." : "Bond released."}</h1>`);
});

// ---------- dashboard ----------
app.get("/r/:token", async (c) => {
  const r: any = await c.env.DB.prepare("SELECT * FROM recipients WHERE dashboard_token=?").bind(c.req.param("token")).first();
  if (!r) return page("Not found", "<h1>Not found</h1>", 404);
  const earn: any = await c.env.DB.prepare("SELECT COALESCE(SUM(cents),0) s FROM ledger WHERE recipient_id=?").bind(r.id).first();
  const st: any = await c.env.DB.prepare("SELECT SUM(status='released') rel, SUM(status IN ('released','captured')) dec FROM bonds WHERE recipient_id=?").bind(r.id).first();
  const held = await c.env.DB.prepare("SELECT b.id, b.amount_cents, m.from_email, m.subject, m.body, m.category, m.summary, b.rec_action, b.rec_reason FROM bonds b JOIN messages m ON m.id=b.message_id WHERE b.recipient_id=? AND b.status='held' ORDER BY b.held_at DESC LIMIT 50").bind(r.id).all<any>();
  const wr = await c.env.DB.prepare("SELECT from_email, subject, reason FROM messages WHERE recipient_id=? AND status='waiting_room' ORDER BY created_at DESC LIMIT 50").bind(r.id).all<any>();
  const hist = await c.env.DB.prepare("SELECT m.from_email, m.subject, b.amount_cents, b.status FROM bonds b JOIN messages m ON m.id=b.message_id WHERE b.recipient_id=? AND b.status IN ('released','captured') ORDER BY b.decided_at DESC LIMIT 50").bind(r.id).all<any>();
  const body = await dashboardHtml(c.env, r, { earn: earn.s, rel: st?.rel || 0, dec: st?.dec || 0, held: held.results, waiting: wr.results, history: hist.results, triage: c.req.query("triage"), hook: c.req.query("hook"), isNew: c.req.query("new") === "1" });
  return page("Dashboard", body, 200, true);
});
// ---------- MCP server: lets any MCP-capable agent reach a Bond inbox ----------
app.post("/mcp", (c) => handleMcp(c.env, c.req.raw, ipOf(c)));
app.get("/mcp", (c) => c.json({ name: "bond", type: "mcp", transport: "streamable-http", docs: `${c.env.PUBLIC_BASE_URL}/agents.md` }));

// ---------- webhook delivery settings ----------
app.post("/r/:token/webhook", async (c) => {
  const r: any = await c.env.DB.prepare("SELECT * FROM recipients WHERE dashboard_token=?").bind(c.req.param("token")).first();
  if (!r) return page("Not found", "<h1>Not found</h1>", 404);
  const f = await c.req.parseBody();
  const raw = String(f.url || "").trim();
  if (raw && !safeWebhook(raw)) return c.redirect(`/r/${r.dashboard_token}?hook=invalid#share`, 303);
  await c.env.DB.prepare("UPDATE recipients SET webhook_url=? WHERE id=?").bind(raw || null, r.id).run();
  if (raw && f.test) await pushWebhook(c.env, raw, "Bond test: bonded messages for " + r.alias + " will appear here with Worth it / Junk links.", r.id);
  return c.redirect(`/r/${r.dashboard_token}?hook=${raw ? (f.test ? "tested" : "saved") : "cleared"}#share`, 303);
});

// ---------- AI triage (Brainbase agent recommends; owner applies) ----------
app.get("/api/triage/pending", async (c) => {
  const rid = await triageAuth(c.env, c.req.header("authorization"));
  if (!rid) return c.json({ error: "unauthorized" }, 401);
  const r: any = await c.env.DB.prepare("SELECT policy FROM recipients WHERE id=?").bind(rid).first();
  const q = await c.env.DB.prepare(
    `SELECT b.id bond_id, b.amount_cents, m.from_email "from", m.subject, m.body, m.category, m.summary, m.bulk_score, m.dupes,
            COALESCE(s.released,0) sender_released, COALESCE(s.captured,0) sender_captured
     FROM bonds b JOIN messages m ON m.id=b.message_id LEFT JOIN senders s ON s.email=m.from_email
     WHERE b.recipient_id=? AND b.status='held' ORDER BY b.held_at LIMIT 25`,
  ).bind(rid).all<any>();
  return c.json({ policy: r?.policy || DEFAULT_POLICY, bonds: q.results.map((b) => ({ ...b, body: String(b.body).slice(0, 1500) })) });
});

app.post("/api/triage/recommend", async (c) => {
  const rid = await triageAuth(c.env, c.req.header("authorization"));
  if (!rid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<any>().catch(() => ({}));
  if (!["worth", "junk"].includes(b.action) || !b.bond_id) return c.json({ error: "bad_request" }, 400);
  const res = await c.env.DB.prepare("UPDATE bonds SET rec_action=?, rec_reason=? WHERE id=? AND recipient_id=? AND status='held'")
    .bind(b.action, String(b.reason || "").slice(0, 300), String(b.bond_id), rid).run();
  if (!res.meta.changes) return c.json({ error: "not_found_or_decided" }, 404);
  await logEvent(c.env.DB, "triage_recommended", rid, null, { action: b.action });
  return c.json({ ok: true });
});

async function ownerByToken(c: any) {
  return c.env.DB.prepare("SELECT * FROM recipients WHERE dashboard_token=?").bind(c.req.param("token")).first();
}
app.post("/r/:token/policy", async (c) => {
  const r: any = await ownerByToken(c);
  if (!r) return page("Not found", "<h1>Not found</h1>", 404);
  const f = await c.req.parseBody();
  await c.env.DB.prepare("UPDATE recipients SET policy=? WHERE id=?").bind(String(f.policy || "").slice(0, 1000) || null, r.id).run();
  return c.redirect(`/r/${r.dashboard_token}#triage`, 303);
});
app.post("/r/:token/triage", async (c) => {
  const r: any = await ownerByToken(c);
  if (!r) return page("Not found", "<h1>Not found</h1>", 404);
  if (await limited(c.env.DB, `triage:${r.id}`, 4, HOUR)) return page("Slow down", "<h1>Triage already ran a few times this hour</h1>", 429);
  const t = await startTriage(c.env, r);
  return c.redirect(`/r/${r.dashboard_token}?triage=${t ? "started" : "unavailable"}#triage`, 303);
});
app.post("/r/:token/apply", async (c) => {
  const r: any = await ownerByToken(c);
  if (!r) return page("Not found", "<h1>Not found</h1>", 404);
  const q = await c.env.DB.prepare("SELECT id, rec_action FROM bonds WHERE recipient_id=? AND status='held' AND rec_action IS NOT NULL").bind(r.id).all<any>();
  for (const b of q.results) await decide(c.env, b.id, b.rec_action);
  return c.redirect(`/r/${r.dashboard_token}`, 303);
});

// ---------- self-serve signup ----------
const RESERVED = new Set(["api", "admin", "www", "live", "agents", "terms", "setup", "webhooks", "b", "d", "r", "to", "signup", "bond", "demo", "support", "root", "help"]);
const ALIAS_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;

app.post("/api/signup", async (c) => {
  const b = await c.req.json<any>().catch(() => ({}));
  const alias = String(b.alias || "").trim().toLowerCase();
  const email = String(b.email || "").trim().toLowerCase();
  if (await limited(c.env.DB, `signup:${ipOf(c)}`, 40, HOUR)) return c.json({ error: "rate_limited" }, 429);
  if (!ALIAS_RE.test(alias) || RESERVED.has(alias)) return c.json({ error: "bad_alias", detail: "3-24 chars: a-z, 0-9, dash. Some names are reserved." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return c.json({ error: "bad_email" }, 400);
  const cents = Math.min(Math.max(Math.round(Number(b.base_cents) || Number(c.env.DEFAULT_BOND_CENTS)), 50), 500);
  const token = uid() + uid();
  try {
    await c.env.DB.prepare("INSERT INTO recipients (id,alias,email,dashboard_token,base_cents,verified,created_at) VALUES (?,?,?,?,?,0,?)")
      .bind(uid(), alias, email, token, cents, now()).run();
  } catch {
    return c.json({ error: "alias_taken" }, 409);
  }
  await logEvent(c.env.DB, "signup", null, null, {});
  const base = c.env.PUBLIC_BASE_URL;
  return c.json({ ok: true, alias, contact_url: `${base}/to/${alias}`, dashboard_url: `${base}/r/${token}` });
});

app.get("/api/alias/:alias", async (c) => {
  const a = c.req.param("alias").toLowerCase();
  if (!ALIAS_RE.test(a) || RESERVED.has(a)) return c.json({ available: false });
  const r = await c.env.DB.prepare("SELECT 1 x FROM recipients WHERE alias=?").bind(a).first();
  return c.json({ available: !r });
});

// ---------- public bonded intake: web form + agent API ----------
async function intake(c: any, alias: string, from: string, subject: string, text: string) {
  if (await limited(c.env.DB, `intake:${ipOf(c)}`, 60, HOUR)) return { http: 429, body: { error: "rate_limited" } };
  const r = await processInbound(c.env, { to: `${alias}@x`, from, subject: subject || "(no subject)", text, headers: {}, unverified: true });
  return { http: r.status === "rejected" ? 404 : 200, body: r };
}

app.get("/to/:alias", async (c) => {
  const alias = c.req.param("alias").toLowerCase();
  const r: any = await c.env.DB.prepare("SELECT alias, base_cents FROM recipients WHERE alias=? AND paused=0").bind(alias).first();
  if (!r) return page("Not found", "<h1>No such inbox</h1>", 404);
  const st: any = await c.env.DB.prepare("SELECT SUM(status='released') rel, SUM(status IN ('released','captured')) dec FROM bonds b JOIN recipients r ON r.id=b.recipient_id WHERE r.alias=?").bind(alias).first();
  const rate = st?.dec ? `${Math.round((100 * (st.rel || 0)) / st.dec)}% of bonds released · ${st.dec} decisions` : "new inbox";
  return page(
    `Contact ${alias}`,
    `<h1>Contact ${esc(alias)}</h1><p class="muted">This inbox is protected by Bond · ${esc(rate)}</p>
<form class="card" method="post" action="/to/${esc(alias)}">
<label>Your email<input name="email" type="email" required maxlength="200" placeholder="you@company.com"></label>
<label>Subject<input name="subject" required maxlength="200"></label>
<label>Message<textarea name="message" required rows="6" maxlength="5000"></textarea></label>
<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<button>Continue</button>
<p class="muted">Unknown senders post a small refundable bond (a card hold, not a charge, around ${usd(r.base_cents)}). If ${esc(alias)} finds your message worthwhile, or does nothing, it is released. Test mode.</p></form>`,
  );
});

app.post("/to/:alias", async (c) => {
  const alias = c.req.param("alias").toLowerCase();
  const f = await c.req.parseBody();
  if (f.website) return page("Sent", "<h1>Thanks</h1>"); // honeypot
  const out = await intake(c, alias, String(f.email || ""), String(f.subject || "").slice(0, 200), String(f.message || "").slice(0, 5000));
  if (out.http === 429) return page("Slow down", "<h1>Too many messages</h1><p class=\"muted\">Try again later.</p>", 429);
  const r: any = out.body;
  if (r.status === "challenged") return c.redirect(r.pay_url, 303);
  if (r.status === "rejected") return page("Error", `<h1>Could not send</h1><p class="muted">${esc(r.reason)}</p>`, 400);
  return page("Received", `<h1>Received</h1><p class="muted">${r.reason === "rate_limited_sender" ? "You already have a bond request open for this inbox. Use the payment link from your first attempt (valid 7 days)." : "Your message is in the waiting room and was not delivered yet."}</p>`);
});

// Agent API: POST {from, subject, text} -> 402 with pay terms, or 200.
app.post("/api/send/:alias", async (c) => {
  const b = await c.req.json<any>().catch(() => ({}));
  const out = await intake(c, c.req.param("alias").toLowerCase(), String(b.from || ""), String(b.subject || "").slice(0, 200), String(b.text || "").slice(0, 5000));
  const r: any = out.body;
  if (r.status === "challenged") return c.json({ error: "payment_required", amount_cents: r.price_cents, pay_url: r.pay_url, docs: `${c.env.PUBLIC_BASE_URL}/agents.md` }, 402, { "X-Bond-Pay-Url": r.pay_url, "X-Bond-Amount-Cents": String(r.price_cents) });
  return c.json(r, out.http as any);
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
  // Public feed is anonymised: no subjects, no full addresses. Full detail only with the dev secret.
  const events = devOk(c)
    ? ev.results
    : (ev.results as any[]).map((e) => {
        let d: any = {};
        try { d = JSON.parse(e.data || "{}"); } catch {}
        const safe: Record<string, unknown> = {};
        if (d.from) safe.from = maskEmail(d.from);
        if (d.category) safe.category = d.category;
        if (d.reason) safe.reason = d.reason;
        return { id: e.id, ts: e.ts, type: e.type, cents: e.cents, data: JSON.stringify(safe) };
      });
  return c.json({ events, stats: s }, 200, { "cache-control": "no-store" });
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
