export function shingles(text: string): string[] {
  const t = text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return [...out];
}

export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  let inter = 0;
  for (const x of a) if (sb.has(x)) inter++;
  return inter / (a.length + b.length - inter);
}

export function price(o: { base: number; bulkScore: number; dupes: number; repDiscount: number; max: number }): number {
  const cluster = Math.min(3, 0.25 * o.dupes);
  const mult = 1 + 2 * o.bulkScore + cluster - o.repDiscount;
  return Math.round(Math.min(o.max, Math.max(50, o.base * mult)));
}

export function isBulk(h: Record<string, string>, from: string): boolean {
  if (h["list-id"] || h["list-unsubscribe"] || (h["auto-submitted"] || "").toLowerCase().startsWith("auto")) return true;
  if (/^(bulk|junk|list)$/i.test((h["precedence"] || "").trim())) return true;
  if (/^(no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce)/i.test(from.split("@")[0])) return true;
  return false;
}

export function authFailed(h: Record<string, string>): boolean {
  const ar = (h["authentication-results"] || "").toLowerCase();
  return /(spf|dkim|dmarc)=(fail|softfail|permerror|temperror)/.test(ar);
}

export function allowMatch(patterns: string[], from: string): boolean {
  const f = from.toLowerCase();
  const dom = f.split("@")[1] || "";
  return patterns.some((p) => {
    const q = p.toLowerCase().trim();
    return q === f || q === "@" + dom || q === dom;
  });
}
