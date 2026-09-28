import { BASE, inbound, payBond, decideAll, stats } from "./lib";

console.log(`Legit agent -> ${BASE}`);
const r = await inbound(
  "scheduler@acme-research.example",
  "Interview request: your talk on agent payments",
  "Hi - I read your writeup on refundable bonds for inbound email. I'm writing a piece on it and would like 20 minutes on Thursday to ask about the Stripe manual-capture design. Happy to send questions in advance.",
);
console.log(`${r.status} ${r.category ?? ""} $${((r.price_cents ?? 0) / 100).toFixed(2)}`);
if (r.pay_url) console.log("bond:", (await payBond(r.pay_url)).status);
if (process.env.DECIDE !== "0") console.log("owner: worth it ->", (await decideAll(() => "worth")).decided);
console.log(await stats());
