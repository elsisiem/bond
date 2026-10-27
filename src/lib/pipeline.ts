import type { Env, Inbound } from "../types";
import { DAY, HOUR, handle, logEvent, now, uid, usd } from "./util";
import { allowMatch, authFailed, isBulk, jaccard, price, shingles } from "./pricing";
import { classify } from "./classify";
import { payToken } from "./bonds";
import { sendMail } from "./deliver";

const MAX_SIZE = 1_000_000;
const MAX_BODY = 200_000;
const MAX_CHALLENGES_PER_DOMAIN_HOUR = 30;

export type InboundResult = {
  status: "rejected" | "passed_free" | "waiting_room" | "challenged";
  reason?: string;
  message_id?: string;
  price_cents?: number;
  pay_url?: string;
  category?: string;
};

export async function ensureDemoRecipient(env: Env) {
  const alias = env.DEMO_ALIAS.toLowerCase();
  const ex = await env.DB.prepare("SELECT id FROM recipients WHERE alias=?").bind(alias).first();
  if (ex) return;
  await env.DB.prepare("INSERT INTO recipients (id,alias,email,dashboard_token,base_cents,verified,created_at) VALUES (?,?,?,?,?,1,?)")
    .bind(uid(), alias, env.OWNER_EMAIL, uid() + uid(), Number(env.DEFAULT_BOND_CENTS), now()).run();
}

async function store(env: Env, rec: any, inb: Inbound, status: string, extra: Partial<Record<string, any>> = {}) {
  const id = uid();
  const t = now();
  await env.DB.prepare(
    `INSERT INTO messages (id,recipient_id,from_email,subject,body,status,reason,price_cents,category,summary,bulk_score,dupes,shingles,created_at,expires_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id, rec.id, inb.from.toLowerCase(), inb.subject.slice(0, 300), inb.text.slice(0, MAX_BODY), status, extra.reason ?? null,
    extra.price ?? null, extra.category ?? null, extra.summary ?? null, extra.bulk ?? null, extra.dupes ?? 0, extra.shingles ?? null,
    t, t + Number(env.WAITING_ROOM_DAYS) * DAY,
  ).run();
  return id;
}

export async function processInbound(env: Env, inb: Inbound): Promise<InboundResult> {
  const alias = inb.to.split("@")[0].toLowerCase();
  const rec = await env.DB.prepare("SELECT * FROM recipients WHERE alias=?").bind(alias).first<any>();
  if (!rec) return { status: "rejected", reason: "unknown_alias" };
  if ((inb.size ?? inb.text.length) > MAX_SIZE) return { status: "rejected", reason: "too_large" };
  const from = inb.from.toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(from)) return { status: "rejected", reason: "bad_sender" };

  const wait = async (reason: string) => {
    const id = await store(env, rec, inb, "waiting_room", { reason });
    await logEvent(env.DB, "waiting_room", rec.id, null, { reason, from });
    return { status: "waiting_room" as const, reason, message_id: id };
  };

  const al = await env.DB.prepare("SELECT pattern FROM allowlist WHERE recipient_id=?").bind(rec.id).all<{ pattern: string }>();
  if (!inb.unverified && allowMatch(al.results.map((r) => r.pattern), from)) {
    const id = await store(env, rec, inb, "passed_free", { reason: "allowlist" });
    await logEvent(env.DB, "passed_free", rec.id, null, { from });
    await sendMail(env, { to: rec.email, subject: inb.subject, text: inb.text, replyTo: from }, rec.id, "free");
    return { status: "passed_free", message_id: id };
  }
  if (rec.paused) return wait("paused");
  if (isBulk(inb.headers, from)) return wait("bulk_headers");
  if (authFailed(inb.headers)) return wait("auth_failed");

  const t = now();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) c FROM messages WHERE recipient_id=? AND from_email=? AND created_at>? AND status IN ('challenged','held')",
  ).bind(rec.id, from, t - DAY).first<{ c: number }>();
  if ((recent?.c ?? 0) >= 1) return wait("rate_limited_sender");
  const dom = from.split("@")[1];
  const domN = await env.DB.prepare(
    "SELECT COUNT(*) c FROM messages WHERE from_email LIKE ? AND created_at>? AND status IN ('challenged','held')",
  ).bind("%@" + dom, t - HOUR).first<{ c: number }>();
  if ((domN?.c ?? 0) >= MAX_CHALLENGES_PER_DOMAIN_HOUR) return wait("rate_limited_domain");

  // classify + price
  const c = await classify(env, from, inb.subject, inb.text);
  const sh = shingles(inb.text.slice(0, 1500)).sort().slice(0, 300);
  const prev = await env.DB.prepare(
    "SELECT shingles FROM messages WHERE recipient_id=? AND created_at>? AND shingles IS NOT NULL ORDER BY created_at DESC LIMIT 100",
  ).bind(rec.id, t - DAY).all<{ shingles: string }>();
  let dupes = 0;
  for (const p of prev.results) if (jaccard(sh, JSON.parse(p.shingles)) >= 0.6) dupes++;
  const rep = await env.DB.prepare("SELECT released, captured FROM senders WHERE email=?").bind(from).first<{ released: number; captured: number }>();
  const repDiscount = rep && rep.released >= 2 && rep.captured === 0 ? 0.5 : 0;
  const cents = price({ base: rec.base_cents, bulkScore: c.bulk_score, dupes, repDiscount, max: Number(env.MAX_BOND_CENTS) });

  const mid = await store(env, rec, inb, "challenged", {
    price: cents, category: c.category, summary: c.one_line_summary, bulk: c.bulk_score, dupes, shingles: JSON.stringify(sh),
  });
  const bondId = uid();
  await env.DB.prepare("INSERT INTO bonds (id,message_id,recipient_id,amount_cents,status,created_at) VALUES (?,?,?,?,'pending',?)")
    .bind(bondId, mid, rec.id, cents, t).run();
  const payUrl = `${env.PUBLIC_BASE_URL}/b/${await payToken(env, bondId)}`;
  await logEvent(env.DB, "challenge", rec.id, cents, { from, category: c.category, bulk: c.bulk_score, dupes, subject: inb.subject.slice(0, 80) });
  await sendMail(env, {
    to: from,
    subject: `Re: ${inb.subject.slice(0, 150)} (bond required to reach ${handle(env, alias)})`,
    text: `${handle(env, alias)} protects their inbox with refundable bonds.\n\nTo deliver your message, place a ${usd(cents)} card hold (not a charge):\n${payUrl}\n\nIf the recipient marks it unwanted the bond is forfeited to them; otherwise it is released within ${env.BOND_HOLD_HOURS}h. Prototype, test mode.\n\nAgents: GET the link with Accept: application/json (HTTP 402). See ${env.PUBLIC_BASE_URL}/agents.md`,
    headers: { "X-Bond-Amount-Cents": String(cents), "X-Bond-Pay-Url": payUrl, "X-Bond-Currency": "usd" },
  }, rec.id, "challenge");
  return { status: "challenged", message_id: mid, price_cents: cents, pay_url: payUrl, category: c.category };
}
