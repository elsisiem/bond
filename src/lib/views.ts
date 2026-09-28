import { esc } from "./util";

export const CSS = `
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1200px 600px at 20% -10%,#1b2450 0,#0a0e1a 60%);min-height:100vh;color:#e6e9f2;font:16px/1.55 Inter,system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:680px;margin:0 auto;padding:32px 20px}
h1{font-size:28px;margin:0 0 6px}h2{font-size:18px;margin:28px 0 8px;color:#9aa4bf}
.card{background:#121829;border:1px solid #1f2842;border-radius:14px;padding:18px;margin:14px 0}
.big{font-size:40px;font-weight:700}.muted{color:#8b95b3;font-size:14px}
button,.btn{display:inline-block;border:0;border-radius:10px;padding:12px 20px;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none;background:#635bff;color:#fff}
button.green,.btn.green{background:#22c55e;color:#04210f}button.red,.btn.red{background:#ef4444}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:6px 8px;border-bottom:1px solid #1f2842;text-align:left}
a{color:#8ab4ff}pre{white-space:pre-wrap;background:#0d1322;padding:12px;border-radius:8px;font-size:14px}
label{display:block;margin:12px 0;font-size:14px;color:#9aa4bf}input,textarea{display:block;width:100%;margin-top:6px;background:#0d1322;border:1px solid #26305a;border-radius:10px;padding:11px 12px;color:#e6e9f2;font:inherit}input:focus,textarea:focus{outline:2px solid #635bff;border-color:transparent}
.msg{background:#121829;border:1px solid #1f2842;border-radius:14px;padding:16px;margin:14px 0}.msg .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.subj{font-weight:600;margin:6px 0}
.pill{font-size:12px;padding:2px 8px;border-radius:99px;background:#1f2842}
`;

export function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export const TERMS =
  "If the recipient marks your message unwanted, your bond is forfeited to them. Otherwise it is released within {H} hours. Prototype, test mode.";
