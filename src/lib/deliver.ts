import type { Env } from "../types";
import { logEvent } from "./util";

// Transport abstraction. M1: simulated (event log only). M2 replaces with Cloudflare Email Service / forward().
export type Outgoing = { to: string; subject: string; text: string; html?: string; replyTo?: string; headers?: Record<string, string> };

export async function sendMail(env: Env, msg: Outgoing, recipientId: string | null, kind: string): Promise<boolean> {
  await logEvent(env.DB, `mail_${kind}`, recipientId, null, { to: msg.to, subject: msg.subject });
  return true;
}

/** Owner-supplied webhook (Slack, Discord, or any HTTPS endpoint). HTTPS only, no private hosts, no redirects (SSRF guard). */
export function safeWebhook(u: string): URL | null {
  try {
    const x = new URL(u.trim());
    const h = x.hostname.toLowerCase();
    if (x.protocol !== "https:" || x.username || x.password) return null;
    if (!h.includes(".") || h === "localhost" || h.startsWith("[") || /^(\d+\.){3}\d+$/.test(h)) return null;
    if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return null;
    return x;
  } catch {
    return null;
  }
}

export async function pushWebhook(env: Env, url: string, text: string, recipientId: string | null): Promise<boolean> {
  const u = safeWebhook(url);
  if (!u) return false;
  const body = u.hostname.endsWith("discord.com") ? { content: text.slice(0, 1900) } : { text: text.slice(0, 3500), source: "bond" };
  try {
    const r = await fetch(u.toString(), {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await logEvent(env.DB, r.status < 300 ? "webhook_sent" : "webhook_failed", recipientId, null, { host: u.hostname, status: r.status });
    return r.status < 300;
  } catch {
    await logEvent(env.DB, "webhook_failed", recipientId, null, { host: u.hostname });
    return false;
  }
}
