import { readFileSync } from "node:fs";

export const BASE = (process.env.BASE || "http://localhost:8787").replace(/\/$/, "");
const vars = Object.fromEntries(
  readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).trim()]),
);
const H = { "x-dev-secret": vars.DEV_SIMULATE_SECRET, "content-type": "application/json" };

export async function inbound(from: string, subject: string, text: string) {
  const r = await fetch(`${BASE}/api/dev/inbound`, { method: "POST", headers: H, body: JSON.stringify({ from, subject, text }) });
  return (await r.json()) as any;
}

export async function payBond(payUrl: string) {
  const r = await fetch(`${payUrl}/pay`, { method: "POST", headers: H, body: JSON.stringify({ payment_method_id: "pm_card_visa" }) });
  return (await r.json()) as any;
}

/** Owner side: decide on held bonds via the dashboard's signed links. */
export async function decideAll(pick: (i: number) => "worth" | "junk") {
  const d: any = await (await fetch(`${BASE}/api/dev/demo`, { headers: H })).json();
  const html = await (await fetch(d.dashboard)).text();
  const links = [...new Set([...html.matchAll(/\/d\/[A-Za-z0-9_.\-]+/g)].map((m) => m[0]))];
  const byBond = new Map<string, { worth?: string; junk?: string }>();
  for (const l of links) {
    const p = JSON.parse(Buffer.from(l.slice(3).split(".")[0], "base64url").toString());
    byBond.set(p.b, { ...byBond.get(p.b), [p.a]: l });
  }
  let i = 0;
  for (const v of byBond.values()) {
    const l = v[pick(i++)];
    if (l) await fetch(BASE + l, { method: "POST" });
  }
  return { decided: i, dashboard: d.dashboard };
}

export async function stats() {
  return ((await (await fetch(`${BASE}/api/events`)).json()) as any).stats;
}
