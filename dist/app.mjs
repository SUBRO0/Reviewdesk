import {review,samples} from "./engine.mjs";
const $=id=>document.getElementById(id);
const paths={layout:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M10 9v12"/>',history:'<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6m3-4v6l4 2"/>',book:'<path d="M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1zM12 6v14"/>',panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',plus:'<path d="M12 5v14M5 12h14"/>',code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',rotate:'<path d="M3 4v6h6M3 10a9 9 0 1 1 2 9"/>',spark:'<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3zM20 2v4m-2-2h4"/>',scan:'<path d="M3 8V4h5m8 0h5v4M3 16v4h5m8 0h5v-4M8 12l3 3 6-7"/>',trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',down:'<path d="m6 9 6 6 6-6"/>',up:'<path d="m6 15 6-6 6 6"/>'};
const icon=name=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+paths[name]+'</svg>';
document.querySelectorAll("[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const severity=["high","medium","low"], key="reviewdesk.reviews.v1", limit=50000;
let lang="Python", file=samples.Python.file, result=null, filter="all", draft=false, busy=false, pending=null;
let history=[];
try {const data=JSON.parse(localStorage.getItem(key)||"[]"); if(Array.isArray(data)) history=data.filter(r=>r && samples[r.lang] && typeof r.code==="string" && Array.isArray(r.findings)).slice(0,20);} catch {}
function notify(message){$("notice").textContent=message;}
function persist(){try{localStorage.setItem(key,JSON.stringify(history));return true;}catch{return false;}}
function highlight(code){
  const pattern=/("""[^\n]*?"""|'''[^\n]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#[^\n]*|\/\/[^\n]*|\b(?:def|return|for|in|try|except|if|else|None|True|False|while|import|from|class|with|async|await|function|let|const|var|of|throw|catch|finally|new|null|true|false)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*(?=\())/g;
  let html="", last=0;
  for(const m of code.matchAll(pattern)){const t=m[0];const kind=/^["']/.test(t)?"str":/^(#|\/\/)/.test(t)?"com":/^\d/.test(t)?"num":code[m.index+t.length]==="(" && !/^(if|for|catch|while)$/.test(t)?"fn":"kw";
    html+=esc(code.slice(last,m.index))+'<span class="'+kind+'">'+esc(t)+'</span>';last=m.index+t.length;}
  return html+esc(code.slice(last))+"\n";
}
function sync(){for(const id of ["highlight","gutter"]) $(id).scrollTop=$("code").scrollTop;$("highlight").scrollLeft=$("code").scrollLeft;}
function updateEditor(){const code=$("code").value,n=code.split("\n").length;$("highlight").innerHTML=highlight(code);$("gutter").textContent=Array.from({length:n},(_,i)=>i+1).join("\n")+"\n";$("linecount").textContent=n+(n===1?" line":" lines");$("filename").textContent=file;$("language").value=lang;sync();}
function renderResults(){
  const items=result?.findings||[];
  $("summary").textContent=result?items.length+" "+(items.length===1?"finding":"findings")+" · "+result.engine:"Run a review to see findings.";
  $("export").disabled=!result;
  $("filters").innerHTML=["all",...severity].map(s=>'<button class="filter" data-filter="'+s+'" aria-pressed="'+(s===filter)+'">'+s[0].toUpperCase()+s.slice(1)+' <b>'+(s==="all"?items.length:items.filter(f=>f.severity===s).length)+'</b></button>').join("");
  const visible=items.map((f,i)=>({f,i})).filter(({f})=>filter==="all"||f.severity===filter);
  if(!visible.length){let title=!result?"Ready for review":items.length?"No "+filter+" findings":"No findings from this engine";let body=!result?"Run the reviewer on the current source.":items.length?"Choose another severity to explore the results.":"Check the code’s behavior with tests and review any assumptions the engine may have missed.";$("findings").innerHTML='<div class="empty"><strong>'+esc(title)+'</strong><p>'+esc(body)+'</p></div>';return;}
  $("findings").innerHTML=visible.map(({f,i})=>'<div class="finding '+esc(f.severity)+'"><div class="fmeta"><span class="badge">'+esc(f.severity[0].toUpperCase()+f.severity.slice(1))+'</span><span>'+esc(f.category)+'</span><button class="line" data-line="'+Number(f.line)+'">Line '+Number(f.line)+'</button></div><button class="toggle" data-expand="'+i+'" aria-expanded="false" aria-controls="fix'+i+'">'+esc(f.title)+'<i>'+icon("down")+'</i></button><p>'+esc(f.detail)+'</p><div class="solution" id="fix'+i+'" hidden><strong>Suggested change</strong><p>'+esc(f.fix)+'</p><small>Source · '+esc(f.source)+'</small></div></div>').join("");
}
function page(name){document.querySelectorAll("main section").forEach(el=>el.hidden=el.id!==name);document.querySelectorAll(".nav").forEach(el=>{const active=el.dataset.page===name;el.classList.toggle("active",active);if(active) el.setAttribute("aria-current","page");else el.removeAttribute("aria-current");});$("breadcrumb").textContent={workspace:"Workspace",history:"Review history",guide:"Project guide"}[name];if(name==="history") renderHistory();}
function renderHistory(){$("historylist").innerHTML=history.length?history.map((r,i)=>'<div class="hrow"><button data-open="'+i+'"><strong>'+esc(r.file)+'</strong><small>'+esc(r.engine)+' · '+r.findings.length+' findings · '+esc(new Date(r.time).toLocaleString())+'</small></button><button class="iconbtn" data-delete="'+i+'" aria-label="Delete review">'+icon("trash")+'</button></div>').join(""):'<div class="empty"><strong>No saved reviews yet</strong><p>Run a review in the workspace to save your first result.</p></div>';}
function replaceDraft(fn){if(busy)return;if(draft){pending=fn;$("confirm").showModal();}else fn();}
$("cancel").onclick=()=>$("confirm").close();
$("confirm").onclose=()=>{pending=null;};
$("replace").onclick=()=>{const fn=pending;$("confirm").close();if(fn)fn();};
function load(code,language,name,status,report=null){lang=language;file=name;$("code").value=code;result=report;filter="all";draft=false;$("editStatus").textContent=status;notify("");updateEditor();renderResults();$("code").scrollTop=0;$("code").scrollLeft=0;sync();}
function example(language){$("mode").value="browser";$("engineName").textContent="Browser engine";const s=samples[language];load(s.code,language,s.file,"Example loaded",{...s,lang:language,engine:"Browser",findings:review(s.code,language)});}
function dirty(){draft=true;result=null;filter="all";$("editStatus").textContent="Edited draft";notify("");updateEditor();renderResults();}
$("code").addEventListener("input",dirty);$("code").addEventListener("scroll",sync);
$("code").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();run();}});
$("language").onchange=e=>{lang=e.target.value;file=lang==="Python"?"snippet.py":"snippet.js";dirty();};
$("mode").onchange=()=>{result=null;$("editStatus").textContent="Ready to review";renderResults();};
$("new").onclick=()=>replaceDraft(()=>{load("",lang,lang==="Python"?"snippet.py":"snippet.js","New draft");$("code").focus();});
$("sample").onclick=()=>replaceDraft(()=>example(lang));$("upload").onclick=()=>$("file").click();
$("file").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const ext=f.name.split(".").pop().toLowerCase();if(!["py","js","mjs","cjs"].includes(ext)||f.size>limit*4){notify("Choose a Python or JavaScript file under 50,000 characters.");return;}
  try{const source=(await f.text()).replace(/\r\n?/g,"\n");if(source.length>limit){notify("File exceeds 50,000 characters.");return;}replaceDraft(()=>{load(source,ext==="py"?"Python":"JavaScript",f.name,"File loaded");draft=true;});}catch{notify("Could not open this file.");}};
function lock(locked){busy=locked;for(const id of ["run","language","upload","new","mode","sample"]) $(id).disabled=locked;$("code").readOnly=locked;$("run").querySelector("span").textContent=locked?"Reviewing…":"Run review";}
async function run(){if(busy)return;const code=$("code").value;if(!code.trim()){notify("Enter some code to review.");$("code").focus();return;}lock(true);notify("");try{
  let findings,engine;
  if($("mode").value==="ollama"){const response=await fetch("/api/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,language:lang})});const data=await response.json();if(!response.ok)throw Error(data.error||"Model review failed.");findings=data.findings;engine=data.engine;}
  else {findings=review(code,lang);engine="Browser";}
  result={code,file,lang,findings,engine,time:new Date().toISOString()};filter="all";draft=false;history=[result,...history].slice(0,20);$("editStatus").textContent="Reviewed";renderResults();notify(persist()?"Review saved to history.":"Review complete. Browser storage is full or unavailable. Download the report to keep it.");
}catch(e){notify(e.message||"Review failed. Try again.");}finally{lock(false);}}
$("run").onclick=run;
$("filters").onclick=e=>{const b=e.target.closest("[data-filter]");if(b){filter=b.dataset.filter;renderResults();}};
$("findings").onclick=e=>{
  const line=e.target.closest("[data-line]");if(line){const n=Number(line.dataset.line),lines=$("code").value.split("\n");const start=lines.slice(0,n-1).reduce((sum,s)=>sum+s.length+1,0);$("code").focus();$("code").setSelectionRange(start,start+lines[n-1].length);$("code").scrollTop=Math.max(0,(n-3)*parseFloat(getComputedStyle($("code")).lineHeight));sync();return;}
  const b=e.target.closest("[data-expand]");if(!b)return;const target=$("fix"+b.dataset.expand);target.hidden=!target.hidden;b.setAttribute("aria-expanded",String(!target.hidden));b.querySelector("i").innerHTML=icon(target.hidden?"down":"up");
};
$("export").onclick=()=>{if(!result)return;const r=result;const rows=r.findings.map(f=>'## '+f.severity.toUpperCase()+' · Line '+f.line+' · '+f.title+'\n\n'+f.detail+'\n\nSuggested change: '+f.fix+'\n\nSource: '+f.source);const blob=new Blob([['# Review of '+r.file,'Engine: '+r.engine,...(rows.length?rows:['No findings from this engine.'])].join('\n\n')],{type:"text/markdown"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=r.file+".review.md";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>page(b.dataset.page));
$("historylist").onclick=e=>{const open=e.target.closest("[data-open]"),del=e.target.closest("[data-delete]");if(open){const r=history[Number(open.dataset.open)];replaceDraft(()=>{load(r.code,r.lang,r.file,"Saved review",r);$("mode").value=r.engine==="Browser"?"browser":$("mode").querySelector('[value="ollama"]')?"ollama":"browser";$("engineName").textContent=$("mode").value==="ollama"?"Ollama engine":"Browser engine";page("workspace");});}if(del){const previous=history;history=history.filter((_,i)=>i!==Number(del.dataset.delete));if(!persist()){history=previous;alert("Could not update browser storage.");}renderHistory();}};
example("Python");
if(["127.0.0.1","localhost"].includes(location.hostname)){
  fetch("/api/config").then(async r=>{if(!r.ok)return;const c=await r.json();if(c.ollama){$("mode").add(new Option("Ollama · "+c.model,"ollama"));}}).catch(()=>{});
}
$("mode").addEventListener("change",()=>{$("engineName").textContent=$("mode").value==="ollama"?"Ollama engine":"Browser engine";});
