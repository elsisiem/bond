import type { Env } from "../types";
import { DAY, HOUR, esc, logEvent, now, signToken, usd } from "./util";
import { stripeClient } from "./stripe";
import { pushWebhook, sendMail } from "./deliver";

export type Bond = {
  id: string; message_id: string; recipient_id: string; amount_cents: number; status: string;
  session_id: string | null; payment_intent_id: string | null; held_at: number | null; hold_expires_at: number | null;
};

const DAILY_CAPTURE_CAP = 25;

export const holdMs = (env: Env) => Number(env.BOND_HOLD_HOURS) * HOUR;

export const payToken = (env: Env, bondId: string) => signToken(env.TOKEN_SECRET, { t: "pay", b: bondId }, Number(env.WAITING_ROOM_DAYS) * DAY);
export const decisionToken = (env: Env, bondId: string, a: "worth" | "junk") =>
  signToken(env.TOKEN_SECRET, { t: "dec", b: bondId, a }, holdMs(env) + DAY);

export async function getBond(env: Env, id: string): Promise<Bond | null> {
  return env.DB.prepare("SELECT * FROM bonds WHERE id=?").bind(id).first<Bond>();
}

export async function bondedMail(env: Env, bondId: string) {
  const b = await getBond(env, bondId);
  if (!b) return null;
  const m = await env.DB.prepare("SELECT * FROM messages WHERE id=?").bind(b.message_id).first<any>();
  const r = await env.DB.prepare("SELECT * FROM recipients WHERE id=?").bind(b.recipient_id).first<any>();
  if (!m || !r) return null;
  const base = env.PUBLIC_BASE_URL;
  const w = `${base}/d/${await decisionToken(env, bondId, "worth")}`;
  const j = `${base}/d/${await decisionToken(env, bondId, "junk")}`;
  const amt = usd(b.amount_cents);
  const hours = env.BOND_HOLD_HOURS;
  const text = `BONDED MESSAGE: the sender posted a ${amt} refundable bond to reach you.\nWorth it (release bond, trust sender): ${w}\nJunk (keep the ${amt}): ${j}\nNo action = bond auto-released within ${hours}h.\n\n----\nFrom: ${m.from_email}\nSubject: ${m.subject}\n\n${m.body}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:640px"><div style="background:#0b1020;color:#fff;padding:14px 16px;border-radius:10px"><b>Bonded message</b> · sender posted <b>${amt}</b> · auto-releases in ${esc(hours)}h<br><br><a href="${esc(w)}" style="background:#22c55e;color:#04210f;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:600">Worth it</a> &nbsp; <a href="${esc(j)}" style="background:#ef4444;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:600">Junk (keep ${amt})</a></div><p style="color:#555">From ${esc(m.from_email)}</p><h3>${esc(m.subject)}</h3><pre style="white-space:pre-wrap;font-family:inherit">${esc(m.body)}</pre></div>`;
  return {
    to: r.email as string,
    subject: `[${amt} bond] ${m.subject}`,
    text, html, replyTo: m.from_email as string,
    worthUrl: w, junkUrl: j,
    recipientId: r.id as string,
  };
}

// Bond authorized (card hold in place). Idempotent.
export async function markHeld(env: Env, bondId: string, paymentIntentId: string): Promise<boolean> {
  const t = now();
  const res = await env.DB.prepare(
    "UPDATE bonds SET status='held', payment_intent_id=?, held_at=?, hold_expires_at=? WHERE id=? AND status='pending'",
  ).bind(paymentIntentId, t, t + holdMs(env), bondId).run();
  if (!res.meta.changes) return false;
  const b = (await getBond(env, bondId))!;
  await env.DB.prepare("UPDATE messages SET status='held' WHERE id=?").bind(b.message_id).run();
  await logEvent(env.DB, "bond_held", b.recipient_id, b.amount_cents, { bond: bondId });
  const mail = await bondedMail(env, bondId);
  if (mail) {
    await sendMail(env, mail, mail.recipientId, "bonded");
    const hook = await env.DB.prepare("SELECT webhook_url FROM recipients WHERE id=?").bind(mail.recipientId).first<{ webhook_url: string | null }>();
    if (hook?.webhook_url) await pushWebhook(env, hook.webhook_url, mail.text.slice(0, 1800), mail.recipientId);
  }
  return true;
}

