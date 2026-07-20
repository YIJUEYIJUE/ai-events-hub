(function(){
  "use strict";
  const DATA = window.EVENT_DATA || {meta:{},items:[]};
  const items = DATA.items || [];
  const meta = DATA.meta || {};
  const COLORS = {'AI赛事':'#173fe8','AI电影节':'#e96450','AI设计类':'#1f9e8f'};
  const STATUSES = ['进行中','已截止','待公布'];
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // ---------- helpers ----------
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function colColor(c){return COLORS[c]||'#888';}
  function colClass(c){return 'c-'+(c||'').replace(/[^一-龥A-Za-z]/g,'');}
  function regionText(arr){return (arr||[]).join(' · ');}
  function truncate(s,n){s=String(s||'');return s.length>n?s.slice(0,n)+'…':s;}

  // ---------- state ----------
  const state = {collection:'ALL', q:'', status:new Set(), type:new Set(), region:new Set()};

  // ---------- cover ----------
  function buildCover(){
    const byColl = {};
    items.forEach(it=>{byColl[it.collection]=(byColl[it.collection]||0)+1;});
    const total = items.length;
    const withSite = items.filter(i=>i.website).length;
    const openNow = items.filter(i=>i.status==='进行中').length;
    const stats = [
      {b:total, s:'赛事总数 EVENTS'},
      {b:Object.keys(byColl).length, s:'大类 CATEGORIES'},
      {b:openNow, s:'进行中 OPEN'},
      {b:withSite, s:'附官网 LINKED'},
    ];
    $('#stats').innerHTML = stats.map(x=>`<div class="stat"><b>${x.b}</b><span>${x.s}</span></div>`).join('');
    // marquee of names
    const pick = items.slice().sort(()=>Math.random()-0.5).slice(0,60);
    const track = pick.concat(pick).map(i=>`<span class="chip"><span class="dot" style="background:${colColor(i.collection)}"></span>${esc(i.name)}</span>`).join('');
    $('#marquee').innerHTML = track;
  }

  // ---------- tabs (collection) ----------
  function buildTabs(){
    const counts = {ALL:items.length};
    ['AI赛事','AI电影节','AI设计类'].forEach(c=>counts[c]=items.filter(i=>i.collection===c).length);
    const tabs = [{k:'ALL',label:'全部赛事'}].concat(['AI赛事','AI电影节','AI设计类'].map(c=>({k:c,label:c})));
    $('#tabs').innerHTML = tabs.map(t=>`<button class="tab ${state.collection===t.k?'active':''}" data-col="${t.k}">${esc(t.label)}<span class="n">${counts[t.k]}</span></button>`).join('');
  }

  // ---------- sidebar facets ----------
  function basePool(){
    return state.collection==='ALL' ? items : items.filter(i=>i.collection===state.collection);
  }
  function buildFacets(){
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
    $('#fType').innerHTML = types.map(t=>`<button class="fchip ${state.type.has(t)?'active':''}" data-facet="type" data-val="${esc(t)}"><span>${esc(t)}</span><span class="cnt">${typeCount[t]}</span></button>`).join('');
    // region
    const regCount = {};
    pool.forEach(i=>(i.region||[]).forEach(r=>{regCount[r]=(regCount[r]||0)+1;}));
    const regs = Object.keys(regCount).sort((a,b)=>regCount[b]-regCount[a]).slice(0,22);
    $('#fRegion').innerHTML = regs.map(r=>`<button class="fchip ${state.region.has(r)?'active':''}" data-facet="region" data-val="${esc(r)}"><span>${esc(r)}</span><span class="cnt">${regCount[r]}</span></button>`).join('');
  }

  // ---------- filter ----------
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

  // ---------- grid ----------
  function renderGrid(){
    const list = items.filter(matches);
    $('#listTitle').textContent = state.collection==='ALL' ? '全部赛事' : state.collection;
    const act = [];
    if(state.status.size) act.push([...state.status].join('/'));
    if(state.type.size) act.push([...state.type].join('/'));
    if(state.region.size) act.push([...state.region].join('/'));
    $('#listSub').textContent = `${list.length} 条结果` + (act.length?` · 筛选：${act.join(' · ')}`:'') + (state.q?` · 搜索「${state.q}」`:'');
    if(!list.length){
      $('#grid').innerHTML = `<div class="empty">没有符合条件的赛事，试试放宽筛选条件 🔍</div>`;
      return;
    }
    $('#grid').innerHTML = list.map(it=>{
      const color = colColor(it.collection);
      const rtext = truncate(regionText(it.region), 18);
      const award = truncate(it.award, 46);
      const web = it.website ? `<a href="${esc(it.website)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">官网 ↗</a>` : `<span style="color:var(--ink3);font-family:var(--mono);font-size:11px">无链接</span>`;
      return `<button class="card" data-id="${esc(it.id)}">
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
        ${award?`<div class="award">🏆 ${esc(award)}</div>`:''}
        <div class="cardFoot">
          <span class="dl">${it.deadline?('📅 '+esc(it.deadline)):(it.nextTime?('🗓️ '+esc(truncate(it.nextTime,14))):'—')}</span>
          ${web}
        </div>
      </button>`;
    }).join('');
  }

  function refresh(){buildFacets();renderGrid();}

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

  // ---------- navigation ----------
  function showLib(){$('#cover').classList.add('hide');$('#library').classList.add('show');}
  function showCover(){closeCanvas();$('#library').classList.remove('show');const c=$('#cover');c.classList.remove('hide');c.scrollTop=0;}
  function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1200);}

  // ---------- canvas ----------
  const canvas=$('#canvas'),viewport=$('#viewport'),plane=$('#plane');
  let pan={x:0,y:0,s:1},drag=false,moved=false,start={x:0,y:0},startPan={x:0,y:0},paused=false;
  function renderCanvas(){
    const pool = items.filter(matches).slice(0,160);
    let rings=[300,560,840,1120,1420];
    let html = pool.map((a,i)=>{
      const ang=i*137.508*Math.PI/180, ring=rings[i%rings.length];
      const x=Math.cos(ang)*ring+((i%7)-3)*70, y=Math.sin(ang)*ring+((i%9)-4)*54;
      const r=((i*31)%40)-20, dur=6+(i%8)*.55, delay=-((i%13)*.36);
      return `<button class="canvasItem" data-id="${esc(a.id)}" style="--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;--r:${r}deg;--dur:${dur}s;--delay:${delay}s"><div class="canvasInner"><span class="col" style="background:${colColor(a.collection)}">${esc(a.collection)}</span><h4>${esc(truncate(a.name,22))}</h4></div></button>`;
    }).join('');
    plane.insertAdjacentHTML('beforeend',html);
  }
  function apply(){plane.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${pan.s})`;}
  function openCanvas(){showLib();canvas.classList.add('show');apply();}
  function closeCanvas(){canvas.classList.remove('show');}
  function reset(){pan={x:0,y:0,s:1};apply();}

  viewport.addEventListener('pointerdown',e=>{drag=true;moved=false;start={x:e.clientX,y:e.clientY};startPan={...pan};viewport.classList.add('dragging');viewport.setPointerCapture(e.pointerId);});
  viewport.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;pan.x=startPan.x+dx;pan.y=startPan.y+dy;apply();});
  viewport.addEventListener('pointerup',()=>{setTimeout(()=>{drag=false;viewport.classList.remove('dragging');},0);});
  viewport.addEventListener('wheel',e=>{e.preventDefault();pan.s=Math.max(.32,Math.min(2.4,pan.s*(e.deltaY>0?.92:1.08)));apply();},{passive:false});

  // ---------- events ----------
  $('#enter').onclick=showLib;
  $('#canvasFromCover').onclick=openCanvas;
  $('#homeBtn').onclick=showCover;
  $('#canvasBtn').onclick=openCanvas;
  $('#exitCanvas').onclick=closeCanvas;
  $('#resetBtn').onclick=reset;
  $('#pauseBtn').onclick=()=>{paused=!paused;$$('.canvasInner').forEach(el=>el.style.animationPlayState=paused?'paused':'running');$('#pauseBtn').textContent=paused?'继续动效':'暂停动效';};
  $('#search').oninput=e=>{state.q=e.target.value;renderGrid();};
  $('#tabs').onclick=e=>{const b=e.target.closest('.tab');if(!b)return;state.collection=b.dataset.col;$$('.tab').forEach(x=>x.classList.toggle('active',x===b));refresh();};
  $('#side').onclick=e=>{const b=e.target.closest('.fchip');if(!b)return;const f=b.dataset.facet,v=b.dataset.val;const set=state[f];if(set.has(v))set.delete(v);else set.add(v);b.classList.toggle('active');renderGrid();};
  document.addEventListener('click',e=>{const c=e.target.closest('[data-id]');if(c&&!moved)detail(c.dataset.id);});
  $('#close').onclick=closeDetail;
  $('#modal').onclick=e=>{if(e.target.id==='modal')closeDetail();};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeDetail();closeCanvas();}
    if(e.key==='/'&&!$('#modal').classList.contains('show')){e.preventDefault();showLib();$('#search').focus();}
    if(e.key==='Enter'&&!$('#library').classList.contains('show'))showLib();
  });

  // ---------- init ----------
  buildCover();
  buildTabs();
  refresh();
  console.log('AI赛事库 loaded:', items.length, 'events');
})();
