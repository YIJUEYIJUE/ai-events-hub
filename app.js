(function(){
  "use strict";
  const DATA = window.EVENT_DATA || {meta:{},items:[]};
  const items = DATA.items || [];
  const COLORS = {'AI赛事':'#173fe8','AI电影节':'#e96450','AI设计类':'#1f9e8f'};
  const COLS = ['AI赛事','AI电影节','AI设计类'];
  const STATUSES = ['进行中','已截止','待公布'];
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function colColor(c){return COLORS[c]||'#888';}
  function regionText(arr){return (arr||[]).join(' · ');}
  function truncate(s,n){s=String(s||'');return s.length>n?s.slice(0,n)+'…':s;}
  function nowTs(){return Date.now();}

  const state = {collection:'ALL', q:'', status:new Set(), type:new Set(), region:new Set(), sort:'deadline', typeOpen:false, regionOpen:false};

  // ---------- hero stats ----------
  function buildStats(){
    const byColl = {};
    items.forEach(it=>{byColl[it.collection]=(byColl[it.collection]||0)+1;});
    const openNow = items.filter(i=>i.status==='进行中').length;
    const withSite = items.filter(i=>i.website).length;
    const cards = [
      {b:items.length, s:'赛事总数 EVENTS', c:null},
      {b:COLS.length, s:'大类 CATEGORIES', c:null},
      {b:openNow, s:'进行中 OPEN', c:'#2e7d32'},
      {b:withSite, s:'附官网 LINKED', c:'#173fe8'},
    ];
    $('#stats').innerHTML = cards.map(x=>{
      const dot = x.c?`<span class="accent" style="background:${x.c}"></span>`:'';
      return `<div class="stat"><b>${dot}${x.b}</b><span>${x.s}</span></div>`;
    }).join('');
  }

  // ---------- tabs ----------
  function buildTabs(){
    const counts = {ALL:items.length};
    COLS.forEach(c=>counts[c]=items.filter(i=>i.collection===c).length);
    const tabs = [{k:'ALL',label:'全部赛事',c:null}].concat(COLS.map(c=>({k:c,label:c,c:colColor(c)})));
    $('#tabs').innerHTML = tabs.map(t=>`<button class="tab ${state.collection===t.k?'active':''}" data-col="${t.k}">${t.c?`<span class="bar" style="background:${t.c}"></span>`:''}${esc(t.label)}<span class="n">${counts[t.k]}</span></button>`).join('');
  }

  // ---------- filters ----------
  function basePool(){
    return state.collection==='ALL' ? items : items.filter(i=>i.collection===state.collection);
  }
  function buildFilters(){
    const pool = basePool();
    // status
    $('#fStatus').innerHTML = STATUSES.map(s=>{
      const n = pool.filter(i=>i.status===s).length;
      if(!n) return '';
      return `<button class="fchip ${state.status.has(s)?'active':''}" data-facet="status" data-val="${esc(s)}"><span><span class="swatch" style="background:${s==='进行中'?'#2e7d32':s==='已截止'?'#9b9384':'#b07400'}"></span>${esc(s)}</span><span class="cnt">${n}</span></button>`;
    }).join('');
    // type
    const typeCount = {};
    pool.forEach(i=>{if(i.type)typeCount[i.type]=(typeCount[i.type]||0)+1;});
    const types = Object.keys(typeCount).sort((a,b)=>typeCount[b]-typeCount[a]);
    renderChips('#fType','type',types,typeCount,state.typeOpen,'#moreType');
    // region
    const regCount = {};
    pool.forEach(i=>(i.region||[]).forEach(r=>{regCount[r]=(regCount[r]||0)+1;}));
    const regs = Object.keys(regCount).sort((a,b)=>regCount[b]-regCount[a]);
    renderChips('#fRegion','region',regs,regCount,state.regionOpen,'#moreRegion');
    // clear button
    const anyF = state.status.size||state.type.size||state.region.size;
    $('#clearBtn').hidden = !anyF;
  }
  function renderChips(sel,facet,keys,countMap,open,moreSel){
    const el = $(sel);
    const show = open ? keys : keys.slice(0,16);
    el.innerHTML = show.map(k=>`<button class="fchip ${state[facet].has(k)?'active':''}" data-facet="${facet}" data-val="${esc(k)}">${esc(k)}<span class="cnt">${countMap[k]}</span></button>`).join('');
    el.classList.toggle('collapsed', !open && keys.length>16);
    $(moreSel).hidden = keys.length<=16;
    $(moreSel).textContent = open ? '收起 ▴' : `更多 ${keys.length-16} ▾`;
  }

  // ---------- filter match ----------
  function matches(it){
    if(state.collection!=='ALL' && it.collection!==state.collection) return false;
    if(state.status.size && !state.status.has(it.status)) return false;
    if(state.type.size && !state.type.has(it.type)) return false;
    if(state.region.size && !(it.region||[]).some(r=>state.region.has(r))) return false;
    const q = state.q.trim().toLowerCase();
    if(q){
      const hay = [it.name,it.type,regionText(it.region),it.desc,it.award,it.entry,it.nextTime,it.website,it.countdown].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }

  // ---------- sort ----------
  function sortList(list){
    const n = nowTs();
    if(state.sort==='name'){
      return list.slice().sort((a,b)=>a.name.localeCompare(b.name,'zh'));
    }
    if(state.sort==='recent'){
      return list.slice().sort((a,b)=>String(b.id).localeCompare(String(a.id))); // record_id desc ~ newer
    }
    // deadline: upcoming first (soonest), then past (most recent), then none
    const key = it=>{
      const d = it.deadline ? Date.parse(it.deadline+'T00:00:00') : NaN;
      if(isNaN(d)) return {g:2, v:0};
      return d>=n ? {g:0, v:d} : {g:1, v:-d};
    };
    return list.slice().sort((a,b)=>{const ka=key(a),kb=key(b);return ka.g-kb.g || ka.v-kb.v;});
  }

  // ---------- highlight: 每张卡最重要的「奖金 / 能得到什么」 ----------
  function highlight(it){
    if(it.award && it.award.trim()) return {ico:'🏆', cls:'hl-award', text:'奖金 | 奖项：'+it.award.trim()};
    if(it.nextTime && it.nextTime.trim()) return {ico:'🗓️', cls:'hl-next', text:'明年预期：'+it.nextTime.trim()};
    if(it.entry && it.entry.trim()) return {ico:'🎟️', cls:'hl-entry', text:'参赛资格：'+it.entry.trim()};
    return {ico:'🔗', cls:'hl-link', text:'奖项与详情见官网'};
  }

  // ---------- grid ----------
  function renderGrid(){
    let list = items.filter(matches);
    list = sortList(list);
    $('#listTitle').textContent = state.collection==='ALL' ? '全部赛事' : state.collection;
    const act = [];
    if(state.status.size) act.push([...state.status].join('/'));
    if(state.type.size) act.push([...state.type].join('/'));
    if(state.region.size) act.push([...state.region].join('/'));
    $('#listSub').textContent = `${list.length} 条结果` + (act.length?` · 筛选：${act.join(' · ')}`:'') + (state.q?` · 搜索「${state.q}」`:'');
    const grid = $('#grid'), empty = $('#empty');
    if(!list.length){ grid.innerHTML=''; empty.hidden=false; return; }
    empty.hidden=true;
    grid.innerHTML = list.map(it=>{
      const color = colColor(it.collection);
      const rtext = truncate(regionText(it.region), 20);
      const web = it.website ? `<a href="${esc(it.website)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">官网 ↗</a>` : `<span style="color:var(--ink3);font-family:var(--mono);font-size:11px">无链接</span>`;
      const hl = highlight(it);
      const fullAward = it.award && it.award.trim() ? it.award.trim() : '';
      return `<button class="card" data-id="${esc(it.id)}" title="${esc(fullAward)}">
        <span class="bar" style="background:${color}"></span>
        <div class="cardTop">
          <span class="col" style="background:${color}">${esc(it.collection)}</span>
          <span class="badge s-${it.status}">${esc(it.countdown||it.status)}</span>
        </div>
        <h3>${esc(it.name)}</h3>
        <div class="meta">
          ${it.type?`<span class="t">${esc(it.type)}</span>`:''}
          ${rtext?`<span class="r">📍 ${esc(rtext)}</span>`:''}
        </div>
        <div class="hl ${hl.cls}"><span class="hlIco">${hl.ico}</span><span class="hlTxt">${esc(hl.text)}</span></div>
        <div class="cardFoot">
          <span class="dl">${it.deadline?('📅 '+esc(it.deadline)):(it.nextTime?('🗓️ '+esc(truncate(it.nextTime,14))):'—')}</span>
          ${web}
        </div>
      </button>`;
    }).join('');
  }

  function refresh(){buildFilters();renderGrid();}

  // ---------- modal ----------
  function detail(id){
    const it = items.find(x=>x.id===id);
    if(!it) return;
    $('#mKicker').textContent = `${esc(it.collection)} · ${esc(it.status)}`;
    $('#mTitle').textContent = it.name;
    const tags = [];
    if(it.type) tags.push(`<span class="tag">${esc(it.type)}</span>`);
    (it.region||[]).slice(0,4).forEach(r=>tags.push(`<span class="tag mint">${esc(r)}</span>`));
    if(it.countdown) tags.push(`<span class="tag coral">${esc(it.countdown)}</span>`);
    $('#mTags').innerHTML = tags.join('');
    const specs = [];
    specs.push(['截止日期 Deadline', it.deadline||'—']);
    specs.push(['状态 Status', it.status]);
    specs.push(['奖金 | 奖项 Award', it.award||'—']);
    if(it.nextTime) specs.push(['明年预期 Next', it.nextTime]);
    if(it.entry) specs.push(['参赛资格 Entry', it.entry]);
    specs.push(['地区 Region', regionText(it.region)||'—']);
    $('#mSpecs').innerHTML = specs.map(([k,v])=>`<div class="spec ${k.startsWith('奖金')||k.startsWith('明年')||k.startsWith('参赛')?'full':''}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    const link = $('#mLink');
    if(it.website){link.href = it.website; link.style.display='inline-flex';}
    else {link.style.display='none';}
    const dw = $('#mDescWrap');
    if(it.desc){dw.style.display='block'; $('#mDesc').textContent = it.desc;}
    else dw.style.display='none';
    $('#modal').classList.add('show');
  }
  function closeDetail(){$('#modal').classList.remove('show');}

  // ---------- canvas (showcase, ALL items) ----------
  const canvas=$('#canvas'),viewport=$('#viewport'),plane=$('#plane');
  let pan={x:0,y:0,s:1},drag=false,moved=false,start={x:0,y:0},startPan={x:0,y:0},paused=false,canvasBuilt=false;
  function renderCanvas(){
    const pool = items.filter(matches);
    const animate = pool.length<=260;
    const rings=[300,560,840,1120,1420];
    const html = pool.map((a,i)=>{
      const ang=i*137.508*Math.PI/180, ring=rings[i%rings.length];
      const x=Math.cos(ang)*ring+((i%7)-3)*70, y=Math.sin(ang)*ring+((i%9)-4)*54;
      const r=((i*31)%40)-20, dur=6+(i%8)*.55, delay=-((i%13)*.36);
      return `<button class="canvasItem ${animate?'animate':''}" data-id="${esc(a.id)}" style="--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;--r:${r}deg;--dur:${dur}s;--delay:${delay}s"><div class="canvasInner"><span class="col" style="background:${colColor(a.collection)}">${esc(a.collection)}</span><h4>${esc(truncate(a.name,22))}</h4></div></button>`;
    }).join('');
    plane.innerHTML = `<div class="axis h"></div><div class="axis v"></div>`+html;
    canvasBuilt=true;
  }
  function apply(){plane.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${pan.s})`;}
  function openCanvas(){renderCanvas();canvas.classList.add('show');apply();}
  function closeCanvas(){canvas.classList.remove('show');}
  function reset(){pan={x:0,y:0,s:1};apply();}

  viewport.addEventListener('pointerdown',e=>{drag=true;moved=false;start={x:e.clientX,y:e.clientY};startPan={...pan};viewport.classList.add('dragging');viewport.setPointerCapture(e.pointerId);});
  viewport.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;pan.x=startPan.x+dx;pan.y=startPan.y+dy;apply();});
  viewport.addEventListener('pointerup',()=>{setTimeout(()=>{drag=false;viewport.classList.remove('dragging');},0);});
  viewport.addEventListener('wheel',e=>{e.preventDefault();pan.s=Math.max(.30,Math.min(2.4,pan.s*(e.deltaY>0?.92:1.08)));apply();},{passive:false});

  // ---------- events ----------
  $('#search').addEventListener('input',e=>{state.q=e.target.value;renderGrid();});
  $('#sort').addEventListener('change',e=>{state.sort=e.target.value;renderGrid();});
  $('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;state.collection=b.dataset.col;$$('.tab').forEach(x=>x.classList.toggle('active',x===b));refresh();});
  document.querySelector('.filterbar').addEventListener('click',e=>{
    const b=e.target.closest('.fchip');
    if(b){const f=b.dataset.facet,v=b.dataset.val;const set=state[f];if(set.has(v))set.delete(v);else set.add(v);b.classList.toggle('active');renderGrid();buildFilters();return;}
    if(e.target.id==='moreType'){state.typeOpen=!state.typeOpen;buildFilters();return;}
    if(e.target.id==='moreRegion'){state.regionOpen=!state.regionOpen;buildFilters();return;}
    if(e.target.id==='clearBtn'){state.status.clear();state.type.clear();state.region.clear();refresh();return;}
  });
  $('#canvasBtn').addEventListener('click',openCanvas);
  $('#exitCanvas').addEventListener('click',closeCanvas);
  $('#resetBtn').addEventListener('click',reset);
  $('#pauseBtn').addEventListener('click',()=>{paused=!paused;$$('.canvasInner').forEach(el=>el.style.animationPlayState=paused?'paused':'running');$('#pauseBtn').textContent=paused?'继续动效':'暂停动效';});
  document.addEventListener('click',e=>{const c=e.target.closest('[data-id]');if(c&&!moved)detail(c.dataset.id);});
  $('#close').addEventListener('click',closeDetail);
  $('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeDetail();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDetail();closeCanvas();}});

  // ---------- init ----------
  buildStats();
  buildTabs();
  refresh();
  console.log('AI赛事库 loaded:', items.length, 'events');
})();
