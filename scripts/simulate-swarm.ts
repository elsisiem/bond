import { BASE, inbound, payBond, decideAll, stats } from "./lib";

const N = Number(process.env.N || 8);
const pitches = [
  "Hi {{first_name}}, our AI SDR 10x's your pipeline. Book a 15 min demo?",
  "Quick question re: {{company}} - are you the right person to talk to about growth?",
  "Following up on my last email! We help companies like {{company}} scale outbound.",
  "I noticed {{company}} is hiring. Our platform automates sourcing. Worth a chat?",
];
console.log(`Swarm -> ${BASE} (${N} agents)`);
for (let i = 0; i < N; i++) {
  const r = await inbound(`sdr${i}@growthbot.example`, `Quick question re: {{company}} #${i}`, pitches[i % pitches.length]);
  const paid = r.pay_url ? await payBond(r.pay_url) : null;
  console.log(`agent ${i}: ${r.status} ${r.category ?? ""} $${((r.price_cents ?? 0) / 100).toFixed(2)} -> ${paid?.status ?? "no bond"}`);
}
if (process.env.DECIDE !== "0") {
  const d = await decideAll(() => "junk");
  console.log(`Owner marked ${d.decided} as junk. Dashboard: ${d.dashboard}`);
}
console.log(await stats());
