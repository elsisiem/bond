import type { Env } from "../types";
import { esc, usd } from "./util";
import { decisionToken } from "./bonds";
import { DEFAULT_POLICY } from "./triage";

const CSS = `
<style>
.app{display:grid;grid-template-columns:236px 1fr;height:calc(100vh - 56px);min-height:520px}
.side{border-right:1px solid var(--line);background:var(--paper);display:flex;flex-direction:column;padding:16px 12px;gap:14px;overflow:auto}
.who b{display:block;font:600 19px "Source Serif 4",serif}.who span{font-size:13px;color:var(--mut)}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kpis div{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:9px 11px}
.kpis div.g{grid-column:1/3;background:var(--greenbg);border-color:var(--greenline)}
.kpis b{display:block;font:600 21px "Source Serif 4",serif}.kpis .g b{color:var(--green)}.kpis span{font-size:11.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.tabs{display:flex;flex-direction:column;gap:2px}
.tab{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;text-align:left;padding:10px 12px;border-radius:8px;background:transparent;color:var(--ink);font:500 14.5px "IBM Plex Sans";border:0;cursor:pointer}
.tab:hover{background:var(--pill)}.tab.on{background:var(--greenbg);color:var(--green)}
.tab em{font-style:normal;font-size:12px;min-width:22px;text-align:center;padding:1px 7px;border-radius:99px;background:var(--pill);color:var(--mut)}.tab.on em{background:var(--green);color:#fff}
.tab .dotn{background:var(--rust);color:#fff}.tab em:empty{display:none}
.pane{display:none;height:100%;overflow:auto}.pane.on{display:block}
.split{display:none;grid-template-columns:340px 1fr;height:100%}.split.on{display:grid}
.list{border-right:1px solid var(--line);overflow:auto;background:var(--bg)}
.item{padding:13px 16px;border-bottom:1px solid var(--line);cursor:pointer}
.item:hover{background:var(--pill)}.item.on{background:var(--paper);box-shadow:inset 3px 0 0 var(--green)}
.item .r1{display:flex;justify-content:space-between;gap:8px;font-size:14px}.item .r1 b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item .amt{font-weight:600;color:var(--green);white-space:nowrap}
.item .s{font-size:13.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.item .rc{font-size:11.5px;margin-top:5px;display:inline-block;padding:1px 8px;border-radius:99px}
.rc.junk{background:var(--rustbg);color:var(--rust)}.rc.worth{background:var(--greenbg);color:var(--green)}
.read{display:none;flex-direction:column;height:100%;min-width:0;background:var(--paper)}.read.on{display:flex}
.read .hd{padding:18px 24px 10px;border-bottom:1px solid var(--line)}
.read .hd h3{margin:8px 0 4px;font:600 21px "Source Serif 4",serif}
.chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.body{flex:1;overflow:auto;padding:16px 24px}
.body pre{margin:10px 0;background:var(--paper2)}
.actions{display:flex;gap:10px;padding:14px 24px;border-top:1px solid var(--line);background:var(--paper2);align-items:center}
.actions form{margin:0}.actions .hint{margin-left:auto;font-size:12.5px;color:var(--mut)}
.split>div{min-width:0}.read .hd h3,.item .s{overflow-wrap:anywhere}.body pre{overflow-wrap:anywhere}.chips b{overflow-wrap:anywhere}
.empty{padding:40px;text-align:center;color:var(--mut)}
.pad{padding:22px 26px;max-width:760px}
.pad h2{margin-top:0}
.row2{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.bar{font-size:13px;color:var(--mut);padding:10px 16px;border-top:1px solid var(--line)}
@media(max-width:820px){
  .app{grid-template-columns:1fr;height:auto}
  .side{flex-direction:row;flex-wrap:wrap;border-right:0;border-bottom:1px solid var(--line)}
  .kpis{grid-template-columns:repeat(3,1fr);width:100%}.kpis div.g{grid-column:auto}
  .tabs{flex-direction:row;overflow-x:auto;width:100%}.tab{white-space:nowrap;width:auto}
  .pane,.split{height:auto}.split.on{grid-template-columns:1fr}
  .list{max-height:34vh;border-right:0;border-bottom:1px solid var(--line)}
}
</style>`;

