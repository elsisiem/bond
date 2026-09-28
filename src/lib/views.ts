import { esc } from "./util";

export const CSS = `
:root{--bg:#f6f5f1;--paper:#fff;--ink:#0f1f2e;--mut:#5a6878;--line:#e2dfd6;--line2:#d3cfc3;--navy:#12304f;--green:#0e5f4e;--greenbg:#e5f1ed;--rust:#9a3b32}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);min-height:100vh;color:var(--ink);font:16px/1.55 "IBM Plex Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:700px;margin:0 auto;padding:36px 22px}
h1,h2{font-family:"Source Serif 4",Georgia,serif;letter-spacing:-.01em}
h1{font-size:30px;margin:0 0 6px;font-weight:600}h2{font-size:20px;margin:30px 0 10px;font-weight:600}
.card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:14px 0}
.big{font:600 42px "Source Serif 4",serif}.muted{color:var(--mut);font-size:14px}
button,.btn{display:inline-block;border:0;border-radius:8px;padding:11px 20px;font:500 15px "IBM Plex Sans";cursor:pointer;text-decoration:none;background:var(--navy);color:#fff}
button:hover,.btn:hover{filter:brightness(1.12)}
button.green,.btn.green{background:var(--green)}button.red,.btn.red{background:var(--rust)}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px;border-bottom:1px solid var(--line);text-align:left}
a{color:var(--navy)}pre{white-space:pre-wrap;background:#faf9f5;border:1px solid var(--line);padding:12px;border-radius:8px;font:13.5px/1.6 "IBM Plex Mono",monospace}
label{display:block;margin:12px 0;font-size:14px;color:var(--mut)}
input,textarea{display:block;width:100%;margin-top:6px;background:#fff;border:1px solid var(--line2);border-radius:8px;padding:11px 12px;color:var(--ink);font:inherit}
input:focus,textarea:focus{outline:2px solid var(--navy);border-color:transparent}
.msg{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:14px 0}.msg .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.subj{font-weight:600;margin:6px 0}
.rec{margin:8px 0;padding:9px 13px;border-radius:8px;font-size:14px;background:#e4edf6;border:1px solid #c5d6e8}.rec.junk{background:#f6e4e1;border-color:#e6c3be}.rec.worth{background:var(--greenbg);border-color:#c3ddd5}
.pill{font-size:12px;padding:2px 9px;border-radius:99px;background:#eceae1;color:var(--mut)}
`;

export function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:wght@500;600&display=swap" rel="stylesheet"><style>${CSS}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export const TERMS =
  "If the recipient marks your message unwanted, your bond is forfeited to them. Otherwise it is released within {H} hours. Prototype, test mode.";
