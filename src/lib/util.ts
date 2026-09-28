const enc = new TextEncoder();

export const now = () => Date.now();
export const uid = () => crypto.randomUUID().replace(/-/g, "");
export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

export function esc(s: unknown): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s ?? "").replace(/[&<>"']/g, (c) => map[c]);
}

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function b64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s: string): Uint8Array {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(p);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const hmacKey = (secret: string, usage: ("sign" | "verify")[]) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);

export async function signToken(secret: string, payload: Record<string, unknown>, ttlMs: number): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify({ ...payload, exp: now() + ttlMs })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, ["sign"]), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}

// constant-time verify via WebCrypto
export async function verifyToken<T = Record<string, any>>(secret: string, token: string): Promise<T | null> {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, ["verify"]), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    if (typeof p.exp !== "number" || p.exp < now()) return null;
    return p as T;
  } catch {
    return null;
  }
}

export async function logEvent(db: D1Database, type: string, recipientId: string | null, cents: number | null, data: Record<string, unknown> = {}) {
  await db
    .prepare("INSERT INTO events (ts,type,recipient_id,cents,data) VALUES (?,?,?,?,?)")
    .bind(now(), type, recipientId, cents, JSON.stringify(data))
    .run();
}