const JS = `
<script>
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.tab')),views={};
  document.querySelectorAll('[data-view]').forEach(function(v){views[v.dataset.view]=v});
  function show(n){if(!views[n])n='inbox';for(var k in views)views[k].classList.toggle('on',k===n);tabs.forEach(function(t){t.classList.toggle('on',t.dataset.v===n)});if(location.hash!=='#'+n)history.replaceState(null,'','#'+n)}
  tabs.forEach(function(t){t.onclick=function(){show(t.dataset.v)}});
  show((location.hash||'#inbox').slice(1));
  var items=[].slice.call(document.querySelectorAll('.item')),reads=[].slice.call(document.querySelectorAll('.read'));
  function pick(i){items.forEach(function(x,j){x.classList.toggle('on',j===i)});reads.forEach(function(x,j){x.classList.toggle('on',j===i)})}
  items.forEach(function(x,i){x.onclick=function(){pick(i)}});
  if(items.length)pick(0);
  document.addEventListener('keydown',function(e){if(/INPUT|TEXTAREA/.test((e.target||{}).tagName))return;var i=items.findIndex(function(x){return x.classList.contains('on')});
    if(e.key==='j'&&i<items.length-1){pick(i+1);items[i+1].scrollIntoView({block:'nearest'})}
    if(e.key==='k'&&i>0){pick(i-1);items[i-1].scrollIntoView({block:'nearest'})}});
  var cp=document.getElementById('cpy');if(cp)cp.onclick=function(){navigator.clipboard.writeText(document.getElementById('cl').textContent);cp.textContent='Copied';setTimeout(function(){cp.textContent='Copy link'},1400)};
})();
</script>`;

