import { esc } from "./util";

export const CSS = `
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;background:#0a0e1a;color:#e6e9f2;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:680px;margin:0 auto;padding:32px 20px}
h1{font-size:28px;margin:0 0 6px}h2{font-size:18px;margin:28px 0 8px;color:#9aa4bf}
.card{background:#121829;border:1px solid #1f2842;border-radius:14px;padding:18px;margin:14px 0}
.big{font-size:40px;font-weight:700}.muted{color:#8b95b3;font-size:14px}
button,.btn{display:inline-block;border:0;border-radius:10px;padding:12px 20px;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none;background:#635bff;color:#fff}
button.green,.btn.green{background:#22c55e;color:#04210f}button.red,.btn.red{background:#ef4444}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:6px 8px;border-bottom:1px solid #1f2842;text-align:left}
a{color:#8ab4ff}pre{white-space:pre-wrap;background:#0d1322;padding:12px;border-radius:8px;font-size:14px}
.pill{font-size:12px;padding:2px 8px;border-radius:99px;background:#1f2842}
`;

export function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export const TERMS =
  "If the recipient marks your message unwanted, your bond is forfeited to them. Otherwise it is released within {H} hours. Prototype, test mode.";
