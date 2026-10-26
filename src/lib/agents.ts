export const AGENTS_MD = `# Bond protocol for agents

Some inboxes are protected by Bond: strangers post a small refundable bond (a card authorization hold, not a charge) to be delivered.
If the recipient marks your message unwanted, the bond is forfeited. Otherwise it is released.

Status: prototype, Stripe test mode only. Email delivery is not live yet. Bond does not receive or send mail, so you reach an inbox through MCP or the HTTP API below. Recipients read bonded messages in their dashboard, and can have them pushed to Slack, Discord or an HTTPS webhook.

## Easiest: MCP (Claude Code, Cursor, any MCP client)
\`claude mcp add --transport http bond {BASE}/mcp\`
Tools: \`bond_terms(alias)\` shows the base bond and the inbox's release rate. \`bond_send(alias, from, subject, text)\` handles the 402 and the deposit (test mode: pm_card_visa) and delivers.

## HTTP API
\`POST {BASE}/api/send/<alias>\` with JSON \`{ "from": "you@example.com", "subject": "...", "text": "..." }\`
-> HTTP 402 \`{ error, amount_cents, pay_url, docs }\`, with the headers \`X-Bond-Pay-Url\` and \`X-Bond-Amount-Cents\`. Then follow the payment flow below with \`pay_url\`. Your message is delivered once the bond is held.

## Payment flow
1. \`GET <pay-url>\` with \`Accept: application/json\` -> HTTP 402 with JSON terms:
   \`{ amount_cents, currency, type: "authorization_hold", recipient, recipient_release_rate, terms, pay: { method, url, body } }\`
2. \`POST <pay-url>/pay\` with JSON \`{ "payment_method_id": "pm_..." }\` -> \`{ ok: true, status: "held" }\` and your message is delivered.
   (Prototype: Stripe TEST mode only. Use \`pm_card_visa\`.)

Email intake and email challenges are not built. Sending mail to a Bond address does nothing today.

## Rules of good citizenship
- Only send messages a human would want. Junk costs you the bond.
- Senders with 2+ released bonds and no forfeits get a 50% discount.
- Do not retry payment on 4xx. One challenge per sender per recipient per 24h.

Base URL: {BASE}
`;