export async function dashboardHtml(
  env: Env,
  r: any,
  d: { earn: number; rel: number; dec: number; held: any[]; waiting: any[]; history: any[]; triage?: string },
): Promise<string> {
  const tok = esc(r.dashboard_token);
  const rate = d.dec ? Math.round((100 * d.rel) / d.dec) + "%" : "n/a";
  const contact = `${env.PUBLIC_BASE_URL}/to/${r.alias}`;
  const recCount = d.held.filter((h) => h.rec_action).length;

  let list = "";
  let reads = "";
  for (const h of d.held) {
    const w = await decisionToken(env, h.id, "worth");
    const j = await decisionToken(env, h.id, "junk");
    list += `<div class="item"><div class="r1"><b>${esc(h.from_email)}</b><span class="amt">${usd(h.amount_cents)}</span></div><div class="s">${esc(h.subject)}</div>${h.rec_action ? `<span class="rc ${h.rec_action}">Agent: ${h.rec_action === "junk" ? "Junk" : "Worth it"}</span>` : ""}</div>`;
    reads += `<article class="read"><div class="hd"><div class="chips"><b>${esc(h.from_email)}</b><span class="pill">${usd(h.amount_cents)} bond</span>${h.category ? `<span class="pill">${esc(h.category)}</span>` : ""}</div><h3>${esc(h.subject)}</h3></div>
<div class="body">${h.rec_action ? `<div class="rec ${h.rec_action}">Triage agent recommends <b>${h.rec_action === "junk" ? "Junk" : "Worth it"}</b>: ${esc(h.rec_reason || "")}</div>` : ""}${h.summary ? `<div class="muted">AI summary: ${esc(h.summary)}</div>` : ""}<pre>${esc(String(h.body).slice(0, 4000))}</pre></div>
<div class="actions"><form method="post" action="/d/${w}"><input type="hidden" name="back" value="${tok}"><button class="green">Worth it</button></form><form method="post" action="/d/${j}"><input type="hidden" name="back" value="${tok}"><button class="red">Junk, keep ${usd(h.amount_cents)}</button></form><span class="hint">Do nothing and the bond auto-releases in ${esc(env.BOND_HOLD_HOURS)}h</span></div></article>`;
  }

  const hist = d.history
    .map((m) => `<tr><td>${esc(m.from_email)}</td><td>${esc(m.subject)}</td><td>${usd(m.amount_cents)}</td><td><span class="pill">${m.status === "captured" ? "Junk, kept" : "Released"}</span></td></tr>`)
    .join("");
  const wait = d.waiting.map((w) => `<tr><td>${esc(w.from_email)}</td><td>${esc(w.subject)}</td><td><span class="pill">${esc(w.reason)}</span></td></tr>`).join("");
  const note =
    d.triage === "started" ? "Triage agent is running. Refresh in about a minute. " : d.triage === "unavailable" ? "Triage is unavailable right now. " : "";

  return `${CSS}
<div class="app">
<aside class="side">
  <div class="who"><b>${esc(r.alias)}</b><span>Base bond ${usd(r.base_cents)}</span></div>
  <div class="kpis"><div class="g"><b>${usd(d.earn)}</b><span>Earned from junk</span></div><div><b>${d.held.length}</b><span>Pending</span></div><div><b>${rate}</b><span>Release rate</span></div></div>
  <nav class="tabs">
    <button class="tab" data-v="inbox">Inbox <em class="${d.held.length ? "dotn" : ""}">${d.held.length}</em></button>
    <button class="tab" data-v="triage">AI triage <em>${recCount || ""}</em></button>
    <button class="tab" data-v="history">Decided <em>${d.history.length}</em></button>
    <button class="tab" data-v="waiting">Waiting room <em>${d.waiting.length}</em></button>
    <button class="tab" data-v="share">Share link</button>
  </nav>
  <div class="muted" style="margin-top:auto;font-size:12px">Keep this page's URL private. Shortcuts: j / k to move.</div>
</aside>
<div>
  <div class="split" data-view="inbox">
    <div class="list">${list || '<div class="empty">No bonded messages yet.<br>Share your link to receive some.</div>'}</div>
    <div>${reads || '<div class="empty" style="padding-top:80px">Nothing waiting for a decision.</div>'}</div>
  </div>
  <div class="pane" data-view="triage"><div class="pad">
    <h2>AI triage <span class="pill">Brainbase agent</span></h2>
    <form method="post" action="/r/${tok}/policy"><label>Your rules, in plain English<textarea name="policy" rows="4" maxlength="1000" placeholder="${esc(DEFAULT_POLICY)}">${esc(r.policy || "")}</textarea></label><button class="green">Save rules</button></form>
    <div class="row2"><form method="post" action="/r/${tok}/triage"><button>Run AI triage</button></form><form method="post" action="/r/${tok}/apply"><button class="green">Apply ${recCount || ""} recommendation${recCount === 1 ? "" : "s"}</button></form></div>
    <p class="muted">${note}A Brainbase agent reads your pending messages against your rules and recommends Worth it or Junk. It cannot move money. Nothing is decided until you press Apply or decide in the Inbox.</p>
  </div></div>
  <div class="pane" data-view="history"><table><tr><th>From</th><th>Subject</th><th>Bond</th><th>Outcome</th></tr>${hist || '<tr><td colspan="4" class="muted">No decisions yet.</td></tr>'}</table></div>
  <div class="pane" data-view="waiting"><table><tr><th>From</th><th>Subject</th><th>Why held</th></tr>${wait || '<tr><td colspan="3" class="muted">Waiting room is empty.</td></tr>'}</table><div class="bar">Unpaid or unverified mail waits 7 days. Nothing is deleted.</div></div>
  <div class="pane" data-view="share"><div class="pad">
    <h2>Your public bonded link</h2>
    <pre id="cl">${esc(contact)}</pre>
    <div class="row2"><button id="cpy">Copy link</button><a class="btn" href="/to/${esc(r.alias)}" style="background:var(--mut);color:#fff">Preview page</a></div>
    <p class="muted">Put it in your bio, website or email signature. Strangers, including AI agents, post a refundable bond to reach you. Agents can also use <code>POST /api/send/${esc(r.alias)}</code>.</p>
  </div></div>
</div>
</div>${JS}`;
}
