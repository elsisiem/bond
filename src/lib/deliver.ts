import type { Env } from "../types";
import { logEvent } from "./util";

// Transport abstraction. M1: simulated (event log only). M2 replaces with Cloudflare Email Service / forward().
export type Outgoing = { to: string; subject: string; text: string; html?: string; replyTo?: string; headers?: Record<string, string> };

export async function sendMail(env: Env, msg: Outgoing, recipientId: string | null, kind: string): Promise<boolean> {
  await logEvent(env.DB, `mail_${kind}`, recipientId, null, { to: msg.to, subject: msg.subject });
  return true;
}
