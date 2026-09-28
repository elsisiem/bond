import { esc } from "./util";

export const CSS = `
:root{--bg:#f6f5f1;--paper:#fff;--paper2:#faf9f5;--ink:#0f1f2e;--mut:#5a6878;--line:#e2dfd6;--line2:#d3cfc3;--btn:#12304f;--btnfg:#fff;--green:#0e5f4e;--greenbg:#e5f1ed;--greenline:#c3ddd5;--rust:#9a3b32;--rustbg:#f6e4e1;--rustline:#e6c3be;--bluebg:#e4edf6;--blueline:#c5d6e8;--pill:#eceae1}
[data-theme=dark]{--bg:#0b1520;--paper:#122030;--paper2:#0f1c2b;--ink:#e8eef5;--mut:#9aabbd;--line:#21344a;--line2:#31475f;--btn:#e8eef5;--btnfg:#0b1520;--green:#5fc4a5;--greenbg:#12352a;--greenline:#1f4a3c;--rust:#e58f84;--rustbg:#3d1f1c;--rustline:#5a2f2a;--bluebg:#153049;--blueline:#244b6e;--pill:#1b2d40}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);min-height:100vh;color:var(--ink);font:16px/1.55 "IBM Plex Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:700px;margin:0 auto;padding:36px 22px}
h1,h2{font-family:"Source Serif 4",Georgia,serif;letter-spacing:-.01em}
h1{font-size:30px;margin:0 0 6px;font-weight:600}h2{font-size:20px;margin:30px 0 10px;font-weight:600}
.card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:14px 0}
.big{font:600 42px "Source Serif 4",serif}.muted{color:var(--mut);font-size:14px}
button,.btn{display:inline-block;border:0;border-radius:8px;padding:11px 20px;font:500 15px "IBM Plex Sans";cursor:pointer;text-decoration:none;background:var(--btn);color:var(--btnfg)}
button:hover,.btn:hover{filter:brightness(1.12)}
button.green,.btn.green{background:var(--green);color:#fff}button.red,.btn.red{background:var(--rust);color:#fff}
[data-theme=dark] button.green,[data-theme=dark] .btn.green{color:#062017}[data-theme=dark] button.red,[data-theme=dark] .btn.red{color:#2a0d0a}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px;border-bottom:1px solid var(--line);text-align:left}
a{color:var(--green)}.btn{color:var(--btnfg)}.btn.green,.btn.red{color:#fff}
pre{white-space:pre-wrap;background:var(--paper2);border:1px solid var(--line);padding:12px;border-radius:8px;font:13.5px/1.6 "IBM Plex Mono",monospace}
label{display:block;margin:12px 0;font-size:14px;color:var(--mut)}
input,textarea{display:block;width:100%;margin-top:6px;background:var(--paper);border:1px solid var(--line2);border-radius:8px;padding:11px 12px;color:var(--ink);font:inherit}
input:focus,textarea:focus{outline:2px solid var(--green);border-color:transparent}
.msg{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:14px 0}.msg .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.subj{font-weight:600;margin:6px 0}
.rec{margin:8px 0;padding:9px 13px;border-radius:8px;font-size:14px;background:var(--bluebg);border:1px solid var(--blueline)}.rec.junk{background:var(--rustbg);border-color:var(--rustline)}.rec.worth{background:var(--greenbg);border-color:var(--greenline)}
.pill{font-size:12px;padding:2px 9px;border-radius:99px;background:var(--pill);color:var(--mut)}
.top{position:sticky;top:0;z-index:30;height:56px;display:flex;align-items:center;gap:22px;padding:0 20px;background:var(--paper);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:9px;font:600 20px "Source Serif 4",serif;color:var(--ink);text-decoration:none;letter-spacing:-.01em}
.brand i{width:28px;height:28px;border-radius:7px;background:var(--btn);color:var(--btnfg);display:grid;place-items:center}
.brand svg,.top svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.top nav{display:flex;gap:4px;flex:1;overflow-x:auto}
.top nav a{color:var(--mut);text-decoration:none;font-size:14.5px;padding:7px 12px;border-radius:7px;white-space:nowrap}.top nav a:hover{background:var(--pill);color:var(--ink)}
#themeBtn{width:36px;height:36px;padding:0;display:grid;place-items:center;background:transparent;color:var(--ink);border:1px solid var(--line2);flex:none}
#themeBtn .moon{display:none}[data-theme=dark] #themeBtn .sun{display:none}[data-theme=dark] #themeBtn .moon{display:block}
main.wide{max-width:none;padding:0}
@media(max-width:640px){.top{gap:10px;padding:0 12px}.brand span{display:none}}`;

export const THEME_HEAD = `<script>try{var t=localStorage.getItem('bond-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}</script>`;
export const THEME_BTN = `<header class="top"><a class="brand" href="/"><i><svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg></i><span>Bond</span></a><nav><a href="/">Home</a><a href="/#how">How it works</a><a href="/#start">Get an inbox</a><a href="/live">Live</a><a href="/agents.md">Agent docs</a><a href="/terms">Terms</a></nav><button id="themeBtn" aria-label="Toggle dark mode" title="Toggle dark mode"><svg class="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg></button></header><script>document.getElementById('themeBtn').onclick=function(){var d=document.documentElement,n=d.dataset.theme==='dark'?'light':'dark';d.dataset.theme=n;try{localStorage.setItem('bond-theme',n)}catch(e){}}</script>`;

export function page(title: string, body: string, status = 200, wide = false): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>${THEME_HEAD}<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:wght@500;600&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${THEME_BTN}<main class="${wide ? "wide" : ""}">${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export const TERMS =
  "If the recipient marks your message unwanted, your bond is forfeited to them. Otherwise it is released within {H} hours. Prototype, test mode.";
