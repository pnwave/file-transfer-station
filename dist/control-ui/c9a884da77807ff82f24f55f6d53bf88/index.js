var pe="file-drop-styles";function S(a){return a instanceof Error?a.message:String(a)}var we=`
.fd-page {
  --fd-gap: 14px;
  display: flex;
  flex-direction: column;
  gap: var(--fd-gap);
  padding: 20px;
  max-width: 1080px;
  margin: 0 auto;
  font-family: inherit;
  color: var(--text, #e8e8e8);
  box-sizing: border-box;
}
.fd-page * { box-sizing: border-box; }
.fd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.fd-title { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
.fd-sub { margin: 4px 0 0; font-size: 13px; color: var(--muted-foreground, #9aa0a6); line-height: 1.5; }
.fd-root { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--muted-foreground, #9aa0a6); word-break: break-all; }
.fd-drop {
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; min-height: 168px; padding: 24px;
  border: 1.5px dashed var(--border-strong, #4a4a4a);
  border-radius: 14px;
  background: var(--bg-muted, rgba(255,255,255,0.03));
  text-align: center; cursor: pointer;
  transition: border-color .15s ease, background .15s ease, transform .1s ease;
}
.fd-drop:hover { border-color: var(--primary, #6aa9ff); background: var(--bg-hover, rgba(255,255,255,0.06)); }
.fd-drop.fd-over { border-color: var(--primary, #6aa9ff); background: var(--accent-subtle, rgba(106,169,255,0.12)); transform: scale(1.005); }
.fd-drop-icon { font-size: 28px; line-height: 1; opacity: .85; }
.fd-drop-main { font-size: 14px; font-weight: 600; }
.fd-drop-hint { font-size: 12px; color: var(--muted-foreground, #9aa0a6); }
.fd-drop input[type="file"] { display: none; }
.fd-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.fd-btn {
  appearance: none; border: 1px solid var(--border, #3a3a3a);
  background: var(--bg-elevated, rgba(255,255,255,0.05));
  color: var(--text, #e8e8e8);
  border-radius: 9px; padding: 7px 13px; font: inherit; font-size: 13px;
  cursor: pointer; transition: border-color .12s ease, background .12s ease;
  white-space: nowrap;
}
.fd-btn:hover { border-color: var(--border-hover, #5a5a5a); background: var(--bg-hover, rgba(255,255,255,0.09)); }
.fd-btn:disabled { opacity: .45; cursor: default; }
.fd-btn.fd-primary { background: var(--primary, #3b82f6); border-color: transparent; color: var(--primary-foreground, #fff); font-weight: 600; }
.fd-btn.fd-primary:hover { background: var(--primary-hover, #2f6fe0); }
.fd-btn.fd-danger { color: var(--danger, #f87171); border-color: color-mix(in srgb, var(--danger, #f87171) 40%, transparent); }
.fd-btn.fd-danger:hover { background: var(--danger-subtle, rgba(248,113,113,0.12)); }
.fd-search {
  flex: 1 1 200px; min-width: 140px;
  background: var(--bg-muted, rgba(255,255,255,0.04));
  border: 1px solid var(--border, #3a3a3a); border-radius: 9px;
  padding: 7px 11px; font: inherit; font-size: 13px; color: inherit;
}
.fd-search:focus { outline: 2px solid var(--primary, #3b82f6); outline-offset: -1px; }
.fd-queue { display: flex; flex-direction: column; gap: 8px; }
.fd-item, .fd-file {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 11px;
  border: 1px solid var(--border, #33363c);
  background: var(--card, rgba(255,255,255,0.03));
}
.fd-item { flex-direction: column; align-items: stretch; gap: 6px; }
.fd-item-head { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
.fd-item-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-item-meta { color: var(--muted-foreground, #9aa0a6); font-size: 12px; flex: none; }
.fd-bar { position: relative; height: 7px; border-radius: 99px; background: var(--bg-muted, rgba(255,255,255,0.08)); overflow: hidden; }
.fd-bar > span { position: absolute; inset: 0 auto 0 0; width: 0%; background: var(--primary, #3b82f6); border-radius: 99px; transition: width .12s linear; }
.fd-bar.fd-error > span { background: var(--danger, #f87171); }
.fd-bar.fd-done > span { background: var(--success, #4ade80); }
.fd-file { gap: 8px; }
.fd-file-check { flex: none; width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary, #3b82f6); }
.fd-file-body { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 3px; }
.fd-file-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-file-name .fd-dir-icon { margin-right: 4px; opacity: .8; }
.fd-file-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px;
  color: var(--muted-foreground, #9aa0a6);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;
}
.fd-file-path:hover { color: var(--text, #e8e8e8); }
.fd-file-meta { font-size: 11.5px; color: var(--text-tertiary, #808690); flex: none; }
.fd-file-actions { display: flex; gap: 6px; flex: none; }
.fd-empty, .fd-error, .fd-loading {
  padding: 26px; text-align: center; font-size: 13px;
  color: var(--muted-foreground, #9aa0a6);
  border: 1px dashed var(--border, #33363c); border-radius: 12px;
}
.fd-error { color: var(--danger, #f87171); border-color: color-mix(in srgb, var(--danger, #f87171) 35%, transparent); }
.fd-toast {
  position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
  padding: 9px 16px; border-radius: 999px; font-size: 13px;
  background: var(--text-strong, #111); color: var(--bg, #fff);
  box-shadow: 0 8px 26px rgba(0,0,0,.35); z-index: 9999;
  opacity: 0; transition: opacity .18s ease; pointer-events: none;
}
.fd-toast.fd-show { opacity: .96; }
.fd-mkdir-row { display: none; gap: 6px; align-items: center; }
.fd-mkdir-row.fd-show { display: flex; }
.fd-mkdir-input {
  width: 200px;
  background: var(--bg-muted, rgba(255,255,255,0.04));
  border: 1px solid var(--border, #3a3a3a); border-radius: 9px;
  padding: 7px 11px; font: inherit; font-size: 13px; color: inherit;
}
.fd-mkdir-input:focus { outline: 2px solid var(--primary, #3b82f6); outline-offset: -1px; }
@media (max-width: 640px) {
  .fd-page { padding: 14px; }
  .fd-file { flex-wrap: wrap; }
  .fd-file-actions { width: 100%; justify-content: flex-end; }
}
`;function ke(){if(document.getElementById(pe))return;let a=document.createElement("style");a.id=pe,a.textContent=we,document.head.append(a)}function ue(a){if(typeof a!="number"||!Number.isFinite(a)||a<0)return"?";let c=["B","KB","MB","GB","TB"],l=a,t=0;for(;l>=1024&&t<c.length-1;)l/=1024,t+=1;return`${l>=10||t===0?Math.round(l):l.toFixed(1)} ${c[t]}`}function me(a){if(!a)return"";let c=new Date(a),l=Date.now()-a;return l<6e4?"\u521A\u521A":l<36e5?`${Math.floor(l/6e4)} \u5206\u949F\u524D`:l<864e5?`${Math.floor(l/36e5)} \u5C0F\u65F6\u524D`:c.toLocaleDateString("zh-CN")}var Te={id:"file-drop",activate(a){a.ui.registerNavigation({id:"file-drop",label:"\u6587\u4EF6\u4E2D\u8F6C\u7AD9",page:{id:"file-drop"},icon:"upload",order:60}),a.ui.registerPage({id:"file-drop",label:"\u6587\u4EF6\u4E2D\u8F6C\u7AD9",mount(c,l){ke();let t={token:null,chunkBytes:16*1024*1024,rootDir:"",files:[],loading:!0,error:"",queue:new Map,search:"",busy:!1,selected:new Set},G=new AbortController,ge=()=>{G.abort(),l.signal.aborted};l.signal.addEventListener("abort",ge,{once:!0});let w=(e,n)=>{let s=`${a.basePath&&a.basePath!=="/"?a.basePath.replace(/\/+$/,""):""}${e}`,i=new Headers(n?.headers??{});return t.token&&i.set("Authorization",`Bearer ${t.token}`),fetch(s,{...n,headers:i,signal:n?.signal??G.signal})},P=document.createElement("div");P.className="fd-page";let K=document.createElement("div");K.className="fd-head";let ae=document.createElement("div"),Q=document.createElement("h1");Q.className="fd-title",Q.textContent="\u6587\u4EF6\u4E2D\u8F6C\u7AD9";let X=document.createElement("p");X.className="fd-sub",X.textContent="\u4EC0\u4E48\u683C\u5F0F\u90FD\u80FD\u4F20\uFF0C\u591A\u5927\u90FD\u884C\u3002\u6587\u4EF6\u76F4\u63A5\u843D\u5230\u8FD9\u53F0\u673A\u5668\u7684\u771F\u5B9E\u6587\u4EF6\u5939\u91CC \u2014\u2014 \u590D\u5236\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u60F3\u5728\u54EA\u7528\u5C31\u5728\u54EA\u7528\u3002";let _=document.createElement("div");_.className="fd-root",ae.append(Q,X,_);let k=document.createElement("button");k.className="fd-btn",k.type="button",k.textContent="\u5237\u65B0",K.append(ae,k);let g=document.createElement("label");g.className="fd-drop";let E=document.createElement("input");E.type="file",E.multiple=!0;let Y=document.createElement("div");Y.className="fd-drop-icon",Y.textContent="\u2B06";let V=document.createElement("div");V.className="fd-drop-main",V.textContent="\u628A\u6587\u4EF6\u62D6\u5230\u8FD9\u91CC\uFF0C\u6216\u70B9\u51FB\u9009\u62E9";let W=document.createElement("div");W.className="fd-drop-hint",W.textContent="\u4E0D\u9650\u5927\u5C0F\u3001\u4E0D\u9650\u683C\u5F0F\u3002\u6587\u4EF6\u5939\u8BF7\u9010\u4E2A\u6587\u4EF6\u62D6\u5165\u3002",g.append(E,Y,V,W);let H=document.createElement("div");H.className="fd-queue";let Z=document.createElement("div");Z.className="fd-row";let C=document.createElement("input");C.className="fd-search",C.type="search",C.placeholder="\u6309\u6587\u4EF6\u540D\u7B5B\u9009\u2026",C.setAttribute("aria-label","\u6309\u6587\u4EF6\u540D\u7B5B\u9009");let ee=document.createElement("span");ee.className="fd-file-meta";let N=document.createElement("button");N.className="fd-btn",N.type="button",N.textContent="\u{1F4C1} \u65B0\u5EFA\u76EE\u5F55",N.style.display="none",Z.append(C,ee,N);let h=document.createElement("div");h.style.display="flex",h.style.flexDirection="column",h.style.gap="8px";let v=document.createElement("div");v.className="fd-mkdir-row";let u=document.createElement("input");u.className="fd-mkdir-input",u.type="text",u.placeholder="\u76EE\u5F55\u540D\u79F0\u2026",u.maxLength=180;let $=document.createElement("button");$.className="fd-btn fd-primary",$.type="button",$.textContent="\u521B\u5EFA";let M=document.createElement("button");M.className="fd-btn",M.type="button",M.textContent="\u53D6\u6D88",v.append(u,$,M);let I=document.createElement("div");I.className="fd-row",I.style.display="none";let R=document.createElement("span");R.className="fd-file-meta",R.textContent="\u5DF2\u9009\u62E9 0 \u9879";let x=document.createElement("button");x.className="fd-btn fd-danger",x.type="button",x.textContent="\u5220\u9664\u6240\u9009",x.disabled=!0;let q=document.createElement("button");q.className="fd-btn",q.type="button",q.textContent="\u53D6\u6D88\u9009\u62E9";let y=document.createElement("button");y.className="fd-btn fd-primary",y.type="button",y.textContent="\u6279\u91CF\u4E0B\u8F7D",y.disabled=!0,y.onclick=()=>{let e=t.files.filter(s=>t.selected.has(s.id)&&s.type!=="dir");if(e.length===0){f("\u6CA1\u6709\u53EF\u4E0B\u8F7D\u7684\u6587\u4EF6\uFF08\u76EE\u5F55\u4E0D\u652F\u6301\u6279\u91CF\u4E0B\u8F7D\uFF09");return}y.disabled=!0;let n=0,o=()=>{if(n>=e.length){y.disabled=!1,f(`\u6279\u91CF\u4E0B\u8F7D\u5B8C\u6210\uFF1A${e.length} \u4E2A\u6587\u4EF6`);return}let s=e[n++];de(s),setTimeout(o,800)};o()},I.append(R,y,x,q);let D=document.createElement("div");D.className="fd-toast",P.append(K,g,H,Z,v,I,h),c.append(P,D);let te=0,f=e=>{D.textContent=e,D.classList.add("fd-show"),clearTimeout(te),te=setTimeout(()=>D.classList.remove("fd-show"),1900)},T=()=>{H.replaceChildren();for(let e of t.queue.values()){let n=document.createElement("div");n.className="fd-item";let o=document.createElement("div");o.className="fd-item-head";let s=document.createElement("span");s.className="fd-item-name",s.textContent=e.name;let i=document.createElement("span");i.className="fd-item-meta";let r=document.createElement("div");r.className="fd-bar",e.phase==="error"&&r.classList.add("fd-error"),e.phase==="done"&&r.classList.add("fd-done");let m=document.createElement("span");r.append(m),o.append(s,i),n.append(o,r),H.append(n);let b=e.size>0?Math.min(100,e.sent/e.size*100):100;m.style.width=`${b.toFixed(2)}%`,e.phase==="error"?i.textContent=`\u5931\u8D25 \u2014\u2014 ${e.error??"\u672A\u77E5\u9519\u8BEF"}`:e.phase==="done"?i.textContent="\u5DF2\u5B8C\u6210":e.phase==="hashing"?i.textContent="\u6821\u9A8C\u4E2D\u2026":e.phase==="finalizing"?i.textContent="\u6536\u5C3E\u4E2D\u2026":i.textContent=`${ue(e.sent)} / ${ue(e.size)} \xB7 ${b.toFixed(0)}%`}},F=()=>{let e=t.files.filter(r=>r.type!=="dir").length,n=t.files.filter(r=>r.type==="dir").length,o="";if(e>0&&n>0?o=`${e} \u4E2A\u6587\u4EF6 + ${n} \u4E2A\u76EE\u5F55`:e>0?o=`${e} \u4E2A\u6587\u4EF6`:n>0&&(o=`${n} \u4E2A\u76EE\u5F55`),ee.textContent=o,h.replaceChildren(),t.loading){let r=document.createElement("div");r.className="fd-loading",r.textContent="\u52A0\u8F7D\u4E2D\u2026",h.append(r);return}if(t.error){let r=document.createElement("div");r.className="fd-error",r.textContent=t.error,h.append(r);return}let s=t.search.trim().toLowerCase(),i=Ee(t.files,s);if(i.length===0){let r=document.createElement("div");r.className="fd-empty",r.textContent=s?"\u6CA1\u6709\u5339\u914D\u7684\u6587\u4EF6\u6216\u76EE\u5F55\u3002":"\u8FD8\u6CA1\u6709\u6587\u4EF6\uFF0C\u5F80\u4E0A\u9762\u62D6\u4E00\u4E2A\u5427\u3002",h.append(r);return}for(let r of i){let m=document.createElement("div");m.className="fd-file";let b=r.type==="dir",p=document.createElement("input");p.type="checkbox",p.className="fd-file-check",p.checked=t.selected.has(r.id),p.onchange=()=>{p.checked?t.selected.add(r.id):t.selected.delete(r.id),se()};let z=document.createElement("div");z.className="fd-file-body";let B=document.createElement("div");if(B.className="fd-file-name",b){let d=document.createElement("span");d.className="fd-dir-icon",d.textContent="\u{1F4C1}",B.append(d)}B.append(document.createTextNode(r.name)),B.title=r.name;let A=document.createElement("div");A.className="fd-file-path",A.textContent=r.path,A.title="\u70B9\u51FB\u590D\u5236\u7EDD\u5BF9\u8DEF\u5F84",A.onclick=async()=>{let d=await be(r.path);f(d?"\u8DEF\u5F84\u5DF2\u590D\u5236":"\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u4E2D\u590D\u5236")},z.append(B,A);let J=document.createElement("div");J.className="fd-file-meta",b?J.textContent=`\u76EE\u5F55 \xB7 ${me(r.mtime)}`:J.textContent=`${r.sizeLabel} \xB7 ${me(r.createdAt)}`;let O=document.createElement("div");if(O.className="fd-file-actions",!b){let d=document.createElement("button");d.className="fd-btn",d.type="button",d.textContent="\u590D\u5236\u8DEF\u5F84",d.onclick=async()=>{let j=await be(r.path);f(j?"\u8DEF\u5F84\u5DF2\u590D\u5236":"\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u4E2D\u590D\u5236")},O.append(d)}if(!b){let d=document.createElement("button");d.className="fd-btn",d.type="button",d.textContent="\u4E0B\u8F7D",d.onclick=()=>de(r),O.append(d)}let L=document.createElement("button");L.className="fd-btn fd-danger",L.type="button",L.textContent=b?"\u5220\u9664\u76EE\u5F55":"\u5220\u9664",L.onclick=async()=>{L.disabled=!0;try{let d=await w("/plugins/file-drop/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{name:r.name}]})});if(!d.ok){let oe=await d.json().catch(()=>({}));throw new Error(oe.error??`HTTP ${d.status}`)}let j=await d.json();if(j.results&&j.results.length>0&&!j.results[0].ok)throw new Error(j.results[0].error??"\u5220\u9664\u5931\u8D25");t.files=t.files.filter(oe=>oe.id!==r.id),t.selected.delete(r.id),F(),f(`\u5DF2\u5220\u9664 ${r.name}`)}catch(d){f(`\u5220\u9664\u5931\u8D25\uFF1A${S(d)}`),L.disabled=!1}},O.append(L),m.append(p,z,J,O),h.append(m)}se()},se=()=>{let e=t.selected.size;I.style.display=e>0?"flex":"none",R.textContent=`\u5DF2\u9009\u62E9 ${e} \u9879`,x.disabled=e===0,y.disabled=e===0},ne=async()=>{let e=await a.request("file_drop.session",{});if(!e||typeof e.token!="string")throw new Error("\u6587\u4EF6\u4E2D\u8F6C\u7AD9\u6CA1\u6709\u62FF\u5230\u8BBF\u95EE\u4EE4\u724C");t.token=e.token,t.chunkBytes=Number(e.chunkBytes)||t.chunkBytes,t.rootDir=String(e.rootDir??""),_.textContent=t.rootDir?`\u5B58\u653E\u76EE\u5F55\uFF1A${t.rootDir}`:""},he=async()=>{let e=await w("/plugins/file-drop/files?limit=1000");if(!e.ok)throw new Error(`HTTP ${e.status}`);let n=await e.json();t.files=Array.isArray(n.files)?n.files:[];let o=new Set(t.files.map(s=>s.id));for(let s of[...t.selected])o.has(s)||t.selected.delete(s)},U=async()=>{if(!t.busy){t.busy=!0,k.disabled=!0,t.error="";try{t.token||await ne(),await he()}catch(e){t.error=`\u6587\u4EF6\u5217\u8868\u52A0\u8F7D\u5931\u8D25\uFF1A${S(e)}`}finally{t.loading=!1,t.busy=!1,k.disabled=!1,F()}}},xe=async e=>{let n={id:`${e.name}:${e.size}:${Math.random().toString(36).slice(2,8)}`,file:e,name:e.name,size:e.size,sent:0,phase:"uploading",error:""};t.queue.set(n.id,n),T();try{let o=await w("/plugins/file-drop/upload/begin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:e.name,size:e.size})});if(!o.ok){let p=await o.json().catch(()=>({}));throw new Error(p.error??`\u5F00\u59CB\u4E0A\u4F20\u5931\u8D25\uFF08HTTP ${o.status}\uFF09`)}let s=await o.json(),i=Number(s.chunkBytes)||t.chunkBytes,r=0;for(;r<e.size;){let p=e.slice(r,Math.min(r+i,e.size)),z=await w(`/plugins/file-drop/upload/${s.uploadId}?offset=${r}`,{method:"PUT",body:p,headers:{"Content-Type":"application/octet-stream"}});if(!z.ok){let B=await z.json().catch(()=>({}));throw new Error(B.error??`\u5206\u7247\u4E0A\u4F20\u5931\u8D25\uFF08HTTP ${z.status}\uFF09`)}r+=p.size,n.sent=r,T()}n.phase="finalizing",n.size>0&&(n.phase="done"),T();let m=await w(`/plugins/file-drop/upload/${s.uploadId}/complete`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});if(!m.ok){let p=await m.json().catch(()=>({}));throw new Error(p.error??`\u6536\u5C3E\u5931\u8D25\uFF08HTTP ${m.status}\uFF09`)}let b=await m.json();n.phase="done",n.sent=n.size,T(),b.file&&t.files.unshift(b.file),F(),setTimeout(()=>{t.queue.delete(n.id),T()},1400)}catch(o){n.phase="error",n.error=S(o),T()}},ie=async e=>{let n=[...e].filter(o=>o&&typeof o.size=="number");if(n.length!==0){try{t.token||await ne()}catch(o){f(`\u6682\u65F6\u65E0\u6CD5\u4E0A\u4F20\uFF1A${S(o)}`);return}for(let o of n)await xe(o);t.queue.size>0&&[...t.queue.values()].every(o=>o.phase==="done")&&(t.queue.clear(),T())}},de=async e=>{try{t.token||await ne();let n=t.token;if(!n)throw new Error("\u6CA1\u6709\u4E0B\u8F7D\u4EE4\u724C");let s=`${a.basePath&&a.basePath!=="/"?a.basePath.replace(/\/+$/,""):""}/plugins/file-drop/download/${e.id}?t=${encodeURIComponent(n)}`,i=document.createElement("a");i.href=s,i.download=e.name,i.rel="noopener",document.body.append(i),i.click(),i.remove(),f(`\u5F00\u59CB\u4E0B\u8F7D ${e.name}`)}catch(n){f(`\u4E0B\u8F7D\u5931\u8D25\uFF1A${S(n)}`)}},ye=()=>{v.classList.toggle("fd-show"),v.classList.contains("fd-show")&&u.focus()},le=async()=>{let e=u.value.trim();if(!e){f("\u8BF7\u8F93\u5165\u76EE\u5F55\u540D\u79F0");return}$.disabled=!0;try{let n=await w("/plugins/file-drop/mkdir",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:e})}),o=await n.json().catch(()=>({}));if(!n.ok||o.error)throw new Error(o.error??`HTTP ${n.status}`);f(`\u5DF2\u521B\u5EFA\u76EE\u5F55 ${o.name??e}`),v.classList.remove("fd-show"),u.value="",await U()}catch(n){f(`\u521B\u5EFA\u76EE\u5F55\u5931\u8D25\uFF1A${S(n)}`)}finally{$.disabled=!1}},ve=async()=>{if(t.selected.size===0)return;let e=[...t.selected].map(n=>({name:t.files.find(s=>s.id===n)?.name??""})).filter(n=>n.name);if(e.length!==0&&confirm(`\u786E\u8BA4\u5220\u9664 ${e.length} \u9879\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002`)){x.disabled=!0;try{let n=await w("/plugins/file-drop/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:e})});if(!n.ok){let i=await n.json().catch(()=>({}));throw new Error(i.error??`HTTP ${n.status}`)}let s=((await n.json()).results??[]).filter(i=>!i.ok);s.length>0?f(`\u90E8\u5206\u5220\u9664\u5931\u8D25\uFF1A${s.map(i=>i.name+" ("+(i.error??"?")+")").join("\u3001")}`):f(`\u5DF2\u5220\u9664 ${e.length} \u9879`),t.selected.clear(),await U()}catch(n){f(`\u6279\u91CF\u5220\u9664\u5931\u8D25\uFF1A${S(n)}`)}finally{x.disabled=!1}}};E.onchange=()=>{let e=E.files?[...E.files]:[];E.value="",ie(e)},g.addEventListener("dragover",e=>{e.preventDefault(),g.classList.add("fd-over")}),g.addEventListener("dragleave",()=>g.classList.remove("fd-over")),g.addEventListener("drop",e=>{e.preventDefault(),g.classList.remove("fd-over"),e.dataTransfer?.files?.length&&ie(e.dataTransfer.files)});let ce=e=>e.preventDefault();P.addEventListener("dragover",ce),P.addEventListener("drop",ce);let re=0;C.oninput=()=>{clearTimeout(re),re=setTimeout(()=>{t.search=C.value,F()},120)},k.onclick=()=>{U()};let fe=new MutationObserver(()=>{t.rootDir&&(N.style.display="")});return fe.observe(_,{childList:!0,characterData:!0}),N.onclick=ye,$.onclick=le,M.onclick=()=>{v.classList.remove("fd-show"),u.value=""},u.onkeydown=e=>{e.key==="Enter"&&le(),e.key==="Escape"&&(v.classList.remove("fd-show"),u.value="")},x.onclick=ve,q.onclick=()=>{t.selected.clear(),F()},F(),U(),{dispose:()=>{fe.disconnect(),clearTimeout(te),clearTimeout(re),G.abort(),P.remove(),D.remove()}}}})}};function Ee(a,c){return c?a.filter(l=>String(l.name??"").toLowerCase().includes(c)):a}async function be(a){try{if(navigator.clipboard?.writeText)return await navigator.clipboard.writeText(a),!0}catch{}try{let c=document.createElement("textarea");c.value=a,c.setAttribute("readonly",""),c.style.position="fixed",c.style.opacity="0",document.body.append(c),c.select();let l=document.execCommand("copy");return c.remove(),l}catch{return!1}}export{Te as default};