export type Decision = "worth" | "junk" | "auto";

export async function decide(env: Env, bondId: string, action: Decision): Promise<{ ok: boolean; result: string }> {
  // atomic claim
  const claim = await env.DB.prepare("UPDATE bonds SET status='deciding' WHERE id=? AND status='held'").bind(bondId).run();
  if (!claim.meta.changes) {
    const b = await getBond(env, bondId);
    return { ok: false, result: b?.status ?? "not_found" };
  }
  const b = (await getBond(env, bondId))!;
  const m = await env.DB.prepare("SELECT from_email FROM messages WHERE id=?").bind(b.message_id).first<{ from_email: string }>();
  const from = m?.from_email ?? "";
  const s = stripeClient(env);
  try {
    let action2 = action;
    if (action === "junk") {
      const since = now() - DAY;
      const n = await env.DB.prepare("SELECT COUNT(*) c FROM ledger WHERE recipient_id=? AND created_at>?").bind(b.recipient_id, since).first<{ c: number }>();
      if ((n?.c ?? 0) >= DAILY_CAPTURE_CAP) action2 = "worth"; // abuse cap: excess junk marks release instead
    }
    if (action2 === "junk") {
      await s.paymentIntents.capture(b.payment_intent_id!);
      await env.DB.batch([
        env.DB.prepare("UPDATE bonds SET status='captured', decided_at=? WHERE id=?").bind(now(), bondId),
        env.DB.prepare("UPDATE messages SET status='captured' WHERE id=?").bind(b.message_id),
        env.DB.prepare("INSERT INTO ledger (recipient_id,bond_id,cents,created_at) VALUES (?,?,?,?)").bind(b.recipient_id, bondId, b.amount_cents, now()),
        env.DB.prepare("INSERT INTO senders (email,captured) VALUES (?,1) ON CONFLICT(email) DO UPDATE SET captured=captured+1").bind(from),
      ]);
      await logEvent(env.DB, "bond_captured", b.recipient_id, b.amount_cents, { bond: bondId });
      return { ok: true, result: "captured" };
    }
    await s.paymentIntents.cancel(b.payment_intent_id!);
    const stmts = [
      env.DB.prepare("UPDATE bonds SET status='released', decided_at=? WHERE id=?").bind(now(), bondId),
      env.DB.prepare("UPDATE messages SET status='released' WHERE id=?").bind(b.message_id),
      env.DB.prepare("INSERT INTO senders (email,released) VALUES (?,1) ON CONFLICT(email) DO UPDATE SET released=released+1").bind(from),
    ];
    if (action2 === "worth") {
      stmts.push(env.DB.prepare("INSERT OR IGNORE INTO allowlist (recipient_id,pattern) VALUES (?,?)").bind(b.recipient_id, from.toLowerCase()));
    }
    await env.DB.batch(stmts);
    await logEvent(env.DB, "bond_released", b.recipient_id, b.amount_cents, { bond: bondId, by: action2 });
    return { ok: true, result: "released" };
  } catch (e) {
    await env.DB.prepare("UPDATE bonds SET status='held' WHERE id=? AND status='deciding'").bind(bondId).run();
    console.log("decide failed", bondId, (e as Error).message);
    return { ok: false, result: "stripe_error" };
  }
}

// Cron: auto-release expired holds; expire unpaid requests.
export async function sweep(env: Env) {
  const t = now();
  const due = await env.DB.prepare("SELECT id FROM bonds WHERE status='held' AND hold_expires_at<? LIMIT 50").bind(t).all<{ id: string }>();
  for (const r of due.results) await decide(env, r.id, "auto");
  const exp = await env.DB.prepare("SELECT id FROM messages WHERE status IN ('challenged','waiting_room') AND expires_at<? LIMIT 200").bind(t).all<{ id: string }>();
  for (const r of exp.results) {
    await env.DB.batch([
      env.DB.prepare("UPDATE messages SET status='expired', body='', shingles=NULL WHERE id=?").bind(r.id),
      env.DB.prepare("UPDATE bonds SET status='expired' WHERE message_id=? AND status='pending'").bind(r.id),
    ]);
  }
  return { autoReleased: due.results.length, expired: exp.results.length };
}
