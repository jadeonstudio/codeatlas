import {icon} from './icons.js';
// This viewer renders agent-authored data. It never calls a model or executes project code.
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds={surface:'화면',feature:'기능',action:'사용자 동작',interface:'API·인터페이스',service:'서비스',data:'데이터',state:'상태',process:'백그라운드',external:'외부 시스템',resource:'기기·리소스',test:'테스트',module:'모듈'};
const relations={navigates:'화면 이동',contains:'포함',triggers:'실행',calls:'호출',reads:'읽기',writes:'쓰기',depends:'의존',invalidates:'캐시 갱신',authorizes:'권한 확인',publishes:'이벤트 발행',consumes:'이벤트 소비',tests:'검증',uses:'사용'};
const evidenceKinds={source:'소스 근거',runtime:'실행 관측',test:'테스트 기록',measurement:'측정 기록',inference:'에이전트 추정',document:'문서 근거'};
const confidence={observed:'근거 확인',inferred:'추정',unconfirmed:'미확인'};
const statuses={'not-started':'분석 전','in-progress':'분석 중',partial:'일부 확인',ready:'분석 결과 게시됨',blocked:'분석 중단'};
const levels={direct:'직접 영향',indirect:'간접 영향',possible:'영향 가능성'};
const reportStatuses={proposed:'변경 제안',applied:'수정 반영',verified:'명시된 테스트 통과',partial:'일부 검증'};
const modeLabels={flow:'사용자 흐름',system:'시스템 구조',data:'데이터 관계',process:'실행 프로세스'};
const session=new URLSearchParams(location.search).get('session')||'main';
const hashParams=new URLSearchParams(location.hash.slice(1));
let token=hashParams.get('token')||sessionStorage.getItem('codeatlas-token')||'';
if(hashParams.has('token')){sessionStorage.setItem('codeatlas-token',token);history.replaceState(null,'',location.pathname+location.search);}
const S={g:null,etag:null,mode:'map',category:'all',view:null,tab:'overview',selected:[],edge:null,selection:null,report:null,offline:false,pending:false,error:null,zoom:1,x:0,y:0,labels:false,list:false,changed:new Set(),history:[],diff:null,panelClosed:false,preferences:{},filter:null};
let pollTimer,toastTimer,selectionQueue=Promise.resolve(),requestSequence=0,drag=null,assetURLs=[];
const badge=(label,cls='',ico='')=>`<span class="badge ${cls}">${ico?icon(ico):''}${esc(label)}</span>`;
const iconFor=n=>n.icon||(n.platforms?.includes('mobile')?'phone':({surface:'monitor',feature:'spark',action:'branch',interface:'code',service:'box',data:'database',state:'layers',process:'clock',external:'external',resource:'phone',test:'flask',module:'box'}[n.kind]||'box'));
const nodeIcon=n=>`<span class="node-ico">${icon(iconFor(n))}</span>`;
const byId=id=>S.g.nodes.find(n=>n.id===id);
const getView=()=>S.g?.views.find(v=>v.id===S.view)||S.g?.views[0];
const getReport=()=>S.g?.reports.find(r=>r.id===S.report)||[...(S.g?.reports||[])].reverse().find(r=>r.kind==='impact')||[...(S.g?.reports||[])].reverse().find(r=>r.kind!=='change');
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4200);}
async function api(route,{method='GET',body,etag}={}){
  const headers={Authorization:`Bearer ${token}`};if(body!==undefined)headers['Content-Type']='application/json';if(etag)headers['If-None-Match']=etag;
  const response=await fetch(route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  if(response.status===304)return {unchanged:true};
  const data=await response.json().catch(()=>({error:'응답을 읽을 수 없습니다.'}));
  if(!response.ok){const e=new Error(data.error||'요청에 실패했습니다.');e.status=response.status;throw e;}
  return {data,etag:response.headers.get('ETag')};
}
function auth(message='에이전트가 출력한 전체 URL을 열어 주세요. URL의 #token 부분은 이 로컬 화면의 접근 키입니다.'){
  $('#app').innerHTML=`<main class="auth"><div class="brand"><img src="/logo.svg" alt="">CodeAtlas</div><h1 style="margin-top:30px">프로젝트 지도 연결</h1><p>${esc(message)}</p><p>기존 에이전트가 실행한 <code>serve</code> 명령의 URL을 사용하세요. 서버가 재시작되면 새 URL이 필요합니다.</p><label for="token">로컬 접근 키</label><input id="token" type="password" autocomplete="off" placeholder="#token= 뒤의 값을 붙여 넣으세요"><button class="btn primary" id="connect">${icon('link')}연결하기</button><p class="mini-caption">CodeAtlas는 모델에 연결하지 않습니다. 분석과 수정은 사용 중인 에이전트가 담당합니다.</p></main>`;
  $('#connect').onclick=()=>{token=$('#token').value.trim();sessionStorage.setItem('codeatlas-token',token);boot();};
}
function storedPrefs(){try{return JSON.parse(localStorage.getItem(`atlas:${S.g.project.id}`)||'{}');}catch{return {};}}
function savePrefs(){try{localStorage.setItem(`atlas:${S.g.project.id}`,JSON.stringify(S.preferences));}catch{toast('이 브라우저에서는 보기 설정을 저장할 수 없습니다.');}}
async function boot(){
  clearTimeout(pollTimer);
  if(!token){auth();return;}
  try{
    const r=await api('/api/graph');S.g=r.data;S.etag=r.etag;S.preferences=storedPrefs();S.labels=S.preferences.labels??false;S.list=S.preferences.list??false;
    S.view=S.preferences.view||S.g.views[0]?.id;S.selection=(await api('/api/selection?session='+encodeURIComponent(session))).data;S.selected=S.selection.nodeIds.filter(id=>byId(id));
    if(S.selection.viewId&&S.g.views.some(v=>v.id===S.selection.viewId))S.view=S.selection.viewId;
    renderShell();renderMain();renderDetails();requestAnimationFrame(fit);poll();
  }catch(e){auth(e.status===401?'접근 키가 만료되었거나 올바르지 않습니다. 서버가 출력한 새 URL을 열어 주세요.':`로컬 서버에 연결하지 못했습니다. ${e.message}`);}
}
function renderShell(){
  const g=S.g,counts=Object.fromEntries(Object.keys(kinds).map(k=>[k,g.nodes.filter(n=>n.kind===k).length]));
  const nav=(label,ico,category,count)=>`<button class="navitem ${S.category===category&&S.mode==='map'?'active':''}" data-category="${category}">${icon(ico)}<span>${label}</span>${count!==undefined?`<span class="count">${count}</span>`:''}</button>`;
  $('#app').innerHTML=`<header class="topbar"><button class="icon-button menu-toggle" aria-label="탐색 메뉴 열기">${icon('menu')}</button><div class="brand"><img src="/logo.svg" alt="">CodeAtlas <span class="version">미리보기</span></div><div class="searchbox">${icon('search')}<input id="search" aria-label="프로젝트 전체 검색" placeholder="화면, 기능, API를 검색하세요…" autocomplete="off"><span class="key">⌘ K</span><div id="search-results"></div></div><nav class="topnav" aria-label="주요 보기">${[['map','grid','지도'],['impact','branch','영향 분석'],['changes','clock','변경 이력'],['settings','gear','설정']].map(([id,ico,label])=>`<button data-mode="${id}" class="${S.mode===id?'active':''}" title="${label}">${icon(ico)}<span>${label}</span></button>`).join('')}</nav><div class="avatar" title="로컬 작업 공간">CA</div></header><div class="workspace"><aside class="sidebar" aria-label="프로젝트 탐색"><div class="project"><span class="project-icon">${icon('home')}</span><span class="project-name" title="${esc(g.project.name)}">${esc(g.project.name)}</span></div>${nav('프로젝트 개요','home','all')}${nav('화면','monitor','surface',counts.surface)}${nav('기능·동작','spark','feature',counts.feature+counts.action)}${nav('API·서비스','code','interface',counts.interface+counts.service)}${nav('데이터·상태','database','data',counts.data+counts.state)}<div class="navlabel">연결과 흐름</div>${nav('사용자 흐름','branch','flows',g.views.filter(v=>v.mode==='flow').length)}${nav('백그라운드','clock','process',counts.process)}${nav('외부 시스템','external','external',counts.external+counts.resource)}<div class="navlabel">작업 공간</div><button class="navitem" id="bookmarks">${icon('bookmark')}저장한 보기<span class="count">${S.preferences.bookmarks?.length||0}</span></button><button class="navitem" id="list-toggle">${icon(S.list?'map':'list')}${S.list?'그래프로 보기':'목록으로 보기'}</button><div class="sidebar-bottom"><div class="agent-card"><span class="live-dot"></span> <span id="connection-label">로컬 화면 연결됨</span><strong>${esc(g.analysis.agent)}</strong><span id="analysis-label">${esc(statuses[g.analysis.status])}</span><br><span class="mini-caption">분석 기준 리비전 ${g.revision}</span></div><button class="sidebar-button" id="refresh">${icon('refresh')}분석 결과 새로 읽기</button></div></aside><div class="content"><main class="main" id="main" tabindex="-1"></main><aside class="details ${S.selected.length?'':'empty'}" aria-label="선택 항목 상세"></aside></div></div>`;
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>setCategory(b.dataset.category));
  $('#search').oninput=showSearch;$('#search').onkeydown=e=>{if(e.key==='ArrowDown'){$('#search-results button')?.focus();e.preventDefault();}if(e.key==='Escape'){$('#search').value='';showSearch();}};
  $('#refresh').onclick=()=>poll(true);
  $('#list-toggle').onclick=()=>{S.list=!S.list;S.preferences.list=S.list;savePrefs();renderShell();renderMain();renderDetails();fit();};
  $('#bookmarks').onclick=()=>setMode('bookmarks');
  $('.menu-toggle').onclick=()=>$('.sidebar').classList.toggle('open');
}
function setMode(mode){S.mode=mode;S.edge=null;S.tab='overview';S.diff=null;renderShell();renderMain();renderDetails();fit();if(mode==='changes')loadHistory();}
function setCategory(category){S.mode='map';S.category=category;S.filter=null;
  if(category==='all'||category==='flows'){const v=S.g.views.find(v=>v.mode==='flow')||S.g.views[0];if(v)S.view=v.id;}
  if(category==='process'){const v=S.g.views.find(v=>v.mode==='process');if(v)S.view=v.id;}
  renderShell();renderMain();renderDetails();fit();
}
function showSearch(){const q=$('#search').value.trim().toLowerCase(),container=$('#search-results');if(!q){container.innerHTML='';return;}
  const hits=S.g.nodes.filter(n=>[n.label,n.path,n.description,n.id].join(' ').toLowerCase().includes(q)).slice(0,16);
  container.innerHTML=`<div class="search-results" role="list" aria-label="검색 결과">${hits.length?hits.map(n=>`<button data-hit="${esc(n.id)}">${icon(iconFor(n))}<span>${esc(n.label)}</span><small>${esc(kinds[n.kind])}</small></button>`).join(''):'<div class="nothing">일치하는 항목이 없습니다.</div>'}</div>`;
  container.querySelectorAll('[data-hit]').forEach(b=>b.onclick=()=>{const id=b.dataset.hit;S.mode='map';S.category='all';const v=S.g.views.find(v=>v.nodeIds.includes(id));S.filter=null;if(v)S.view=v.id;else S.filter=id;$('#search').value='';container.innerHTML='';renderShell();renderMain();selectNode(id);fit();});
}
function viewNodes(){
  if(S.mode==='impact'){
    const r=getReport();if(!r)return [];
    const ids=new Set([...r.targetIds,...r.affected.map(a=>a.nodeId)]);
    for(const a of r.affected)for(const id of a.pathEdgeIds||[]){const e=S.g.edges.find(x=>x.id===id);if(e){ids.add(e.source);ids.add(e.target);}}
    return S.g.nodes.filter(n=>ids.has(n.id));
  }
  if(S.filter){const ids=new Set([S.filter,...S.g.edges.filter(e=>e.source===S.filter||e.target===S.filter).flatMap(e=>[e.source,e.target])]);return S.g.nodes.filter(n=>ids.has(n.id));}
  const categoryKinds={feature:['feature','action'],interface:['interface','service'],data:['data','state'],external:['external','resource'],surface:['surface']};
  if(categoryKinds[S.category])return S.g.nodes.filter(n=>categoryKinds[S.category].includes(n.kind));
  if(S.category==='process'&&!S.g.views.some(v=>v.mode==='process'))return S.g.nodes.filter(n=>n.kind==='process');
  const ids=new Set(getView()?.nodeIds||S.g.nodes.slice(0,40).map(n=>n.id));return S.g.nodes.filter(n=>ids.has(n.id));
}
function graphData(){const all=viewNodes(),nodes=all.slice(0,150),ids=new Set(nodes.map(n=>n.id)),v=getView();let edges=S.g.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
  if(S.mode==='map'&&['all','flows','process'].includes(S.category)&&v?.edgeIds&&!S.filter){const eset=new Set(v.edgeIds);edges=edges.filter(e=>eset.has(e.id));}
  const positions={};const declared=S.mode==='map'&&['all','flows','process'].includes(S.category)&&!S.filter?v?.positions||{}:{};
  nodes.forEach((n,i)=>{positions[n.id]=declared[n.id]||{x:50+(i%3)*255,y:60+Math.floor(i/3)*155};});
  return {nodes,edges,positions,truncated:all.length>150};
}
function head(title,description,eyebrow='프로젝트 지도',seg=true){return `<div class="main-head"><div><div class="eyebrow"><span class="diamond"></span>${esc(eyebrow)}</div><h1>${esc(title)}</h1><p class="subtitle">${esc(description)}</p></div>${seg?`<div class="segmented" aria-label="지도 관점">${[['flow','흐름'],['system','구조'],['data','데이터']].map(([mode,l])=>`<button data-perspective="${mode}" class="${getView()?.mode===mode?'active':''}">${l}</button>`).join('')}</div>`:''}</div>`;}
function renderMain(){
  const g=S.g,main=$('#main'),v=getView();
  const demo=g.project.demo?'<div class="bar-note demo">'+icon('info')+'예시 프로젝트입니다. 화면·연결·성능 수치는 실제 프로젝트 분석 결과가 아닙니다.</div>':'';
  const stale=S.selection?.stale?'<div class="bar-note">'+icon('warning')+'선택 이후 지도가 갱신되었습니다. 수정 전 대상을 다시 선택하세요.</div>':'';
  const error=S.error?`<div class="bar-note error">${icon('warning')}${esc(S.error)}</div>`:'';
  let content='';
  if(S.mode==='settings'){content=head('작업 공간 설정','판단과 개발은 에이전트에게, 표현과 선택은 CodeAtlas에게.','로컬 설정',false)+settingsHTML();}
  else if(S.mode==='bookmarks'){content=head('저장한 보기','중요한 흐름과 화면 위치를 다시 찾아보세요.','내 브라우저에 저장',false)+bookmarksHTML();}
  else if(S.mode==='changes'){content=head('변경 이력','에이전트가 게시한 수정 결과와 지도 리비전을 비교합니다.','변경 결과',false)+changesHTML();}
  else if(!g.nodes.length){content=head('프로젝트 이해의 시작','에이전트가 프로젝트를 조사하고 결과를 게시하면 지도가 나타납니다.','최초 분석',false)+`<div class="empty-state">${icon(g.analysis.status==='in-progress'?'refresh':'map')}<h2>${g.analysis.status==='in-progress'?'에이전트가 구조를 정리하고 있습니다':'아직 분석된 지도가 없습니다'}</h2><p>${esc(g.analysis.summary)}</p><p>기존 에이전트 대화창에서 CodeAtlas 지침을 읽고<br>프로젝트 분석을 시작하도록 요청하세요.</p><pre>.codeatlas/INSTRUCTIONS.md를 읽고\n현재 프로젝트의 CodeAtlas 지도를 만들어줘.</pre>${g.analysis.status==='in-progress'?'<div class="progress-line"><span></span></div>':''}<p class="mini-caption">임의의 완료율이나 완료 시간을 표시하지 않습니다.</p></div>`;}
  else if(S.mode==='impact'&&!getReport()){content=head('변경 영향 분석','변경 의도에 대한 에이전트의 판단을 지도에서 확인합니다.','분석 결과',false)+`<div class="empty-state">${icon('branch')}<h2>아직 게시된 영향 분석이 없습니다</h2><p>지도에서 대상을 선택한 뒤 기존 대화창에<br>어떻게 바꾸려는지 설명해 주세요.</p><button class="btn" id="back-map">${icon('map')}지도로 돌아가기</button><p class="mini-caption">연결 관계만으로 영향이나 오류를 확정하지 않습니다.</p></div>`;}
  else {
    const r=S.mode==='impact'?getReport():null;
    const title=r?r.title:S.filter?`${byId(S.filter)?.label}의 연결`:({surface:'화면과 연결',feature:'기능과 사용자 동작',interface:'API와 서비스',data:'데이터와 상태',external:'외부 시스템과 기기'}[S.category]||v?.label||'프로젝트 지도');
    content=head(title,r?r.summary:S.filter?'선택 항목 주변의 연결만 집중해서 봅니다.':v?.description||'항목을 선택하면 기능과 연결 근거를 확인할 수 있습니다.',r?'에이전트가 게시한 분석':modeLabels[v?.mode]||'프로젝트 지도',!r);
    content+=`<div class="view-toolbar">${r?`<select class="view-select" id="report-select" aria-label="분석 결과 선택">${g.reports.filter(x=>x.kind!=='change').map(x=>`<option value="${esc(x.id)}" ${x.id===r.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select><div class="legend"><span><i class="dot direct"></i>직접</span><span><i class="dot indirect"></i>간접</span><span><i class="dot possible"></i>가능성</span></div>`:`<select class="view-select" id="view-select" aria-label="흐름 선택">${g.views.map(x=>`<option value="${esc(x.id)}" ${x.id===S.view?'selected':''}>${esc(x.label)}</option>`).join('')}</select><button class="icon-button" id="save-view" title="현재 보기 저장" aria-label="현재 보기 저장">${icon('bookmark')}</button><span class="tiny">${graphData().nodes.length}개 항목 표시${graphData().truncated?' · 나머지는 검색으로 탐색':''}</span>`}</div>`;
    if(g.analysis.status==='in-progress'||g.analysis.status==='blocked')content+=`<div class="loading-note">${icon('info')} ${esc(g.analysis.summary)}</div>`;
    if(r?.kind==='performance')content+=`<div class="loading-note">${esc(r.metrics?.map(m=>`${m.label}: ${m.before??'미측정'} → ${m.after??'미측정'} ${m.unit} (${m.kind==='measured'?'실측':'추정'})`).join(' · ')||'성능 수치가 아직 게시되지 않았습니다.')}</div>`;
    content+=S.list?'<div class="listview"></div>':'<div class="canvas" aria-label="연결 지도. 노드를 선택하거나 배경을 드래그하여 이동하세요."><div class="world"><svg class="edges" aria-label="연결선"></svg><div class="nodes"></div></div><div class="graph-tools"><button class="minimap" title="전체 지도 맞춤" aria-label="전체 지도 맞춤"></button><div class="zoomtools"><button data-zoom="in" aria-label="확대">'+icon('plus')+'</button><button data-zoom="out" aria-label="축소">'+icon('minus')+'</button><button data-zoom="fit" aria-label="전체 맞춤">'+icon('fit')+'</button></div></div><div class="canvas-hint">드래그로 이동 · 휠로 확대 · <kbd>Shift</kbd> + 클릭으로 다중 선택</div></div>';
  }
  main.innerHTML=demo+stale+error+content;
  main.querySelectorAll('[data-perspective]').forEach(b=>b.onclick=()=>{const next=g.views.find(x=>x.mode===b.dataset.perspective);if(!next){toast('이 관점의 보기가 아직 게시되지 않았습니다. 기존 대화창에서 에이전트에게 요청하세요.');return;}S.view=next.id;S.category='all';S.filter=null;S.preferences.view=S.view;savePrefs();renderShell();renderMain();renderDetails();fit();});
  if($('#view-select'))$('#view-select').onchange=e=>{S.view=e.target.value;S.category='all';S.filter=null;S.preferences.view=S.view;savePrefs();renderShell();renderMain();renderDetails();fit();};
  if($('#report-select'))$('#report-select').onchange=e=>{S.report=e.target.value;renderMain();renderDetails();fit();};
  if($('#save-view'))$('#save-view').onclick=saveView;
  if($('#back-map'))$('#back-map').onclick=()=>setMode('map');
  if($('.canvas')||$('.listview'))drawGraph();
  bindSettings();bindHistory();bindBookmarks();
}
function nodeHTML(n,position){const report=S.mode==='impact'?getReport():null,affected=report?.affected.find(a=>a.nodeId===n.id),selected=S.selected.includes(n.id);
  const neighbors=new Set(S.g.edges.filter(e=>S.selected.includes(e.source)||S.selected.includes(e.target)).flatMap(e=>[e.source,e.target]));
  const dim=S.selected.length&&!selected&&!neighbors.has(n.id)&&S.mode==='map';
  return `<button class="node ${n.kind} ${n.platforms?.includes('mobile')?'mobile':''} ${selected?'selected':''} ${dim?'dim':''} ${affected?.level||''} ${S.changed.has(n.id)?'changed':''}" data-node="${esc(n.id)}" style="left:${position?.x||0}px;top:${position?.y||0}px" aria-pressed="${selected}" aria-label="${esc(n.label)} · ${esc(kinds[n.kind])}">${nodeIcon(n)}<span class="node-title">${esc(n.label)}${n.subtitle?`<small class="node-sub">${esc(n.subtitle)}</small>`:''}</span></button>`;
}
function drawGraph(){const {nodes,edges,positions}=graphData();
  if($('.listview')){$('.listview').innerHTML=nodes.map(n=>nodeHTML(n)).join('')||'<p class="mini-caption">이 분류에서 분석된 항목이 없습니다.</p>';bindNodes();return;}
  if(!$('.nodes'))return;
  $('.nodes').innerHTML=nodes.map(n=>nodeHTML(n,positions[n.id])).join('');
  const svg=$('.edges');const extent=nodes.reduce((a,n)=>({w:Math.max(a.w,positions[n.id].x+220),h:Math.max(a.h,positions[n.id].y+100)}),{w:600,h:400});svg.setAttribute('width',extent.w);svg.setAttribute('height',extent.h);
  const report=S.mode==='impact'?getReport():null;
  svg.innerHTML='<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="context-stroke" stroke-width="1.4"/></marker></defs>'+edges.map(e=>{
    const a=positions[e.source],b=positions[e.target];let x1,y1,x2,y2,c1,c2;
    if(Math.abs(a.x-b.x)<100){const down=b.y>=a.y;x1=a.x+88;y1=a.y+(down?68:0);x2=b.x+88;y2=b.y+(down?0:68);const d=Math.max(35,Math.abs(y2-y1)*.5);c1=`${x1} ${y1+(down?d:-d)}`;c2=`${x2} ${y2+(down?-d:d)}`;}
    else{const right=b.x>a.x;x1=a.x+(right?176:0);y1=a.y+34;x2=b.x+(right?0:176);y2=b.y+34;const d=Math.max(45,Math.abs(x2-x1)*.5);c1=`${x1+(right?d:-d)} ${y1}`;c2=`${x2+(right?-d:d)} ${y2}`;}
    const d=`M ${x1} ${y1} C ${c1}, ${c2}, ${x2} ${y2}`;
    const focus=S.selected.includes(e.source)||S.selected.includes(e.target)||S.edge===e.id;
    const impact=report?.affected.find(a=>a.pathEdgeIds?.includes(e.id));
    return `<g><path class="edge-line ${e.confidence!=='observed'?'inferred':''} ${focus?'focus':S.selected.length?'dim':''} ${impact?.level||''}" d="${d}" marker-end="url(#arrow)"/>${S.labels||S.edge===e.id?`<text class="edge-label" x="${(x1+x2)/2}" y="${(y1+y2)/2-8}">${esc(e.label||relations[e.relation])}</text>`:''}<path class="edge-hit" data-edge="${esc(e.id)}" d="${d}" tabindex="0" role="button" aria-label="${esc(byId(e.source)?.label)} → ${esc(byId(e.target)?.label)}: ${esc(e.label||relations[e.relation])}"/></g>`;
  }).join('');
  $('.minimap').innerHTML=`<svg viewBox="0 0 ${extent.w} ${extent.h}" aria-hidden="true">${edges.map(e=>`<line x1="${positions[e.source].x+88}" y1="${positions[e.source].y+34}" x2="${positions[e.target].x+88}" y2="${positions[e.target].y+34}" stroke="#dfe5f0" stroke-width="4"/>`).join('')}${nodes.map(n=>`<rect x="${positions[n.id].x}" y="${positions[n.id].y}" width="176" height="68" rx="12" fill="${S.selected.includes(n.id)?'#e7efff':'#f0f3f8'}" stroke="${S.selected.includes(n.id)?'#4380ff':'#e0e6ef'}" stroke-width="5"/>`).join('')}</svg>`;
  bindNodes();svg.querySelectorAll('[data-edge]').forEach(el=>{const select=()=>{S.edge=el.dataset.edge;S.tab='evidence';S.panelClosed=false;renderDetails();drawGraph();};el.onclick=select;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};});
  const canvas=$('.canvas');canvas.onpointerdown=e=>{if(e.button!==0||e.target.closest('button')||e.target.closest('[data-edge]'))return;drag={x:e.clientX,y:e.clientY,baseX:S.x,baseY:S.y,id:e.pointerId};canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag)return;S.x=drag.baseX+e.clientX-drag.x;S.y=drag.baseY+e.clientY-drag.y;transform();};
  canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
  canvas.onwheel=e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();zoom(e.deltaY<0?1.1:1/1.1,e.clientX-rect.left,e.clientY-rect.top);};
  document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>b.dataset.zoom==='fit'?fit():zoom(b.dataset.zoom==='in'?1.2:1/1.2));$('.minimap').onclick=fit;transform();
}
function bindNodes(){document.querySelectorAll('[data-node]').forEach(b=>b.onclick=e=>selectNode(b.dataset.node,e.shiftKey));}
function transform(){if($('.world'))$('.world').style.transform=`translate(${S.x}px, ${S.y}px) scale(${S.zoom})`;}
function fit(){const canvas=$('.canvas');if(!canvas)return;const {nodes,positions}=graphData();if(!nodes.length)return;const minX=Math.min(...nodes.map(n=>positions[n.id].x)),minY=Math.min(...nodes.map(n=>positions[n.id].y));const maxX=Math.max(...nodes.map(n=>positions[n.id].x+176)),maxY=Math.max(...nodes.map(n=>positions[n.id].y+68));const w=canvas.clientWidth,h=canvas.clientHeight;
  S.zoom=Math.max(.22,Math.min(1.13,(w-80)/(maxX-minX+20),(h-90)/(maxY-minY+20)));S.x=(w-(maxX-minX)*S.zoom)/2-minX*S.zoom;S.y=(h-30-(maxY-minY)*S.zoom)/2-minY*S.zoom;transform();}
function zoom(factor,cx,cy){const canvas=$('.canvas');if(!canvas)return;cx??=canvas.clientWidth/2;cy??=canvas.clientHeight/2;const next=Math.max(.15,Math.min(2.4,S.zoom*factor));S.x=cx-(cx-S.x)*next/S.zoom;S.y=cy-(cy-S.y)*next/S.zoom;S.zoom=next;transform();}
function selectNode(id,multiple=false){S.edge=null;S.panelClosed=false;S.tab='overview';if(multiple){S.selected=S.selected.includes(id)?S.selected.filter(x=>x!==id):[...S.selected,id].slice(-20);}else S.selected=[id];renderDetails();drawGraph();persistSelection('question');}
function persistSelection(intent){const number=++requestSequence,payload={session,nodeIds:[...S.selected],graphRevision:S.g.revision,viewId:S.g.views.some(v=>v.id===S.view)?S.view:null,intent};S.pending=true;renderDetails();
  selectionQueue=selectionQueue.catch(()=>{}).then(async()=>{
    try{const response=await api('/api/selection',{method:'POST',body:payload});if(number!==requestSequence)return;const wasStale=S.selection?.stale||S.error;S.selection={...response.data,stale:false};S.pending=false;S.error=null;if(wasStale)renderMain();renderDetails();}
    catch(e){if(number!==requestSequence)return;S.pending=false;S.error=e.status===409?'지도가 바뀌었습니다. 새로 읽은 뒤 대상을 다시 선택하세요.':`선택 저장 실패: ${e.message}`;toast(S.error);renderDetails();if(e.status===409)await poll(true);}
  });return selectionQueue;
}
function platformBadges(n){return (n.platforms||[]).map(p=>badge(({web:'웹',mobile:'모바일',ios:'iOS',android:'안드로이드',server:'서버',cli:'명령줄'}[p]||p),p==='web'?'web':p==='mobile'?'mobile':'',p==='web'?'monitor':p==='mobile'?'phone':'')).join('');}
function evidenceHTML(ids){if(!ids?.length)return '<p class="mini-caption">아직 근거가 게시되지 않았습니다. 에이전트에게 근거 확인을 요청하세요.</p>';return ids.map(id=>{const e=S.g.evidence.find(x=>x.id===id);return e?`<article class="evidence-card">${badge(evidenceKinds[e.kind],e.kind==='inference'?'inferred':'observed')}<p>${esc(e.summary)}</p>${e.locator?`<div class="code-ref">${esc(e.locator)}</div>`:''}${e.at?`<p class="mini-caption">${esc(e.at)}</p>`:''}</article>`:'';}).join('');}
function connections(n){return S.g.edges.filter(e=>e.source===n.id||e.target===n.id);}
function connectionRow(e,n){const outbound=e.source===n.id,target=byId(outbound?e.target:e.source);return `<button class="detail-row" data-related="${esc(target.id)}">${nodeIcon(target)}<span class="row-label">${esc(target.label)}<span class="mini-caption" style="display:block">${outbound?'→':'←'} ${esc(e.label||relations[e.relation])}${e.condition?' · '+esc(e.condition):''}</span></span>${badge(kinds[target.kind])}${icon('chevron','chevron')}</button>`;}
function previewHTML(n){if(n.preview)return `<div class="preview"><img data-asset="${esc(n.preview)}" alt="${esc(n.label)} · 에이전트가 등록한 화면 캡처"><div class="preview-caption">에이전트가 등록한 캡처 · 현재 실행 화면과 다를 수 있습니다.</div></div>`;
  if(!S.g.project.demo||n.kind!=='surface')return '';
  return `<div class="preview"><div class="mock-store"><div class="mock-header"><span>☰ &nbsp; ATLAS STORE</span><span>◦ &nbsp; ◦</span></div><div class="mock-body"><div class="mock-nav">${[90,65,80,60,75].map(w=>`<div class="mock-line" style="width:${w}%"></div>`).join('')}</div><div class="mock-products">${['bag','box','heart'].map((i,k)=>`<div class="mock-product"><div class="mock-object">${icon(i)}</div><span></span><span style="width:45%"></span><small>${['₩ 39,000','₩ 24,000','₩ 18,000'][k]}</small></div>`).join('')}</div></div></div><div class="preview-caption">설명용 미리보기 · 실제 앱 캡처가 아닙니다.</div></div>`;
}
function renderDetails(){const panel=$('.details');if(!panel)return;const n=byId(S.selected[0]),edge=S.g.edges.find(e=>e.id===S.edge);$('.content').classList.toggle('full-details-hidden',S.panelClosed);
  if(edge){panel.classList.remove('empty');panel.innerHTML=`<div class="detail-scroll"><div class="detail-heading"><span class="node-ico">${icon('link')}</span><div><h2 class="detail-title">연결 근거</h2><span class="detail-path">${esc(relations[edge.relation])}</span></div><button class="icon-button" data-close aria-label="상세 닫기">${icon('close')}</button></div><p class="description">${esc(byId(edge.source)?.label)} → ${esc(byId(edge.target)?.label)}</p>${badge(confidence[edge.confidence],edge.confidence)}${edge.condition?`<div class="reason">조건: ${esc(edge.condition)}</div>`:''}<div class="detail-section">${evidenceHTML(edge.evidenceIds)}</div><p class="mini-caption">연결이 있다는 사실과, 특정 변경이 오류를 일으킨다는 판단은 다릅니다.</p></div>`;bindPanel();return;}
  if(!n){panel.classList.add('empty');panel.innerHTML=`<div class="empty-panel">${icon('map')}<h2>이해하고 싶은 곳을 선택하세요</h2><p>화면과 기능의 연결을 살펴보고,<br>기존 에이전트 대화창에서 질문하세요.</p><p class="mini-caption">지도가 질문의 대상을 전달합니다.<br>별도의 채팅이나 모델 호출은 없습니다.</p></div>`;return;}
  panel.classList.remove('empty');const links=connections(n),report=getReport(),affected=S.mode==='impact'?report?.affected.find(a=>a.nodeId===n.id):null;
  const featureEdges=links.filter(e=>e.source===n.id&&['contains','triggers'].includes(e.relation));const features=[...new Map(featureEdges.map(e=>[e.target,e])).values()];
  let body='';
  if(S.tab==='overview'){
    if(affected)body+=`<div class="reason">${badge(levels[affected.level],affected.level)}<br>${esc(affected.reason)}</div>`;
    body+=previewHTML(n);
    if(n.conditions?.length)body+=`<section class="detail-section"><h3 class="section-heading">동작 조건</h3>${n.conditions.map(c=>`<div class="mini-caption" style="margin:7px 0">${icon('info')} ${esc(c)}</div>`).join('')}</section>`;
    if(features.length)body+=`<section class="detail-section"><h3 class="section-heading">주요 기능 <span class="num">${features.length}개</span></h3>${features.slice(0,5).map(e=>{const f=byId(e.target);return `<button class="detail-row compact" data-related="${esc(f.id)}">${icon(iconFor(f))}<span>${esc(f.label)}</span>${icon('chevron')}</button>`;}).join('')}${features.length>5?'<button class="btn small" data-tab="connections">모든 기능 보기</button>':''}</section>`;
    body+=`<section class="detail-section"><h3 class="section-heading">연결된 주요 요소 <span class="num">${links.length}개</span></h3>${links.filter(e=>!featureEdges.includes(e)).sort((a,b)=>{const rank=e=>['interface','service','data'].indexOf(byId(e.source===n.id?e.target:e.source)?.kind);return (rank(a)<0?9:rank(a))-(rank(b)<0?9:rank(b));}).slice(0,4).map(e=>connectionRow(e,n)).join('')||'<p class="mini-caption">추가 연결이 아직 기록되지 않았습니다.</p>'}</section>`;
    if(n.path)body+=`<section class="detail-section"><h3 class="section-heading">구현 위치·진입 경로</h3><div class="code-ref">${esc(n.path)}</div></section>`;
    if(affected?.pathEdgeIds?.length)body+=`<section class="detail-section"><h3 class="section-heading">영향 전달 경로</h3>${affected.pathEdgeIds.map(id=>{const e=S.g.edges.find(e=>e.id===id);return `<button class="detail-row" data-show-edge="${esc(id)}">${icon('link')}<span>${esc(byId(e.source)?.label)} → ${esc(byId(e.target)?.label)}</span></button>`;}).join('')}</section>`;
  }
  if(S.tab==='connections')body=`<div class="list-header">선택 항목 기준 · → 나가는 연결 · ← 들어오는 연결</div>${links.map(e=>connectionRow(e,n)).join('')||'<p class="mini-caption">게시된 연결이 없습니다.</p>'}`;
  if(S.tab==='evidence')body=evidenceHTML([...new Set([...n.evidenceIds,...(affected?.evidenceIds||[])])]);
  if(S.tab==='changes'){const reports=S.g.reports.filter(r=>r.targetIds.includes(n.id)||r.affected.some(a=>a.nodeId===n.id));body=reports.map(r=>reportHTML(r,true)).join('')||'<p class="mini-caption">이 항목의 변경 기록이 아직 없습니다.</p>';}
  panel.innerHTML=`<div class="detail-scroll"><div class="detail-heading">${nodeIcon(n)}<div><h2 class="detail-title">${S.selected.length>1?`${S.selected.length}개 항목 선택`:esc(n.label)}</h2><span class="detail-path">${esc(n.path||n.id)}</span></div><button class="icon-button" data-close aria-label="상세 닫기">${icon('close')}</button></div><p class="description">${esc(n.description||'설명이 아직 게시되지 않았습니다.')}</p>${S.selected.length>1?`<div class="mini-caption">${S.selected.map(id=>esc(byId(id)?.label)).join(' · ')}</div>`:''}<div class="badges">${platformBadges(n)}${badge(confidence[n.confidence],n.confidence)}</div><nav class="detail-tabs" aria-label="상세 정보">${[['overview','개요'],['connections','연결'],['evidence','근거'],['changes','변경']].map(([id,l])=>`<button data-tab="${id}" class="${S.tab===id?'active':''}">${l}${id==='connections'?badge(links.length):''}</button>`).join('')}</nav>${S.selection?.stale?'<div class="warning-text">이 선택은 이전 리비전 기준입니다. 지도의 항목을 다시 눌러 최신 기준으로 선택하세요.</div>':''}${body}</div><div class="detail-footer"><p class="selection-note">${icon(S.pending?'clock':S.error?'warning':'circlecheck')}${S.pending?'선택 저장 중…':S.error?'선택 저장 상태를 확인하세요.':`세션 ${esc(session)} · 다음 질문에서 에이전트가 읽습니다.`}</p><div class="detail-actions"><button class="btn primary" id="ask-agent">${icon('message')}대화창에서 질문하기</button><button class="btn" id="ask-impact">${icon('branch')}영향 분석</button></div></div>`;
  bindPanel();hydrateImages();
}
function bindPanel(){document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;renderDetails();});document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{S.panelClosed=true;$('.content').classList.add('full-details-hidden');requestAnimationFrame(fit);});
  document.querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>{const id=b.dataset.related;if(!graphData().nodes.some(n=>n.id===id)){S.mode='map';S.category='all';S.filter=id;renderShell();renderMain();}selectNode(id);fit();});
  document.querySelectorAll('[data-show-edge]').forEach(b=>b.onclick=()=>{S.edge=b.dataset.showEdge;renderDetails();drawGraph();});
  if($('#ask-agent'))$('#ask-agent').onclick=async()=>{await persistSelection('question');if(!S.error)toast('선택이 저장되었습니다. 기존 에이전트 대화창에서 질문하세요.');};
  if($('#ask-impact'))$('#ask-impact').onclick=async()=>{await persistSelection('impact');if(!S.error)toast('선택과 분석 의도가 저장되었습니다. 기존 대화창에서 어떤 변경을 원하는지 설명하세요.');};
}
async function hydrateImages(){for(const url of assetURLs)URL.revokeObjectURL(url);assetURLs=[];
  for(const img of document.querySelectorAll('[data-asset]')){try{const r=await fetch('/assets/'+encodeURIComponent(img.dataset.asset),{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error();const u=URL.createObjectURL(await r.blob());assetURLs.push(u);if(img.isConnected)img.src=u;}catch{if(img.isConnected){img.alt='등록된 캡처를 찾을 수 없습니다.';img.style.minHeight='70px';}}}
}
function reportHTML(r,compact=false){return `<article class="report-card"><div class="badges">${badge(({impact:'영향 분석',performance:'성능 분석',change:'변경 결과'}[r.kind]))}${badge(reportStatuses[r.status])}${badge(`기준 r${r.baseRevision}`)}</div><h2>${esc(r.title)}</h2><p>${esc(r.summary)}</p>${(r.metrics||[]).map(m=>`<div class="metric"><div class="section-heading">${esc(m.label)}${badge(m.kind==='measured'?'실측':'추정',m.kind)}</div><div class="metric-values"><span class="before">${m.before===null?'미측정':esc(m.before)}</span>${icon('arrow')}<span>${m.after===null?'미측정':esc(m.after)}</span><small>${esc(m.unit)}</small></div><div class="conditions">${esc(m.conditions)}</div>${S.g.project.demo?'<div class="mini-caption">예시 값 · 실제 성능 보장 아님</div>':''}</div>`).join('')}${r.tests?.length?`<section class="detail-section"><h3 class="section-heading">검증 기록</h3>${r.tests.map(t=>`<div class="test-row"><span>${esc(t.name)}</span>${badge(({passed:'통과',failed:'실패','not-run':'미실행'}[t.status]),t.status)}</div>`).join('')}</section>`:''}${!compact?`<p class="mini-caption">${r.affected.length}개 영향 후보 · 명시되지 않은 영역의 안전성을 뜻하지 않습니다.</p>`:''}</article>`;}
function changesHTML(){const reports=S.g.reports.filter(r=>r.kind==='change'||r.kind==='performance');return `<div class="scrollpage">${reports.length?reports.map(r=>reportHTML(r)).join(''):'<article class="report-card"><h2>아직 게시된 변경 결과가 없습니다</h2><p>에이전트가 코드를 수정한 후 결과를 게시하면 검증 내용과 함께 표시합니다.</p></article>'}<section class="report-card"><h2>지도 리비전</h2><p>이 비교는 지도 데이터의 차이입니다. Git 커밋이나 코드의 의미적 영향 분석과는 다릅니다.</p><div class="history-row"><span>현재 지도</span>${badge('r'+S.g.revision,'web')}</div>${S.history.slice(0,20).map(h=>`<div class="history-row"><span>리비전 ${h.revision}</span><button class="btn small" data-diff="${h.revision}">현재 지도와 비교</button></div>`).join('')}${S.diff?`<div class="diff-list">${esc(S.diff)}</div>`:''}<p class="mini-caption">이전 스냅샷은 .codeatlas/history에 보존됩니다.</p></section></div>`;}
async function loadHistory(){try{S.history=(await api('/api/history')).data;if(S.mode==='changes')renderMain();}catch(e){toast(e.message);}}
function bindHistory(){document.querySelectorAll('[data-diff]').forEach(b=>b.onclick=async()=>{try{const old=(await api('/api/history?revision='+b.dataset.diff)).data;const lines=[];for(const key of ['nodes','edges','reports']){const a=new Map(old[key].map(x=>[x.id,x])),b=new Map(S.g[key].map(x=>[x.id,x]));const added=[...b.keys()].filter(id=>!a.has(id)),removed=[...a.keys()].filter(id=>!b.has(id)),changed=[...b.keys()].filter(id=>a.has(id)&&JSON.stringify(a.get(id))!==JSON.stringify(b.get(id)));lines.push(`${({nodes:'항목',edges:'연결',reports:'분석 결과'}[key])} · 추가 ${added.length} / 수정 ${changed.length} / 삭제 ${removed.length}`, ...added.map(id=>`+ ${b.get(id).label||b.get(id).title||id}`),...changed.map(id=>`~ ${b.get(id).label||b.get(id).title||id}`),...removed.map(id=>`− ${a.get(id).label||a.get(id).title||id}`),'');}S.diff=lines.join('\n');renderMain();}catch(e){toast(e.message);}});}
function settingsHTML(){return `<div class="scrollpage"><section class="settings-card"><h2>표현 설정</h2><label class="setting-row"><span>연결선에 관계 이름 표시</span><input type="checkbox" id="labels-setting" ${S.labels?'checked':''}></label><label class="setting-row"><span>접근성 목록 보기 사용</span><input type="checkbox" id="list-setting" ${S.list?'checked':''}></label><p>정보는 숨길 수 있지만, 추정·미확인 상태를 확인 완료로 바꾸지는 않습니다.</p></section><section class="settings-card"><h2>에이전트와 연결</h2><div class="setting-row"><span>현재 세션</span>${badge(session,'web')}</div><div class="setting-row"><span>다른 세션으로 이동</span><input id="session-setting" type="text" aria-label="새 세션 이름" placeholder="claude-main"></div><button class="btn small" id="change-session">세션 열기</button><p>같은 프로젝트에서 여러 에이전트를 사용할 때 각 대화에 서로 다른 세션 ID를 지정하세요.</p><div class="code-ref">node .codeatlas/runtime/bin/codeatlas.mjs context --session ${esc(session)}</div><p class="mini-caption">화면 선택은 대화에 자동 메시지를 보내지 않습니다. 에이전트가 지침에 따라 선택 파일을 읽어야 합니다.</p></section><section class="settings-card"><h2>분석 범위</h2><p>${esc(S.g.analysis.summary)}</p>${[['examined','확인한 범위'],['excluded','제외한 범위'],['unknown','미확인 범위']].map(([key,l])=>`<div class="detail-section"><h3 class="section-heading">${l}</h3><p>${(S.g.analysis.coverage?.[key]||[]).map(esc).join('<br>')||'기록 없음'}</p></div>`).join('')}<p class="mini-caption">스킬이 설치되었다고 특정 실행 환경이나 검증 능력이 자동으로 생기지는 않습니다.</p></section><section class="settings-card"><h2>로컬 데이터</h2><p>CodeAtlas는 외부 모델·분석 서버에 데이터를 전송하지 않습니다. 사용 중인 에이전트의 데이터 처리는 해당 도구의 정책을 따릅니다.</p><button class="btn" id="export">${icon('download')}지도 JSON 내보내기</button><p class="mini-caption">접근 키·코드 원문은 내보내기에 자동 포함되지 않습니다. 에이전트가 기록한 근거에 민감 정보가 없는지 확인하세요.</p></section></div>`;}
function bindSettings(){if($('#labels-setting'))$('#labels-setting').onchange=e=>{S.labels=e.target.checked;S.preferences.labels=S.labels;savePrefs();};if($('#list-setting'))$('#list-setting').onchange=e=>{S.list=e.target.checked;S.preferences.list=S.list;savePrefs();};if($('#change-session'))$('#change-session').onclick=()=>{const id=$('#session-setting').value.trim();if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(id)){toast('세션명은 영문·숫자·점·밑줄·하이픈으로 입력하세요.');return;}location.href='/?session='+encodeURIComponent(id);};if($('#export'))$('#export').onclick=()=>download(`${S.g.project.id}-r${S.g.revision}.json`,JSON.stringify(S.g,null,2));}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function saveView(){const v=getView();if(!v)return;S.preferences.bookmarks??=[];S.preferences.bookmarks.push({id:(crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('')),label:v.label,viewId:v.id,selected:[...S.selected],x:S.x,y:S.y,zoom:S.zoom,at:new Date().toISOString()});savePrefs();toast('현재 보기를 이 브라우저에 저장했습니다.');renderShell();renderMain();renderDetails();}
function bookmarksHTML(){return `<div class="scrollpage"><section class="report-card"><h2>자주 확인하는 지도</h2>${S.preferences.bookmarks?.length?S.preferences.bookmarks.map(v=>`<div class="bookmark-row"><button data-bookmark="${esc(v.id)}">${esc(v.label)}<small>${esc(v.at.slice(0,16).replace('T',' '))}</small></button><button class="icon-button" data-remove-bookmark="${esc(v.id)}" aria-label="${esc(v.label)} 저장한 보기 삭제">${icon('close')}</button></div>`).join(''):'<p>지도 상단의 북마크 버튼으로 현재 보기를 저장하세요.</p>'}</section></div>`;}
function bindBookmarks(){document.querySelectorAll('[data-bookmark]').forEach(b=>b.onclick=()=>{const v=S.preferences.bookmarks.find(x=>x.id===b.dataset.bookmark);if(!S.g.views.some(x=>x.id===v.viewId)){toast('이 보기는 현재 지도에 없습니다.');return;}S.view=v.viewId;S.mode='map';S.category='all';S.filter=null;S.selected=v.selected.filter(id=>byId(id));S.x=v.x;S.y=v.y;S.zoom=v.zoom;S.panelClosed=false;renderShell();renderMain();renderDetails();persistSelection('question');});document.querySelectorAll('[data-remove-bookmark]').forEach(b=>b.onclick=()=>{S.preferences.bookmarks=S.preferences.bookmarks.filter(x=>x.id!==b.dataset.removeBookmark);savePrefs();renderShell();renderMain();renderDetails();});}
async function poll(manual=false){clearTimeout(pollTimer);try{if(!document.hidden||manual){const r=await api('/api/graph',{etag:manual?null:S.etag});if(!r.unchanged){const before=S.g;S.g=r.data;S.etag=r.etag;S.selection=(await api('/api/selection?session='+encodeURIComponent(session))).data;if(before?.revision!==S.g.revision){S.changed=new Set(S.g.nodes.filter(n=>JSON.stringify(n)!==JSON.stringify(before?.nodes.find(x=>x.id===n.id))).map(n=>n.id));S.selected=S.selected.filter(id=>byId(id));if(!S.g.views.some(v=>v.id===S.view))S.view=S.g.views[0]?.id;S.error=null;renderShell();renderMain();renderDetails();if(!before?.nodes.length)fit();toast(`에이전트가 게시한 새 지도를 반영했습니다. 리비전 ${S.g.revision}`);}else if(manual)toast('게시된 최신 지도를 확인했습니다. 코드 재분석은 에이전트에게 요청하세요.');}
      S.offline=false;$('#connection-label')&&( $('#connection-label').textContent='로컬 화면 연결됨');$('.agent-card')?.classList.remove('offline');}
  }catch(e){S.offline=true;if($('#connection-label'))$('#connection-label').textContent=e.status===401?'접근 키 만료 · 새 URL 필요':'서버 연결 끊김';$('.agent-card')?.classList.add('offline');if(manual)toast('서버 연결을 확인하고 에이전트가 출력한 URL로 다시 접속하세요.');}
  finally{pollTimer=setTimeout(()=>poll(),S.offline?5000:1500);}
}
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search')?.focus();}if(e.key==='Escape'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){if($('#search-results'))$('#search-results').innerHTML='';S.panelClosed=true;$('.content')?.classList.add('full-details-hidden');fit();}});
window.addEventListener('resize',()=>{clearTimeout(window._atlasResize);window._atlasResize=setTimeout(fit,120);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.g)poll();});
boot();
