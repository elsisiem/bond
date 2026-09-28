export const AGENTS_MD = `# Bond protocol for agents

Some inboxes are protected by Bond: strangers post a small refundable bond (a card authorization hold, not a charge) to be delivered.
If the recipient marks your message unwanted, the bond is forfeited. Otherwise it is released.

## Flow
1. Email a Bond-protected address. You receive a challenge email whose headers include
   \`X-Bond-Pay-Url\`, \`X-Bond-Amount-Cents\`, \`X-Bond-Currency\`.
2. \`GET <pay-url>\` with \`Accept: application/json\` -> HTTP 402 with JSON terms:
   \`{ amount_cents, currency, type: "authorization_hold", recipient, recipient_release_rate, terms, pay: { method, url, body } }\`
3. \`POST <pay-url>/pay\` with JSON \`{ "payment_method_id": "pm_..." }\` -> \`{ ok: true, status: "held" }\` and your message is delivered.
   (Prototype: Stripe TEST mode only. Use \`pm_card_visa\`.)

## Rules of good citizenship
- Only send messages a human would want. Junk costs you the bond.
- Senders with 2+ released bonds and no forfeits get a 50% discount.
- Do not retry payment on 4xx. One challenge per sender per recipient per 24h.

Base URL: {BASE}
`;
