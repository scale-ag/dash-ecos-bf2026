"use strict";
const DATA = JSON.parse(document.getElementById('payload').textContent);
const META = DATA.meta, SALES = DATA.sales, B = DATA.build;
const TAX = B.tax_factor || 1;
const MAIN_PRODUCT = B.main_product || 'Produto principal';
const MAIN_PREFIX = B.main_product_prefix || '';
const ALL_MAIN = !!B.all_products_main;      /* e-commerce: todo pedido = venda */
const HAS_ATC = !!B.has_atc;                /* etapa Carrinho (Adds to Cart) disponível */
const CLIENT = !!B.client_mode;             /* página /cliente/: só Visão Geral + criativos */
if(CLIENT) document.body.classList.add('client-mode');

/* ---------------- format ---------------- */
const nf0=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
const nf1=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const nf2=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const brl=v=>(v==null||!isFinite(v))?'-':'R$ '+nf2.format(v);
const pct=v=>(v==null||!isFinite(v))?'-':nf2.format(v*100)+'%';
const intf=v=>(v==null||!isFinite(v))?'-':nf0.format(v);
const numf=v=>(v==null||!isFinite(v))?'-':nf1.format(v);
const roasf=v=>(v==null||!isFinite(v))?'-':nf1.format(v)+'x';
const dimf=v=>v==null?'-':String(v);
/* remove acentos p/ casar com o norm() do build.py (unicodedata NFKD) */
const norm=s=>(s==null?'':String(s)).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const isMainProd=p=>ALL_MAIN||norm(p).startsWith(MAIN_PREFIX);
const brdate=d=>{ if(!d) return '-'; const p=d.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; };
const WD=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const weekday=d=>{ const dt=new Date(d+'T00:00:00'); return isNaN(dt)?'':WD[dt.getDay()]; };

/* ---------------- date helpers ---------------- */
function pad(n){return String(n).padStart(2,'0');}
function dstr(dt){return dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());}
function addDays(s,n){const dt=new Date(s+'T00:00:00');dt.setDate(dt.getDate()+n);return dstr(dt);}
const TODAY = B.today || B.date_max;

/* ---------------- STATE ---------------- */
const STATE = {
  page:'geral', from:B.date_min, to:B.date_max, preset:'todo', tax:true,
  selDays:new Set(),
  mSelC:new Set(), mSelA:new Set(), mSelAd:new Set(),
  sort:{}, colw: JSON.parse(localStorage.getItem('dm_colw')||'{}'),
  iaWin: localStorage.getItem('ia_win') || '14d',
};
const taxf = ()=> STATE.tax ? TAX : 1;

/* active date test: selDays override the De/Até range */
function dateActive(d){
  if(!d) return false;
  if(STATE.selDays.size) return STATE.selDays.has(d);
  return (!STATE.from || d>=STATE.from) && (!STATE.to || d<=STATE.to);
}
const metaActive  = ()=> META.filter(m=>dateActive(m.d));
const salesActive = ()=> SALES.filter(s=>dateActive(s.d));

/* ---------------- aggregation ----------------
   bucket = {sp,im,cl,pv,atc,ck, vendas, vendasM, fat}   (atc = Adds to Cart)
   vendas  = compras do produto principal (base de exibição da página)
   vendasM = compras do produto principal atribuídas ao Meta Ads (base das conversões)
   fat     = faturamento (todos os produtos do escopo)
   Obs.: na aba Meta o conjunto de vendas já é filtrado a meta==1, então vendas==vendasM. */
function newBucket(){return {sp:0,im:0,cl:0,pv:0,atc:0,ck:0,vendas:0,vendasM:0,fat:0};}
function addSales(a,r){ a.vendas+=r.main; a.vendasM+=(r.main&&r.meta)?1:0; a.fat+=r.val; }
function derive(a){
  const g=a.sp*taxf();
  return {gasto:g, impr:a.im, cliques:a.cl, pv:a.pv, atc:a.atc, ck:a.ck, vendas:a.vendas, fat:a.fat,
    cpm:a.im?g/a.im*1000:null, ctr:a.im?a.cl/a.im:null, cpc:a.cl?g/a.cl:null,
    cpv:a.pv?g/a.pv:null, cr:a.cl?a.pv/a.cl:null,               /* CR = Page Views / Cliques */
    cpatc:a.atc?g/a.atc:null, txatc:a.pv?a.atc/a.pv:null,       /* Custo/Carrinho · Tx Carrinho = Carrinhos / Page Views */
    cpic:a.ck?g/a.ck:null, vischk:a.pv?a.ck/a.pv:null,
    txck:a.atc?a.ck/a.atc:null,                                 /* Tx Checkout = Checkouts / Carrinhos */
    convlp:a.pv?a.vendasM/a.pv:null,                            /* Vendas(Meta) / Page Views */
    convchk:a.ck?a.vendasM/a.ck:null,                           /* Vendas(Meta) / Checkouts */
    cac:a.vendas?g/a.vendas:null, roas:g?a.fat/g:null, ticket:a.vendas?a.fat/a.vendas:null};
}
function buildAgg(fS,fM,dim){
  const m={}; const get=k=>m[k]||(m[k]=newBucket());
  fM.forEach(r=>{const a=get(r[dim]); a.sp+=r.sp; a.im+=r.im; a.cl+=r.cl; a.pv+=r.pv; a.ck+=r.ck; a.atc+=(r.atc||0);});
  fS.forEach(r=>{const a=get(r[dim]); addSales(a,r);});
  return m;
}
function totals(fS,fM){
  const a=newBucket();
  fM.forEach(r=>{a.sp+=r.sp;a.im+=r.im;a.cl+=r.cl;a.pv+=r.pv;a.ck+=r.ck; a.atc+=(r.atc||0);});
  fS.forEach(r=>addSales(a,r));
  return a;
}
function daily(fS,fM){
  const days={}; const g=d=>days[d]||(days[d]=Object.assign({d},newBucket()));
  fM.forEach(r=>{if(!r.d)return; const a=g(r.d); a.sp+=r.sp; a.im+=r.im; a.cl+=r.cl; a.pv+=r.pv; a.ck+=r.ck; a.atc+=(r.atc||0);});
  fS.forEach(r=>{if(!r.d)return; addSales(g(r.d),r);});
  return Object.values(days).sort((a,b)=>a.d<b.d?-1:1);
}

/* ---------------- generic interactive table ---------------- */
function colWidth(cfg,c){ const saved=(STATE.colw[cfg.id]||{})[c.key];
  if(saved) return saved;
  if(c.w) return c.w;
  if(c.type==='date') return 96;
  if(c.type==='dim') return c.big?300:150;
  return 88; }
function renderTable(cfg){
  const table=document.getElementById(cfg.id); if(!table) return;
  const sortState=STATE.sort[cfg.id];
  let rows=cfg.rows.slice();
  if(sortState){ const {key,dir}=sortState; const c=cfg.cols.find(x=>x.key===key);
    rows.sort((a,b)=>{ let va=a.cells[key], vb=b.cells[key];
      if(c && c.type==='dim'){ va=norm(va); vb=norm(vb); return dir==='asc'?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0); }
      va=(va==null||!isFinite(va))?-Infinity:va; vb=(vb==null||!isFinite(vb))?-Infinity:vb;
      return dir==='asc'?va-vb:vb-va; }); }
  const ext={};
  cfg.cols.forEach(c=>{ if(c.heat){ const vs=rows.map(r=>r.cells[c.key]).filter(v=>v!=null&&isFinite(v));
    if(c.heat==='cost' && vs.length>=5){ const so=vs.slice().sort((a,b)=>a-b), q=p=>so[Math.min(so.length-1,Math.max(0,Math.round(p*(so.length-1))))];
      ext[c.key]=[q(0.1),q(0.9)]; }   /* custos: escala p10–p90 (outliers de 1 venda não achatam a cor) */
    else ext[c.key]=[Math.min(...vs),Math.max(...vs)]; }});
  const fmt=(t,v)=> t==='link'?(v?`<a class="cr-link" href="${esc(v)}" target="_blank" rel="noopener">Abrir ▸</a>`:'—'):t==='brl'?brl(v):t==='pct'?pct(v):t==='int'?intf(v):t==='num'?numf(v):t==='roas'?roasf(v):t==='date'?brdate(v):dimf(v);
  const widths=cfg.cols.map(c=>colWidth(cfg,c)); const totalW=widths.reduce((a,b)=>a+b,0);
  const colgroup='<colgroup>'+cfg.cols.map((c,i)=>`<col style="width:${widths[i]}px">`).join('')+'</colgroup>';
  let thead='<thead><tr>'+cfg.cols.map((c,i)=>{
    const sc = sortState&&sortState.key===c.key ? (sortState.dir==='asc'?'sorted-asc':'sorted-desc') : '';
    return `<th class="${c.type==='dim'?'dim ':''}${sc}" data-k="${c.key}" data-ci="${i}">${c.label}<span class="rsz"></span></th>`;
  }).join('')+'</tr></thead>';
  let tbody='<tbody>'+rows.map(r=>{
    const sel = cfg.selectable && cfg.selSet && cfg.selSet.has(r.k);
    const tds=cfg.cols.map(c=>{
      const v=r.cells[c.key]; let bg='';
      if(c.heat && ext[c.key]) bg=`background:${heat(v,ext[c.key][0],ext[c.key][1],c.heat)}`;
      const cls=(c.type==='dim'?'dim':'');
      return `<td class="${cls}" style="${bg}">${fmt(c.type,v)}</td>`;
    }).join('');
    return `<tr class="${sel?'sel':''}" data-k="${encodeURIComponent(r.k)}">${tds}</tr>`;
  }).join('')+'</tbody>';
  let tfoot='';
  if(cfg.total){ tfoot='<tfoot><tr>'+cfg.cols.map((c,i)=>{
    const v=cfg.total[c.key]; return `<td class="${c.type==='dim'?'dim':''}">${i===0?(v==null?'Total Geral':fmt(c.type,v)):fmt(c.type,v)}</td>`;
  }).join('')+'</tr></tfoot>'; }
  table.style.width=totalW+'px';
  table.innerHTML=colgroup+thead+tbody+tfoot;
  const cols=table.querySelector('colgroup').children;
  table.querySelectorAll('thead th').forEach(th=>{
    th.addEventListener('click',e=>{ if(e.target.classList.contains('rsz'))return;
      const k=th.dataset.k, cur=STATE.sort[cfg.id];
      if(!cur||cur.key!==k) STATE.sort[cfg.id]={key:k,dir:'asc'};
      else if(cur.dir==='asc') STATE.sort[cfg.id]={key:k,dir:'desc'};
      else delete STATE.sort[cfg.id];
      renderTable(cfg);
    });
  });
  table.querySelectorAll('thead th .rsz').forEach(g=>{
    g.addEventListener('mousedown',e=>{ e.preventDefault(); e.stopPropagation();
      const th=g.parentElement, k=th.dataset.k, ci=+th.dataset.ci, x0=e.clientX;
      const w0=cols[ci].offsetWidth, tw0=table.offsetWidth;
      document.body.style.userSelect='none';
      const mv=ev=>{ const nw=Math.max(60,w0+(ev.clientX-x0)); cols[ci].style.width=nw+'px'; table.style.width=(tw0-w0+nw)+'px';
        STATE.colw[cfg.id]=STATE.colw[cfg.id]||{}; STATE.colw[cfg.id][k]=nw; };
      const up=()=>{ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); document.body.style.userSelect=''; localStorage.setItem('dm_colw',JSON.stringify(STATE.colw)); };
      document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
    });
  });
  if(cfg.selectable && cfg.onSelect){
    table.querySelectorAll('tbody tr').forEach(tr=>{
      tr.addEventListener('click',e=>{ cfg.onSelect(decodeURIComponent(tr.dataset.k), e); });
    });
  }
}
/* Heatmap por coluna: cor FIXA por métrica (definida em identidade-visual.css),
   só a OPACIDADE varia com o valor (maior valor = mais vibrante). */
const HEAT_HUE={gasto:'--heat-gasto', fat:'--heat-fat', roas:'--heat-roas', cost:'--heat-gasto'};
function heat(v,lo,hi,kind){
  if(v==null||!isFinite(v)||hi===lo||!HEAT_HUE[kind]) return 'transparent';
  const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));
  const c=hx2rgb(cvar(HEAT_HUE[kind]));
  return `rgba(${c[0]},${c[1]},${c[2]},${(0.06+0.5*t).toFixed(3)})`;
}
function toggleSet(set,key,ctrl){
  if(ctrl){ set.has(key)?set.delete(key):set.add(key); }
  else { const only=set.has(key)&&set.size===1; set.clear(); if(!only) set.add(key); }
}

/* ---------------- charts ---------------- */
const charts={};
const CHART_SERIES=['--cc1','--cc2','--cc3','--cc4','--cc5','--cc6','--cc7','--cc8','--cc9','--cc10'];
const cvar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const chartPalette=()=>CHART_SERIES.map(v=>cvar(v)||'#888888');
const hx2rgb=h=>{h=(h||'').replace('#','').trim();if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h||'888888',16);return [(n>>16)&255,(n>>8)&255,n&255];};
const cmuted=()=>cvar('--muted')||'#6B7280', cink=()=>cvar('--ink')||'#1A1D2E', cgrid=()=>cvar('--grid')||'#EEF0F5';
function destroy(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }
const FMT={brl:brl,pct:pct,num:numf,int:intf,roas:roasf};

/* combo: Vendas (barras) · Gasto/Faturamento (R$) · ROAS (eixo próprio) */
function comboChart(id, d, labels, noSpend){
  destroy(id); const el=document.getElementById(id); if(!el) return;
  labels=labels||d.map(x=>x.d.slice(5)); const mut=cmuted(), gr=cgrid();
  charts[id]=new Chart(el,{
    data:{labels, datasets:[
      {type:'bar',label:'Vendas',data:d.map(x=>x.vendas),backgroundColor:cvar('--chart-vendas'),yAxisID:'y',borderRadius:3,order:3},
      {type:'line',label:'Gasto',data:d.map(x=>+(x.sp*taxf()).toFixed(2)),borderColor:cvar('--chart-gasto'),backgroundColor:cvar('--chart-gasto'),yAxisID:'y1',borderWidth:2,pointRadius:2,tension:.25,order:2},
      {type:'line',label:'Faturamento',data:d.map(x=>+x.fat.toFixed(2)),borderColor:cvar('--chart-faturamento'),backgroundColor:cvar('--chart-faturamento'),yAxisID:'y1',borderWidth:2,pointRadius:2,tension:.25,order:2},
      {type:'line',label:'ROAS',data:d.map(x=>{const g=x.sp*taxf();return g?+(x.fat/g).toFixed(2):null;}),borderColor:cink(),backgroundColor:cink(),yAxisID:'y2',borderWidth:2,pointRadius:2,spanGaps:true,tension:.25,order:0},
    ].filter(ds=>!(noSpend&&(ds.label==='Gasto'||ds.label==='ROAS')))},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:cink(),boxWidth:10,usePointStyle:true,font:{size:11}}},
        tooltip:{callbacks:{label:c=>{const v=c.raw,ax=c.dataset.yAxisID; return c.dataset.label+': '+(ax==='y1'?brl(v):ax==='y2'?roasf(v):intf(v));}}}},
      scales:{x:{ticks:{color:mut,font:{size:10}},grid:{display:false}},
        y:{position:'left',ticks:{color:mut,font:{size:10}},grid:{color:gr},beginAtZero:true,title:{display:true,text:'Vendas',color:mut,font:{size:10}}},
        y1:{position:'right',ticks:{color:mut,font:{size:10}},grid:{display:false},beginAtZero:true,title:{display:true,text:'R$',color:mut,font:{size:10}}},
        y2:{display:!noSpend,position:'right',ticks:{color:mut,font:{size:10},callback:v=>numf(v)+'x'},grid:{display:false},beginAtZero:true,title:{display:true,text:'ROAS',color:mut,font:{size:10}}}}}
  });
}
/* linhas genéricas (1 ou 2 eixos) */
function multiLine(id, d, series, opts){
  destroy(id); const el=document.getElementById(id); if(!el) return;
  const labels=d.map(x=>x.d.slice(5)), mut=cmuted();
  const useR=series.some(s=>s.axis==='R');
  const datasets=series.map(s=>({label:s.label,data:d.map(s.fn),borderColor:s.color,backgroundColor:s.color,
    yAxisID:s.axis==='R'?'y1':'y',borderWidth:2,pointRadius:2,spanGaps:true,tension:.25,_fmt:FMT[s.fmt]||numf}));
  const scales={x:{ticks:{color:mut,font:{size:9}},grid:{display:false}},
    y:{position:'left',beginAtZero:true,ticks:{color:mut,font:{size:9},callback:v=>(FMT[opts.L.fmt]||numf)(v)},grid:{color:cgrid()}}};
  if(useR) scales.y1={position:'right',beginAtZero:true,grid:{display:false},ticks:{color:mut,font:{size:9},callback:v=>(FMT[opts.R.fmt]||numf)(v)}};
  charts[id]=new Chart(el,{type:'line',data:{labels,datasets},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:cink(),boxWidth:10,usePointStyle:true,font:{size:10}}},
        tooltip:{callbacks:{label:c=>c.dataset.label+': '+(c.dataset._fmt||numf)(c.raw)}}},
      scales}});
}
/* barras horizontais (faturamento por anúncio) */
const barLabels={id:'barLabels',afterDatasetsDraw(ch){const{ctx}=ch;ctx.save();ctx.font='600 11px Segoe UI,system-ui';ctx.fillStyle=cmuted();ctx.textBaseline='middle';
  const ds=ch.data.datasets[0], f=ds._fmt||intf;
  ch.getDatasetMeta(0).data.forEach((el,i)=>{const v=ds.data[i]; if(!v)return; ctx.fillText(f(v),el.x+5,el.y);});ctx.restore();}};
function hbar(id, items, valFn, color, top, fmtFn){
  destroy(id); const el=document.getElementById(id); if(!el) return;
  let arr=items.slice().sort((a,b)=>valFn(b)-valFn(a)); if(top) arr=arr.slice(0,top);
  const mut=cmuted(), f=fmtFn||intf;
  charts[id]=new Chart(el,{type:'bar', plugins:[barLabels],
    data:{labels:arr.map(x=>x.label), datasets:[{label:'v',data:arr.map(valFn),backgroundColor:color||'#1BAF7A',borderRadius:3,_fmt:f}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,layout:{padding:{right:44}},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>f(c.raw)}}},
      scales:{x:{beginAtZero:true,ticks:{color:mut,font:{size:9}},grid:{color:cgrid()}},
              y:{ticks:{color:mut,font:{size:9}},grid:{display:false}}}}});
}
/* CAC por dia, por item de uma dimensão (campanha/conjunto/anúncio) - 1 linha por item.
   `dim` = 'camp' | 'adset' | 'ad'; usa os mesmos dados escopados da tabela acima. */
function cacDimChart(id, fM, fS, dim){
  destroy(id); const el=document.getElementById(id); if(!el) return;
  const spendTot={}; fM.forEach(r=>spendTot[r[dim]]=(spendTot[r[dim]]||0)+r.sp);
  const items=Object.keys(spendTot).sort((a,b)=>spendTot[b]-spendTot[a]).slice(0,6);
  const dset=new Set(); fM.forEach(r=>r.d&&dset.add(r.d)); fS.forEach(r=>r.d&&dset.add(r.d));
  const days=[...dset].sort();
  const K=(c,dd)=>c+'\u0001'+dd, sp={}, vd={};
  fM.forEach(r=>{if(!r.d)return; sp[K(r[dim],r.d)]=(sp[K(r[dim],r.d)]||0)+r.sp;});
  fS.forEach(r=>{if(!r.d)return; vd[K(r[dim],r.d)]=(vd[K(r[dim],r.d)]||0)+r.main;});
  const PAL=chartPalette();
  const ds=items.map((c,i)=>({label:c.length>22?c.slice(0,22)+'…':c,
    data:days.map(dd=>{const s=(sp[K(c,dd)]||0)*taxf(), v=vd[K(c,dd)]||0; return v?+(s/v).toFixed(2):null;}),
    borderColor:PAL[i%PAL.length],backgroundColor:PAL[i%PAL.length],borderWidth:2,pointRadius:1.5,spanGaps:true,tension:.25}));
  const mut=cmuted();
  charts[id]=new Chart(el,{type:'line',data:{labels:days.map(x=>x.slice(5)),datasets:ds},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:cink(),boxWidth:8,font:{size:9}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+brl(c.raw)}}},
      scales:{x:{ticks:{color:mut,font:{size:9},maxRotation:0,autoSkip:true,autoSkipPadding:8},grid:{display:false}},y:{ticks:{color:mut,font:{size:9},callback:v=>brl(v)},grid:{color:cgrid()},beginAtZero:true}}}});
}

/* ---------------- KPI cards ---------------- */
function kpiCard(k){ return `<div class="kpi ${k.hero?'hero':''}"><div class="kl"><span>${k.label}</span>${k.pill?`<span class="pill q">${k.pill}</span>`:''}</div><div class="kv">${k.val}</div><div class="ka">${k.aux||''}</div></div>`; }

/* ---------------- colunas das tabelas ---------------- */
/* Funil etapa a etapa: custo de cada etapa + taxa de conversão da etapa.
   Sem coluna Adds to Cart no Meta (HAS_ATC=false) as colunas de carrinho somem
   e a Tx Checkout volta a ser Checkouts/Page Views (VisCHK). */
const METRIC_COLS=[
  {key:'gasto',label:'Gasto',type:'brl',heat:'gasto'},   /* heatmap vermelho */
  {key:'cpm',label:'CPM',type:'brl'},
  {key:'ctr',label:'CTR',type:'pct'},
  {key:'pv',label:'Views LP',type:'int'},
  {key:'cpv',label:'Custo/View',type:'brl'},
  {key:'cr',label:'Connect Rate',type:'pct',w:100},
  {key:'atc',label:'Carrinhos',type:'int',atc:1},
  {key:'cpatc',label:'Custo/Carrinho',type:'brl',w:110,atc:1},
  {key:'txatc',label:'Tx Carrinho',type:'pct',atc:1},
  {key:'ck',label:'Checkouts',type:'int'},
  {key:'cpic',label:'Custo/Checkout',type:'brl',w:110},
  {key:'txck',label:'Tx Checkout',type:'pct'},
  {key:'vendas',label:'Vendas',type:'int'},
  {key:'cac',label:'Custo/Compra',type:'brl',w:110},
  {key:'convchk',label:'Tx Compra',type:'pct'},
  {key:'convlp',label:'Tx Conversão',type:'pct',w:100},
  {key:'fat',label:'Faturamento',type:'brl',heat:'fat',w:110},  /* heatmap verde */
  {key:'ticket',label:'Ticket',type:'brl'},
  {key:'roas',label:'ROAS',type:'roas',heat:'roas'},      /* heatmap amarelo */
].filter(c=>HAS_ATC||!c.atc);
/* mapa de calor de CUSTO (vermelho = mais caro) — tabelas da aba Meta Ads */
const COST_HEAT_KEYS={cpm:1,cpv:1,cpatc:1,cpic:1,cac:1};
const costHeat=cols=>cols.map(c=>COST_HEAT_KEYS[c.key]?{...c,heat:'cost'}:c);
const DAILY_COLS=[{key:'date',label:'Data',type:'date'},{key:'wd',label:'Dia',type:'dim',w:64}].concat(METRIC_COLS);
const HCOLS=[{key:'dim',label:'',type:'dim',big:true}].concat(METRIC_COLS.map(c=>{const o={...c}; delete o.heat; return o;}));
function metricCells(x,d){
  return {gasto:d.gasto, cpm:d.cpm, ctr:d.ctr, pv:x.pv, cpv:d.cpv, cr:d.cr,
    atc:x.atc, cpatc:d.cpatc, txatc:d.txatc, ck:x.ck, cpic:d.cpic, txck:HAS_ATC?d.txck:d.vischk,
    vendas:x.vendas, cac:d.cac, convchk:d.convchk, convlp:d.convlp,
    fat:x.fat, ticket:d.ticket, roas:d.roas};
}
function dailyCells(x,d,isTotal){
  return Object.assign({date:isTotal?null:x.d, wd:isTotal?'':weekday(x.d)}, metricCells(x,d));
}

/* ---------------- tabela Vendas por produto ---------------- */
/* e-commerce (ALL_MAIN): a coluna de produtos traz "1x Produto A | 2x Produto B";
   conta em quantos pedidos cada produto aparece e o % sobre o total de pedidos. */
/* Itens do pedido a partir da coluna de produtos ("1x Produto A | 2x Produto B").
   Alguns NOMES contêm "|" (ex.: "Ampola Cistina ... | Ecosmetics 12ml"): um pedaço
   que não começa com quantidade ("Nx ") é continuação do nome do item anterior. */
function splitItems(prod){ const out=[];
  String(prod||'').split('|').map(x=>x.trim()).filter(Boolean).forEach(seg=>{
    const m=seg.match(/^(\d+)\s*x\s+(.*)$/i);
    if(m) out.push({q:+m[1], p:m[2].trim()});
    else if(out.length) out[out.length-1].p+=' | '+seg;
    else out.push({q:1, p:seg}); });
  return out; }
function renderProdTableEcom(id, salesSet, pctLabel){
  const n=salesSet.length, byProd={}, units={};
  salesSet.forEach(r=>{ const seen=new Set();
    splitItems(r.prod).forEach(({q,p})=>{
      units[p]=(units[p]||0)+q;
      if(seen.has(p)) return; seen.add(p); byProd[p]=(byProd[p]||0)+1; }); });
  const rows=Object.entries(byProd).sort((a,b)=>b[1]-a[1]).map(([prod,c])=>({k:prod, cells:{prod, vendas:c, un:units[prod], pctm:n?c/n:null}}));
  renderTable({id, cols:[{key:'prod',label:'Produto',type:'dim',big:true},{key:'vendas',label:'Pedidos',type:'int',w:80,heat:'fat'},{key:'un',label:'Unidades',type:'int',w:90},{key:'pctm',label:pctLabel||'% dos pedidos',type:'pct',w:pctLabel?170:120}], rows});
}
function renderProdTable(id, salesSet){
  if(ALL_MAIN) return renderProdTableEcom(id, salesSet);
  const mainCount=salesSet.reduce((s,r)=>s+r.main,0);
  const byProd={}; salesSet.forEach(r=>{ if(isMainProd(r.prod)) return; byProd[r.prod]=(byProd[r.prod]||0)+1; });
  const rows=[{k:'__main__', cells:{prod:MAIN_PRODUCT, vendas:mainCount, pctm:1}}];
  Object.entries(byProd).sort((a,b)=>b[1]-a[1]).forEach(([prod,c])=>{
    rows.push({k:prod, cells:{prod:prod, vendas:c, pctm:mainCount?c/mainCount:null}});
  });
  renderTable({id, cols:[{key:'prod',label:'Produto',type:'dim',big:true},{key:'vendas',label:'Vendas',type:'int',w:80},{key:'pctm',label:'% vs principal',type:'pct',w:120}], rows});
}

/* ---------------- funil + gráficos de conversão (comuns às 2 abas) ---------------- */
/* ---- comparativo período atual vs período anterior de MESMO tamanho ---- */
function prevWindow(){
  if(!STATE.from||!STATE.to) return null;
  const span=Math.round((new Date(STATE.to+'T00:00:00')-new Date(STATE.from+'T00:00:00'))/86400000)+1;
  if(!(span>=1)) return null;
  return {from:addDays(STATE.from,-span), to:addDays(STATE.from,-1), span};
}
const inRange=(d,a,b)=>d&&d>=a&&d<=b;
/* métricas em que MENOR é melhor (custo); nas demais, maior é melhor */
const GOOD_LOW={gasto:1,cpm:1,cpc:1,cpv:1,cpatc:1,cpic:1,cac:1};
function deltaBadge(cur,prev,key){
  if(cur==null||prev==null||!isFinite(cur)||!isFinite(prev)||prev===0) return '';
  const p=((cur-prev)/Math.abs(prev))*100; if(!isFinite(p)) return '';
  const flat=Math.abs(p)<0.05, up=cur>prev;
  const good=flat?null:(GOOD_LOW[key]?!up:up);
  const cls=flat?'flat':(good?'good':'bad'), arrow=flat?'→':(up?'▲':'▼');
  return `<span class="delta ${cls}">${arrow} ${nf1.format(Math.abs(p))}%</span>`;
}
function renderFunnel(id, steps){
  document.getElementById(id).innerHTML=steps.map(s=>{
    const color=s[4]?`var(${s[4]})`:'var(--accent-blue)';
    const hi=(s[3]==='gasto'||s[3]==='fat');   // valores em destaque + contorno inteiro
    const border=hi?`border-color:${color}`:`border-left-color:${color}`;
    const secs=s[2].map(x=>`<div><span class="s-label">${x[0]}</span><span class="s-val${x[2]?' s-pill '+x[2]:''}">${x[1]}</span></div>`).join('');
    return `<div class="step" style="${border}">
      <div class="step-main"><div class="m-label">${s[0]}</div>
        <div class="m-val"${hi?` style="color:${color}"`:''}>${s[1]}</div>
        ${s[5]?`<div class="m-delta">${s[5]}</div>`:''}</div>
      <div class="secs">${secs}</div></div>`;
  }).join('');
}
function funnelSteps(t, tp){
  const d=derive(t), P=(k)=>tp?tp[k]:null, Pd=tp?derive(tp):null;
  return [
    ['Gasto Total', brl(d.gasto), [], 'gasto', '--heat-gasto', deltaBadge(d.gasto, Pd?Pd.gasto:null, 'gasto')],
    ['Impressões', intf(t.im), [['CPM',brl(d.cpm)]], 'impr', '--c6', deltaBadge(t.im, P('im'), 'im')],
    ['Cliques', intf(t.cl), [['CPC',brl(d.cpc)],['CTR',pct(d.ctr)]], 'cl', '--c1', deltaBadge(t.cl, P('cl'), 'cl')],
    ['Views da Página', intf(t.pv), [['Custo/View',brl(d.cpv)],['Connect Rate',pct(d.cr)]], 'pv', '--c4', deltaBadge(t.pv, P('pv'), 'pv')],
  ].concat(HAS_ATC?[
    ['Adições ao Carrinho', intf(t.atc), [['Custo/Carrinho',brl(d.cpatc)],['Tx Carrinho',pct(d.txatc)]], 'atc', '--c8', deltaBadge(t.atc, P('atc'), 'atc')],
  ]:[]).concat([
    ['Checkouts', intf(t.ck), [['Custo/Checkout',brl(d.cpic)],['Tx Checkout',pct(HAS_ATC?d.txck:d.vischk)]], 'ck', '--c3', deltaBadge(t.ck, P('ck'), 'ck')],
    ['Vendas', intf(t.vendas), [['Custo/Compra',brl(d.cac),'cac'],['Tx Compra',pct(d.convchk)],['Tx Conversão',pct(d.convlp)]], 'vendas', '--c7', deltaBadge(t.vendas, P('vendas'), 'vendas')],
    ['Faturamento', brl(t.fat), [['ROAS',roasf(d.roas),'roas'],['Ticket Médio',brl(d.ticket)]], 'fat', '--heat-fat', deltaBadge(t.fat, P('fat'), 'fat')],
  ]);
}
function convCharts(id1,id2,id3,dd){
  multiLine(id1, dd, [{label:'CPM',fn:x=>x.im?+((x.sp*taxf())/x.im*1000).toFixed(2):null,color:cvar('--chart-cpm'),fmt:'brl',axis:'L'},
     {label:'CTR',fn:x=>x.im?+(x.cl/x.im).toFixed(4):null,color:cvar('--chart-ctr'),fmt:'pct',axis:'R'}], {L:{fmt:'brl'},R:{fmt:'pct'}});
  multiLine(id2, dd, [{label:'Connect Rate',fn:x=>x.cl?+(x.pv/x.cl).toFixed(4):null,color:cvar('--chart-cr'),fmt:'pct',axis:'L'}].concat(HAS_ATC?[
     {label:'Tx Carrinho',fn:x=>x.pv?+(x.atc/x.pv).toFixed(4):null,color:cvar('--chart-convlp'),fmt:'pct',axis:'L'},
     {label:'Tx Checkout',fn:x=>x.atc?+(x.ck/x.atc).toFixed(4):null,color:cvar('--chart-vischk'),fmt:'pct',axis:'L'}]:[
     {label:'Tx Checkout',fn:x=>x.pv?+(x.ck/x.pv).toFixed(4):null,color:cvar('--chart-vischk'),fmt:'pct',axis:'L'}]), {L:{fmt:'pct'}});
  multiLine(id3, dd, [{label:'Tx Compra',fn:x=>x.ck?+(x.vendasM/x.ck).toFixed(4):null,color:cvar('--chart-vischk'),fmt:'pct',axis:'L'},
     {label:'Tx Conversão',fn:x=>x.pv?+(x.vendasM/x.pv).toFixed(4):null,color:cvar('--chart-convlp'),fmt:'pct',axis:'L'}], {L:{fmt:'pct'}});
}

/* ---------------- tabela de criativos (página do cliente) ----------------
   Agrega por Ad Name (o mesmo criativo em campanhas diferentes soma junto).
   Hook = 3s/Impressões (só linhas com vídeo) · Hold = ThruPlays/3s · Ret75 = p75/3s. */
function renderCreatives(id, fS, fM){
  const m={}; const g=k=>m[k]||(m[k]={sp:0,im:0,cl:0,imv:0,v3:0,thru:0,p75:0,vendas:0,fat:0,nv:0,rc:0});
  fM.forEach(r=>{ const a=g(r.ad); a.sp+=r.sp; a.im+=r.im; a.cl+=r.cl;
    if(r.v3){ a.imv+=r.im; a.v3+=r.v3; a.thru+=(r.thru||0); a.p75+=(r.p75||0); } });
  fS.forEach(r=>{ if(!r.ad) return; const a=g(r.ad); a.vendas+=r.main; a.fat+=r.val;
    if(r.nr===0) a.nv+=r.main; else if(r.nr===1) a.rc+=r.main; });
  const cells=(name,a)=>{ const gs=a.sp*taxf();
    return {ad:name, link:(DATA.ad_links||{})[name]||'', gasto:gs, cpm:a.im?gs/a.im*1000:null, ctr:a.im?a.cl/a.im:null,
      hook:a.imv?a.v3/a.imv:null, hold:a.v3?a.thru/a.v3:null, ret75:a.v3?a.p75/a.v3:null,
      vendas:a.vendas, nv:a.nv, rc:a.rc, roas:gs?a.fat/gs:null}; };
  const rows=Object.entries(m).filter(([n,a])=>a.sp>0||a.vendas>0).sort((x,y)=>y[1].sp-x[1].sp)
    .map(([n,a])=>({k:n, cells:cells(n,a)}));
  const T={sp:0,im:0,cl:0,imv:0,v3:0,thru:0,p75:0,vendas:0,fat:0,nv:0,rc:0};
  Object.values(m).forEach(a=>Object.keys(T).forEach(k=>T[k]+=a[k]));
  const tot=cells(null,T); tot.link='';
  renderTable({id, cols:[{key:'ad',label:'Criativo',type:'dim',big:true},{key:'link',label:'Ver',type:'link',w:70},
    {key:'gasto',label:'Gasto',type:'brl',heat:'gasto',w:110},{key:'cpm',label:'CPM',type:'brl'},{key:'ctr',label:'CTR',type:'pct'},
    {key:'hook',label:'Hook Rate',type:'pct',w:96},{key:'hold',label:'Hold Rate',type:'pct',w:96},{key:'ret75',label:'Retenção 75%',type:'pct',w:110},
    {key:'vendas',label:'Vendas',type:'int'}].concat(HAS_NR?[{key:'nv',label:'Novos',type:'int',w:80},{key:'rc',label:'Recorrentes',type:'int',w:100}]:[])
    .concat([{key:'roas',label:'ROAS',type:'roas',heat:'roas'}]), rows, total:tot});
}

/* ---------------- Quando e o que vende (dia da semana · hora · produto) ----------------
   Vendas/Faturamento = todos os pedidos pagos (como o funil da Visão Geral).
   Gasto por dia da semana vem da aba Meta (por data); gasto por HORA só existe
   se a aba horária do Meta estiver configurada (GID_META_HOURLY) -> ROAS por hora. */
const META_H = DATA.meta_h || [];
const WD_ORDER=[1,2,3,4,5,6,0];   // Seg..Dom
const wdIdx=d=>{ const dt=new Date(d+'T00:00:00'); return isNaN(dt)?null:dt.getDay(); };
function renderWhen(fS,fM){
  /* dia da semana */
  const W={}; WD_ORDER.forEach(i=>W[i]=newBucket());
  fM.forEach(r=>{ const i=wdIdx(r.d); if(i!=null) W[i].sp+=r.sp; });
  fS.forEach(r=>{ const i=wdIdx(r.d); if(i!=null) addSales(W[i],r); });
  comboChart('gWeek', WD_ORDER.map(i=>W[i]), WD_ORDER.map(i=>WD[i]));
  /* hora do dia */
  const hasH = META_H.length>0;
  const H=[...Array(24)].map(()=>newBucket());
  fS.forEach(r=>{ if(r.h!=null&&r.h>=0&&r.h<24) addSales(H[r.h],r); });
  if(hasH) META_H.forEach(r=>{ if(dateActive(r.d)&&r.h>=0&&r.h<24) H[r.h].sp+=r.sp; });
  comboChart('gHour', H, H.map((x,i)=>String(i).padStart(2,'0')+'h'), !hasH);
  document.getElementById('hourHint').innerHTML = hasH
    ? 'Vendas (barras) · Gasto Meta e Faturamento (R$) · ROAS por hora — hora do pedido na loja.'
    : 'Vendas (barras) · Faturamento (R$) por hora do pedido. <b>ROAS por hora</b>: aparece quando a aba de gasto por hora do Meta for conectada.';
  /* mapa de calor dia × hora */
  const M={}, F={}; let mx=0;
  fS.forEach(r=>{ const i=wdIdx(r.d); if(i==null||r.h==null) return; const k=i+'_'+r.h;
    M[k]=(M[k]||0)+r.main; F[k]=(F[k]||0)+r.val; mx=Math.max(mx,M[k]); });
  const hs=[...Array(24).keys()];
  let html='<thead><tr><th class="dim">Dia</th>'+hs.map(h=>`<th>${String(h).padStart(2,'0')}</th>`).join('')+'<th>Total</th></tr></thead><tbody>';
  WD_ORDER.forEach(i=>{ let tot=0;
    html+=`<tr><td class="dim">${WD[i]}</td>`+hs.map(h=>{ const v=M[i+'_'+h]||0; tot+=v;
      return `<td style="background:${v?heat(v,0,mx,'fat'):'transparent'}" title="${WD[i]} ${String(h).padStart(2,'0')}h · ${intf(v)} pedido(s) · ${brl(F[i+'_'+h]||0)}">${v||''}</td>`; }).join('')+`<td><b>${intf(tot)}</b></td></tr>`; });
  html+='</tbody><tfoot><tr><td class="dim">Total</td>'+hs.map(h=>{ let t=0; WD_ORDER.forEach(i=>t+=M[i+'_'+h]||0); return `<td>${t||''}</td>`; }).join('')+`<td>${intf(fS.reduce((s,r)=>s+(r.h!=null?r.main:0),0))}</td></tr></tfoot>`;
  document.getElementById('gHeat').innerHTML=html;
  /* produtos (todos os pedidos) + ranking só de clientes novos */
  renderProdTableEcom('gProdAll', fS);
  const pn=document.getElementById('gProdNewCard');
  if(pn){ pn.style.display = HAS_NR ? '' : 'none';
    if(HAS_NR) renderProdTableEcom('gProdNew', fS.filter(s=>s.nr===0), '% dos pedidos de novos'); }
}

/* ---------------- Clientes novos × recorrentes ----------------
   s.nr: 1 = recorrente (compra paga anterior, no histórico até HIST_ATE ou antes no
   período) · 0 = novo · null = sem identificação do cliente. */
const HAS_NR = !!B.has_customer_hist;
function renderNovosRecorrentes(fS){
  const sec=document.getElementById('nrSection'); if(!sec) return;
  sec.style.display = HAS_NR ? '' : 'none'; if(!HAS_NR) return;
  const T={n:{q:0,f:0},r:{q:0,f:0},x:{q:0,f:0}}, days={};
  fS.forEach(s=>{ const g=s.nr===1?'r':(s.nr===0?'n':'x'); T[g].q+=s.main; T[g].f+=s.val;
    if(!s.d) return; const dd=days[s.d]||(days[s.d]={n:0,r:0,x:0}); dd[g]+=s.main; });
  const tot=T.n.q+T.r.q, totF=T.n.f+T.r.f;
  const step=(lbl,o,color)=>[lbl, intf(o.q), [['% dos pedidos',pct(tot?o.q/tot:null)],['Faturamento',brl(o.f)],['Ticket',brl(o.q?o.f/o.q:null)]], 'nr', color, ''];
  renderFunnel('nrCards', [step('Clientes novos',T.n,'--c1'), step('Recorrentes',T.r,'--c3'),
    ['Total', intf(tot), [['% recorrentes',pct(tot?T.r.q/tot:null)],['Faturamento',brl(totF)]], 'fat', '--heat-fat', '']]);
  const H=DATA.customer_hist||{};
  document.getElementById('nrNote').innerHTML =
    `<b>Novo</b> = 1ª compra paga na loja · <b>Recorrente</b> = já tinha compra paga antes (histórico${H.de?' de '+brdate(H.de):''}${H.ate?' até '+brdate(H.ate):''} ou mais cedo no período). Todas as origens.`+
    (T.x.q?` ${intf(T.x.q)} pedido(s) sem identificação do cliente ficaram de fora.`:'');
  const ks=Object.keys(days).sort(), mut=cmuted();
  destroy('gNr'); const el=document.getElementById('gNr'); if(!el) return;
  charts['gNr']=new Chart(el,{data:{labels:ks.map(d=>d.slice(5)),datasets:[
      {type:'bar',label:'Novos',data:ks.map(d=>days[d].n),backgroundColor:cvar('--c1'),stack:'s',yAxisID:'y',borderRadius:2,order:2},
      {type:'bar',label:'Recorrentes',data:ks.map(d=>days[d].r),backgroundColor:cvar('--c3'),stack:'s',yAxisID:'y',borderRadius:2,order:2},
      {type:'line',label:'% recorrentes',data:ks.map(d=>{const t=days[d].n+days[d].r;return t?+(days[d].r/t).toFixed(4):null;}),borderColor:cink(),backgroundColor:cink(),yAxisID:'y1',borderWidth:2,pointRadius:2,tension:.25,order:0}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:cink(),boxWidth:10,usePointStyle:true,font:{size:11}}},
        tooltip:{callbacks:{label:c=>c.dataset.label+': '+(c.dataset.yAxisID==='y1'?pct(c.raw):intf(c.raw))}}},
      scales:{x:{stacked:true,ticks:{color:mut,font:{size:10}},grid:{display:false}},
        y:{stacked:true,beginAtZero:true,ticks:{color:mut,font:{size:10}},grid:{color:cgrid()},title:{display:true,text:'Pedidos',color:mut,font:{size:10}}},
        y1:{position:'right',min:0,max:1,ticks:{color:mut,font:{size:10},callback:v=>pct(v)},grid:{display:false}}}}});
}

/* ---------------- Vendas por origem (só dashboard interna) ---------------- */
function renderOrigens(fS){
  const sec=document.getElementById('orgSection'); if(!sec) return;
  if(CLIENT||!B.has_origin){ sec.style.display='none'; return; }
  const O={}, days={}, tot={q:0,f:0};
  fS.forEach(s=>{ const o=s.org||'Sem origem', src=s.src||'(sem utm_source)';
    const a=O[o]||(O[o]={q:0,f:0,src:{}}); a.q+=s.main; a.f+=s.val; tot.q+=s.main; tot.f+=s.val;
    const b=a.src[src]||(a.src[src]={q:0,f:0}); b.q+=s.main; b.f+=s.val;
    if(s.d){ const d=days[s.d]||(days[s.d]={}); d[o]=(d[o]||0)+s.main; } });
  const orgs=Object.keys(O).sort((x,y)=>O[y].q-O[x].q), ks=Object.keys(days).sort(), PAL=chartPalette(), mut=cmuted();
  destroy('gOrg'); const el=document.getElementById('gOrg');
  if(el) charts['gOrg']=new Chart(el,{type:'bar',data:{labels:ks.map(d=>d.slice(5)),datasets:orgs.map((o,i)=>({label:o,data:ks.map(d=>days[d][o]||0),backgroundColor:PAL[i%PAL.length],stack:'o',borderRadius:2}))},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:cink(),boxWidth:10,usePointStyle:true,font:{size:11}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+intf(c.raw)}}},
      scales:{x:{stacked:true,ticks:{color:mut,font:{size:10}},grid:{display:false}},y:{stacked:true,beginAtZero:true,ticks:{color:mut,font:{size:10}},grid:{color:cgrid()},title:{display:true,text:'Pedidos',color:mut,font:{size:10}}}}}});
  let h='<thead><tr><th class="dim">Origem</th><th>Pedidos</th><th>%</th><th>Faturamento</th><th>Ticket</th></tr></thead><tbody>';
  orgs.forEach(o=>{ const a=O[o];
    h+=`<tr><td class="dim"><b>${esc(o)}</b></td><td><b>${intf(a.q)}</b></td><td>${pct(tot.q?a.q/tot.q:null)}</td><td>${brl(a.f)}</td><td>${brl(a.q?a.f/a.q:null)}</td></tr>`;
    const subs=Object.entries(a.src).sort((x,y)=>y[1].q-x[1].q);
    if(subs.length>1||(subs[0]&&subs[0][0]!=='(sem utm_source)')) subs.forEach(([src,b])=>{
      h+=`<tr style="color:var(--muted)"><td class="dim" style="padding-left:26px">↳ ${esc(src)}</td><td>${intf(b.q)}</td><td>${pct(tot.q?b.q/tot.q:null)}</td><td>${brl(b.f)}</td><td>${brl(b.q?b.f/b.q:null)}</td></tr>`; }); });
  h+=`</tbody><tfoot><tr><td class="dim">Total</td><td>${intf(tot.q)}</td><td>${pct(tot.q?1:null)}</td><td>${brl(tot.f)}</td><td>${brl(tot.q?tot.f/tot.q:null)}</td></tr></tfoot>`;
  document.getElementById('gOrgTbl').innerHTML=h;
}

/* ---------------- PAGE: Insights (produtos × clientes novos/recorrentes) ----------------
   Tudo calculado no navegador sobre os pedidos do período filtrado; as frases são
   regras fixas sobre os números (sem IA). Perfis só com volume mínimo (INS_MIN). */
const INS_MIN=5;
const PH=DATA.prod_hist||null;
const insNorm=s=>norm(s).replace(/\s+/g,' ');
const HIST_RANK=(()=>{ const m={}; if(PH&&PH.ranking) PH.ranking.forEach((p,i)=>{ const k=insNorm(p); if(!(k in m)) m[k]=i+1; }); return m; })();
const insItems=splitItems;
function insList(arr,fmt){ return arr.map(fmt).join('; '); }
function renderInsights(){
  const fS=salesActive().filter(s=>s.nr===0||s.nr===1);
  const G={0:{n:0,f:0,prods:0,un:0,solo:0},1:{n:0,f:0,prods:0,un:0,solo:0}}, P={}, combos={};
  fS.forEach(s=>{ const its=insItems(s.prod), names=[...new Set(its.map(i=>i.p))], g=G[s.nr];
    g.n+=s.main; g.f+=s.val; g.prods+=names.length; g.un+=its.reduce((a,i)=>a+i.q,0); if(names.length===1) g.solo++;
    names.forEach(p=>{ const a=P[p]||(P[p]={n:0,r:0,solo:0,un:0}); if(s.nr===0){ a.n++; if(names.length===1) a.solo++; } else a.r++; });
    its.forEach(i=>{ if(s.nr===0) P[i.p].un+=i.q; });
    if(s.nr===0 && names.length>1){ const ns=names.slice().sort(); for(let i=0;i<ns.length;i++) for(let j=i+1;j<ns.length;j++){ const k=ns[i]+'\u0001'+ns[j]; combos[k]=(combos[k]||0)+1; } } });
  const NN=G[0].n, NR=G[1].n;
  const card=(g)=>[relCard('Pedidos',intf(g.n)),relCard('Ticket médio',brl(g.n?g.f/g.n:null)),relCard('Produtos por pedido',g.n?nf1.format(g.prods/g.n):'-'),
    relCard('Unidades por pedido',g.n?nf1.format(g.un/g.n):'-'),relCard('Pedidos com 1 produto',pct(g.n?g.solo/g.n:null)),relCard('% dos pedidos',pct((NN+NR)?g.n/(NN+NR):null))].join('');
  document.getElementById('insCardsN').innerHTML=card(G[0]); document.getElementById('insCardsR').innerHTML=card(G[1]);
  /* produtos + perfis */
  const rows=Object.entries(P).map(([p,a])=>{ const sn=NN?a.n/NN:0, sr=NR?a.r/NR:0, solo=a.n?a.solo/a.n:null, tags=[];
    if(a.n>=INS_MIN && solo>=0.5) tags.push('ent'); if(a.n>=INS_MIN && solo<=0.25) tags.push('comp');
    if(a.n>=INS_MIN && (sr===0 || sn/sr>=1.5)) tags.push('novo'); if(a.r>=INS_MIN && (sn===0 || sr/sn>=1.5)) tags.push('rec');
    const rank=HIST_RANK[insNorm(p)]||null;
    return {p,a,sn,sr,solo,tags,rank}; });
  const LBL={ent:'Entrada',comp:'Complemento',novo:'Atrai novos',rec:'Recompra'};
  const chips=t=>t.tags.length?t.tags.map(x=>`<span class="chip-p ${x}">${LBL[x]}</span>`).join(''):((t.a.n+t.a.r)<INS_MIN?'<span class="chip-p low">pouco volume</span>':'<span class="chip-p low">misto</span>');
  rows.sort((x,y)=>y.a.n-x.a.n||y.a.r-x.a.r);
  renderTable({id:'insProd', cols:[{key:'prod',label:'Produto',type:'dim',big:true},{key:'n',label:'Pedidos novos',type:'int',w:110,heat:'fat'},{key:'sn',label:'% dos novos',type:'pct',w:100},
    {key:'solo',label:'% sozinho (novos)',type:'pct',w:130},{key:'r',label:'Pedidos recorrentes',type:'int',w:140},{key:'sr',label:'% dos recorrentes',type:'pct',w:130},
    {key:'perfil',label:'Perfil',type:'dim',w:210},{key:'rank',label:'# no histórico',type:'int',w:110}],
    rows:rows.map(t=>({k:t.p,cells:{prod:esc(t.p),n:t.a.n,sn:t.sn,solo:t.solo,r:t.a.r,sr:t.sr,perfil:chips(t),rank:t.rank}}))});
  document.getElementById('insHistRange').textContent = PH&&PH.de ? `pedidos pagos de ${brdate(PH.de)} a ${brdate(PH.ate)}; "-" = não encontrado no histórico` : 'histórico indisponível';
  /* combinações */
  const cb=Object.entries(combos).sort((a,b)=>b[1]-a[1]).slice(0,15);
  renderTable({id:'insCombo', cols:[{key:'a',label:'Produto A',type:'dim',big:true},{key:'b',label:'Produto B',type:'dim',big:true},{key:'q',label:'Pedidos',type:'int',w:90},{key:'pc',label:'% dos pedidos de novos com 2+ produtos',type:'pct',w:260}],
    rows:cb.map(([c,q])=>{ const [a,b]=c.split('\u0001'); return {k:c,cells:{a:esc(a),b:esc(b),q,pc:(NN-G[0].solo)?q/(NN-G[0].solo):null}}; })});
  /* leituras automáticas */
  const L=[], top=(tag,n)=>rows.filter(t=>t.tags.includes(tag)).slice(0,n);
  const nm=t=>`<b>${esc(t.p)}</b>`;
  if(NN+NR) L.push(`Clientes novos fizeram <b>${intf(NN)}</b> dos ${intf(NN+NR)} pedidos (${pct(NN/(NN+NR))}), com ticket de <b>${brl(NN?G[0].f/NN:null)}</b> contra ${brl(NR?G[1].f/NR:null)} dos recorrentes. <b>${pct(NN?G[0].solo/NN:null)}</b> dos novos compram um único produto (recorrentes: ${pct(NR?G[1].solo/NR:null)}).`);
  const ent=top('ent',4); if(ent.length) L.push(`<b>Produtos de entrada</b> — clientes novos compram sozinhos, ou seja, são o motivo da compra: ${insList(ent,t=>`${nm(t)} (${t.a.n} pedidos, ${pct(t.solo)} sozinho${t.rank?`, #${t.rank} no histórico`:''})`)}. São os melhores candidatos para anúncios de aquisição.`);
  const nov=rows.filter(t=>t.tags.includes('novo')&&!t.tags.includes('ent')).slice(0,3); if(nov.length) L.push(`<b>Atraem mais clientes novos que a base</b>: ${insList(nov,t=>`${nm(t)} (${pct(t.sn)} dos pedidos de novos × ${pct(t.sr)} dos recorrentes)`)}.`);
  const comp=top('comp',3); if(comp.length) L.push(`<b>Vão de carona</b> — aparecem bastante, mas quase sempre junto com outro produto: ${insList(comp,t=>`${nm(t)} (${pct(t.solo)} sozinho)`)}. Funcionam melhor como complemento, kit ou upsell do que como gancho do anúncio.`);
  const rec=top('rec',3).sort((x,y)=>y.a.r-x.a.r); if(rec.length) L.push(`<b>Produtos de recompra</b> — fortes na base e fracos entre novos: ${insList(rec,t=>`${nm(t)} (${pct(t.sr)} dos recorrentes × ${pct(t.sn)} dos novos)`)}. Bons para remarketing e e-mail para clientes.`);
  const cbTxt=c=>c.split('\u0001').map(x=>`<b>${esc(x)}</b>`).join(' <i>com</i> ');
  if(cb.length) L.push(`<b>Combinação mais comprada por clientes novos</b>: ${cbTxt(cb[0][0])} (${cb[0][1]} pedidos)${cb[1]?`; em seguida ${cbTxt(cb[1][0])} (${cb[1][1]})`:''}.`);
  if(PH&&PH.ranking){ const sold=new Set(Object.keys(P).map(insNorm)); const miss=PH.ranking.slice(0,10).map((p,i)=>({p,i})).filter(x=>!sold.has(insNorm(x.p))).slice(0,4);
    if(miss.length) L.push(`<b>Campeões do histórico sem nenhuma venda no período</b>: ${miss.map(x=>`#${x.i+1} ${esc(x.p)}`).join('; ')}. Vale conferir estoque, preço e se estão na oferta.`); }
  document.getElementById('insList').innerHTML=L.map(x=>`<li>${x}</li>`).join('')||'<li>Sem pedidos identificados no período.</li>';
  document.getElementById('insNote').innerHTML = (NN<100?`⚠️ Ainda são poucos pedidos de clientes novos no período (${intf(NN)}): trate as leituras como tendência. `:'')+
    `Leituras recalculadas a cada atualização da dashboard, sobre o período selecionado no topo. Perfis só aparecem com ${INS_MIN}+ pedidos no grupo.`;
}

/* ---------------- Faturamento por estado (precisa da coluna de estado na planilha) ---------------- */
function renderEstados(fS){
  const sec=document.getElementById('ufSection'); if(!sec) return;
  if(!B.has_state){ sec.style.display='none'; return; }
  const U={}; let tf=0, tq=0, semF=0, semQ=0;
  fS.forEach(s=>{ tf+=s.val; tq+=s.main; if(!s.uf){ semF+=s.val; semQ+=s.main; return; }
    const a=U[s.uf]||(U[s.uf]={q:0,f:0,n:0}); a.q+=s.main; a.f+=s.val; if(s.nr===0) a.n+=s.main; });
  hbar('gUf', Object.entries(U).map(([label,a])=>({label,v:a.f})), x=>x.v, cvar('--chart-faturamento'), 10, brl);
  const rows=Object.entries(U).sort((a,b)=>b[1].f-a[1].f).map(([uf,a])=>({k:uf,cells:{uf,f:a.f,pf:tf?a.f/tf:null,q:a.q,t:a.q?a.f/a.q:null,pn:(HAS_NR&&a.q)?a.n/a.q:null}}));
  const cols=[{key:'uf',label:'UF',type:'dim',w:60},{key:'f',label:'Faturamento',type:'brl',w:120,heat:'fat'},{key:'pf',label:'% fat.',type:'pct',w:80},
    {key:'q',label:'Pedidos',type:'int',w:80},{key:'t',label:'Ticket',type:'brl',w:100}].concat(HAS_NR?[{key:'pn',label:'% novos',type:'pct',w:90}]:[]);
  renderTable({id:'gUfTbl', cols, rows});
  document.getElementById('ufHint').textContent = semQ ? `${intf(semQ)} pedido(s) (${brl(semF)}) sem estado na planilha ficaram de fora.` : 'Clique no cabeçalho para ordenar.';
}

/* ---------------- PAGE 1: Visão Geral ---------------- */
function renderGeral(){
  const fM=metaActive(), fS=salesActive();          // fS = todas as vendas do funil
  const t=totals(fS,fM), d=derive(t);
  const pw=prevWindow();
  const tp = pw ? totals(SALES.filter(s=>inRange(s.d,pw.from,pw.to)), META.filter(m=>inRange(m.d,pw.from,pw.to))) : null;
  renderFunnel('geralFunnel', funnelSteps(t, tp));
  const dd=daily(fS,fM);
  convCharts('gCpmCtr','gCrVis','gConv', dd);
  comboChart('gCombo', dd);
  renderProdTable('gProd', fS);

  if(CLIENT) renderCreatives('gCreat', fS.filter(s=>s.meta), fM);
  renderOrigens(fS);
  renderEstados(fS);
  renderNovosRecorrentes(fS);
  renderWhen(fS, fM);

  const dl=dd.slice().reverse();
  renderTable({id:'gDaily', cols:DAILY_COLS,
    rows:dl.map(x=>{const dv=derive(x); return {k:x.d, cells:dailyCells(x,dv)};}),
    total:dailyCells(t,d,true),
    selectable:true, selSet:STATE.selDays,
    onSelect:(k,e)=>{ toggleSet(STATE.selDays,k,e&&(e.ctrlKey||e.metaKey)); syncDateInputs(); renderAll(); },
  });
}

/* ---------------- PAGE 2: Meta Ads ---------------- */
function metaScope(ex){ let fM=metaActive(), fS=salesActive().filter(s=>s.meta);   // só Meta Ads
  if(ex!=='C'&&STATE.mSelC.size){ fM=fM.filter(r=>STATE.mSelC.has(r.camp)); fS=fS.filter(r=>STATE.mSelC.has(r.camp)); }
  if(ex!=='A'&&STATE.mSelA.size){ fM=fM.filter(r=>STATE.mSelA.has(r.adset)); fS=fS.filter(r=>STATE.mSelA.has(r.adset)); }
  if(ex!=='D'&&STATE.mSelAd.size){ fM=fM.filter(r=>STATE.mSelAd.has(r.ad)); fS=fS.filter(r=>STATE.mSelAd.has(r.ad)); }
  return {fM,fS}; }
function selDim(dim,key,ctrl){
  const sets={C:STATE.mSelC,A:STATE.mSelA,D:STATE.mSelAd}, s=sets[dim];
  if(ctrl){ s.has(key)?s.delete(key):s.add(key); }
  else { const sole=s.has(key)&&s.size===1&&!Object.entries(sets).some(([k2,x])=>k2!==dim&&x.size);
    Object.values(sets).forEach(x=>x.clear()); if(!sole) s.add(key); }
  renderMeta();
}
function metaPrevTotals(pw){
  let fM=META.filter(m=>inRange(m.d,pw.from,pw.to));
  let fS=SALES.filter(s=>s.meta && inRange(s.d,pw.from,pw.to));
  if(STATE.mSelC.size){fM=fM.filter(r=>STATE.mSelC.has(r.camp));fS=fS.filter(r=>STATE.mSelC.has(r.camp));}
  if(STATE.mSelA.size){fM=fM.filter(r=>STATE.mSelA.has(r.adset));fS=fS.filter(r=>STATE.mSelA.has(r.adset));}
  if(STATE.mSelAd.size){fM=fM.filter(r=>STATE.mSelAd.has(r.ad));fS=fS.filter(r=>STATE.mSelAd.has(r.ad));}
  return totals(fS,fM);
}
function renderMeta(){
  const F=metaScope(null), fM=F.fM, fS=F.fS;
  const t=totals(fS,fM), d=derive(t);
  const pw=prevWindow(); const tp = pw ? metaPrevTotals(pw) : null;
  renderFunnel('metaFunnel', funnelSteps(t, tp));

  const dd=daily(fS,fM);
  convCharts('mCpmCtr','mCrVis','mConv', dd);
  comboChart('mCombo', dd);
  const aggAd=buildAgg(fS,fM,'ad');
  hbar('mContent', Object.entries(aggAd).map(([label,a])=>({label,v:a.fat})), x=>x.v, cvar('--chart-faturamento'), 10, brl);
  renderProdTable('mProd', fS);

  const dl=dd.slice().reverse();
  renderTable({id:'tDaily', cols:costHeat(DAILY_COLS),
    rows:dl.map(x=>{const dv=derive(x); return {k:x.d, cells:dailyCells(x,dv)};}),
    total:dailyCells(t,d,true),
    selectable:true, selSet:STATE.selDays,
    onSelect:(k,e)=>{ toggleSet(STATE.selDays,k,e&&(e.ctrlKey||e.metaKey)); syncDateInputs(); renderAll(); },
  });

  function hierRows(map){ return Object.entries(map).map(([k,a])=>{const dv=derive(a);
    return {k, cells:Object.assign({dim:k}, metricCells(a,dv))};}); }
  function totRowOf(tt){const dv=derive(tt);return Object.assign({dim:null}, metricCells(tt,dv));}
  const Sc=metaScope('C'), Sa=metaScope('A'), Sd=metaScope('D');
  renderTable({id:'tCamp', cols:costHeat(HCOLS.map((c,i)=>i===0?{...c,label:'Campanha'}:c)), rows:hierRows(buildAgg(Sc.fS,Sc.fM,'camp')), total:totRowOf(totals(Sc.fS,Sc.fM)),
    selectable:true, selSet:STATE.mSelC, onSelect:(k,e)=>selDim('C',k,e&&(e.ctrlKey||e.metaKey))});
  renderTable({id:'tAdset', cols:costHeat(HCOLS.map((c,i)=>i===0?{...c,label:'Conjunto',big:true}:c)), rows:hierRows(buildAgg(Sa.fS,Sa.fM,'adset')), total:totRowOf(totals(Sa.fS,Sa.fM)),
    selectable:true, selSet:STATE.mSelA, onSelect:(k,e)=>selDim('A',k,e&&(e.ctrlKey||e.metaKey))});
  renderTable({id:'tAd', cols:costHeat(HCOLS.map((c,i)=>i===0?{...c,label:'Anúncio'}:c)), rows:hierRows(buildAgg(Sd.fS,Sd.fM,'ad')), total:totRowOf(totals(Sd.fS,Sd.fM)),
    selectable:true, selSet:STATE.mSelAd, onSelect:(k,e)=>selDim('D',k,e&&(e.ctrlKey||e.metaKey))});

  /* cada gráfico segue a dimensão da tabela acima (mesmos dados escopados) */
  cacDimChart('chCamp', Sc.fM, Sc.fS, 'camp');
  cacDimChart('chAdset', Sa.fM, Sa.fS, 'adset');
  cacDimChart('chAd', Sd.fM, Sd.fS, 'ad');

  const vendas=fS.reduce((s,r)=>s+r.main,0);
  document.getElementById('qCount').textContent=vendas+' vendas · '+fS.length+' linhas';
  const rows=fS.slice().sort((a,b)=>(a.d<b.d?1:-1));
  renderTable({id:'tQual',
    cols:[{key:'d',label:'Data',type:'date'},{key:'nm',label:'Nome',type:'dim'},{key:'prod',label:'Produto',type:'dim',big:true},
      {key:'val',label:'Valor',type:'brl',w:110},{key:'camp',label:'Campanha',type:'dim',big:true},{key:'ad',label:'Anúncio',type:'dim',big:true},{key:'em',label:'E‑mail',type:'dim',w:200}],
    rows:rows.map((s,i)=>({k:'s'+i, cells:{d:s.d,nm:s.nm,prod:s.prod,val:s.val,camp:s.camp,ad:s.ad,em:s.em}}))});
}

/* ---------------- PAGE: Relatórios ----------------
   Reaproveita os mesmos dados/filtros das outras abas (metaActive/salesActive).
   Total  = todas as vendas do funil.  Tráfego = só Meta Ads (s.meta).
   Código de cor aplicado APENAS a CAC e ROAS (metas em build.py). */
const CAC_TARGET=B.cac_target, ROAS_TARGET=B.roas_target;
const REL_BAND_LO=(B.report_band_low!=null?B.report_band_low:0.7);
const REL_BAND_HI=(B.report_band_high!=null?B.report_band_high:1.3);
const AD_LINKS=DATA.ad_links||{};
/* desempenho vs meta: CAC menor=melhor (meta/valor); ROAS maior=melhor (valor/meta) */
function relPerf(v,kind){
  if(v==null||!isFinite(v)) return null;
  if(kind==='roas'){ return ROAS_TARGET?v/ROAS_TARGET:null; }
  return (CAC_TARGET&&v>0)?CAC_TARGET/v:null;
}
function relColor(v,kind){ const p=relPerf(v,kind); if(p==null) return '';
  if(p<REL_BAND_LO) return 'rc-red'; if(p<1) return 'rc-yellow';
  if(p<REL_BAND_HI) return 'rc-green'; return 'rc-cyan'; }
function relCard(label,val,hero){ return `<div class="rel-card${hero?' hero':''}"><div class="rl">${label}</div><div class="rv">${val}</div></div>`; }
function relCards(id,t){ const d=derive(t);
  document.getElementById(id).innerHTML=[
    relCard('Valor Gasto',brl(d.gasto)),
    relCard('Vendas',intf(t.vendas)),
    relCard('Faturamento',brl(t.fat)),
    relCard('CAC (Custo/Compra)',`<span class="${relColor(d.cac,'cac')}">${brl(d.cac)}</span>`),
    relCard('Ticket Médio',brl(d.ticket)),
    relCard('ROAS',`<span class="${relColor(d.roas,'roas')}">${roasf(d.roas)}</span>`,true),
  ].join('');
}
/* tabela estática simples (cols/rows/foot = [{v,cls}]) — mantém a estética .dt */
function relRenderTable(id,cols,rows,foot){
  const el=document.getElementById(id); if(!el) return;
  const th='<thead><tr>'+cols.map(c=>`<th class="${c.cls||''}">${c.label}</th>`).join('')+'</tr></thead>';
  const tb='<tbody>'+(rows.length?rows.map(r=>'<tr>'+r.map(c=>`<td class="${c.cls||''}">${c.v}</td>`).join('')+'</tr>').join('')
    :`<tr><td class="dim" colspan="${cols.length}" style="color:var(--muted)">Sem dados no período.</td></tr>`)+'</tbody>';
  const tf=foot?('<tfoot><tr>'+foot.map(c=>`<td class="${c.cls||''}">${c.v}</td>`).join('')+'</tr></tfoot>'):'';
  el.innerHTML=th+tb+tf;
}
function adLink(name){ const u=AD_LINKS[name];
  return u?`<a class="rel-adlink" href="${esc(u)}" target="_blank" rel="noopener">Abrir ▸</a>`:'<span class="rel-adlink off">—</span>'; }
function relBriefKey(){ if(STATE.selDays.size) return null; return STATE.preset||null; }
function renderRelBrief(){
  const wrap=document.getElementById('relBrief'), stampEl=document.getElementById('relBriefStamp');
  const bf=DATA.briefings||{}, per=bf.periodos||{}, key=relBriefKey();
  stampEl.textContent = bf.generated_at ? `Briefing gerado por IA · última atualização ${bf.generated_at} · atualiza 1×/dia às 23h59` : '';
  if(!Object.keys(per).length){
    wrap.innerHTML='<div class="rel-brief-empty">O briefing por IA ainda não foi gerado. Ele é atualizado automaticamente 1×/dia às 23h59.</div>'; return; }
  if(!key || !per[key]){
    wrap.innerHTML='<div class="rel-brief-empty">Briefing disponível para os períodos predefinidos (Hoje, Ontem, 3&nbsp;dias, 7&nbsp;dias, 14&nbsp;dias, 30&nbsp;dias, Este mês, Mês passado, Todo período). Selecione um desses botões no topo.</div>'; return; }
  const item=per[key];
  wrap.innerHTML = item.html || item.texto || '<div class="rel-brief-empty">Sem conteúdo.</div>';
}
function renderRelatorios(){
  const fM=metaActive(), fSall=salesActive(), fSads=fSall.filter(s=>s.meta);
  const tTot=totals(fSall,fM), tAds=totals(fSads,fM);
  const dvT=derive(tTot), dvA=derive(tAds);

  /* cabeçalho do período */
  const pr=PRESETS.find(p=>p[0]===STATE.preset);
  document.getElementById('relPeriodName').textContent = STATE.selDays.size?'Dias selecionados':(pr?pr[1]:'Personalizado');
  let rangeTxt='';
  if(STATE.from&&STATE.to){ const nD=Math.round((new Date(STATE.to+'T00:00:00')-new Date(STATE.from+'T00:00:00'))/86400000)+1;
    rangeTxt=`${brdate(STATE.from)} a ${brdate(STATE.to)}`+(nD>0?` · ${nD} dia${nD>1?'s':''}`:''); }
  document.getElementById('relPeriodRange').textContent=rangeTxt;

  /* cards */
  relCards('relCardsTotal',tTot);
  relCards('relCardsAds',tAds);

  /* tabela diária resumida (Total | Ads) */
  const ddTot=daily(fSall,fM), ddAds={}; daily(fSads,fM).forEach(x=>ddAds[x.d]=x);
  const dcols=[{label:'Data'},{label:'Dia',cls:'dim'},{label:'Gasto'},{label:'Vendas Totais'},{label:'CAC Total'},{label:'ROAS Total'},
    {label:'Vendas Ads',cls:'sep-col'},{label:'CAC Ads'},{label:'ROAS Ads'}];
  const drows=ddTot.slice().reverse().map(x=>{ const dv=derive(x), a=ddAds[x.d], da=a?derive(a):null;
    const cacA=da?da.cac:null, roasA=da?da.roas:null;
    return [{v:brdate(x.d),cls:'dim'},{v:weekday(x.d),cls:'dim'},{v:brl(dv.gasto)},{v:intf(x.vendas)},
      {v:brl(dv.cac),cls:relColor(dv.cac,'cac')},{v:roasf(dv.roas),cls:relColor(dv.roas,'roas')},
      {v:intf(a?a.vendas:0),cls:'sep-col'},{v:brl(cacA),cls:relColor(cacA,'cac')},{v:roasf(roasA),cls:relColor(roasA,'roas')}]; });
  const dfoot=[{v:'Total',cls:'dim'},{v:'',cls:'dim'},{v:brl(dvT.gasto)},{v:intf(tTot.vendas)},
    {v:brl(dvT.cac),cls:relColor(dvT.cac,'cac')},{v:roasf(dvT.roas),cls:relColor(dvT.roas,'roas')},
    {v:intf(tAds.vendas),cls:'sep-col'},{v:brl(dvA.cac),cls:relColor(dvA.cac,'cac')},{v:roasf(dvA.roas),cls:relColor(dvA.roas,'roas')}];
  relRenderTable('relDaily',dcols,drows,dfoot);

  /* visão por campanha (só Meta Ads) */
  const aggC=buildAgg(fSads,fM,'camp');
  const crows=Object.entries(aggC).sort((a,b)=>b[1].sp-a[1].sp).map(([name,ag])=>{ const d=derive(ag);
    return [{v:esc(name),cls:'dim'},{v:brl(d.gasto)},{v:intf(ag.vendas)},
      {v:roasf(d.roas),cls:relColor(d.roas,'roas')},{v:brl(d.cac),cls:relColor(d.cac,'cac')},
      {v:brl(d.cpm)},{v:pct(d.ctr)},{v:brl(d.cpv)},{v:pct(d.cr)}].concat(HAS_ATC?[{v:brl(d.cpatc)},{v:pct(d.txatc)}]:[]).concat(
      [{v:brl(d.cpic)},{v:pct(HAS_ATC?d.txck:d.vischk)},{v:pct(d.convchk)},{v:pct(d.convlp)}]); });
  relRenderTable('relCamp',
    [{label:'Campanha',cls:'dim'},{label:'Gasto'},{label:'Venda'},{label:'ROAS'},{label:'Custo/Compra'},{label:'CPM'},{label:'CTR'},{label:'Custo/View'},{label:'Connect Rate'}]
      .concat(HAS_ATC?[{label:'Custo/Carrinho'},{label:'Tx Carrinho'}]:[])
      .concat([{label:'Custo/Checkout'},{label:'Tx Checkout'},{label:'Tx Compra'},{label:'Tx Conversão'}]),
    crows,
    [{v:'Total',cls:'dim'},{v:brl(dvA.gasto)},{v:intf(tAds.vendas)},{v:roasf(dvA.roas),cls:relColor(dvA.roas,'roas')},{v:brl(dvA.cac),cls:relColor(dvA.cac,'cac')},
     {v:brl(dvA.cpm)},{v:pct(dvA.ctr)},{v:brl(dvA.cpv)},{v:pct(dvA.cr)}].concat(HAS_ATC?[{v:brl(dvA.cpatc)},{v:pct(dvA.txatc)}]:[]).concat(
     [{v:brl(dvA.cpic)},{v:pct(HAS_ATC?dvA.txck:dvA.vischk)},{v:pct(dvA.convchk)},{v:pct(dvA.convlp)}]));

  /* top / piores anúncios (só Meta Ads, com gasto no período) */
  const aggAd=buildAgg(fSads,fM,'ad');
  const ads=Object.entries(aggAd).filter(([n,ag])=>ag.sp>0).map(([name,ag])=>{ const d=derive(ag);
    return {name,gasto:d.gasto,vendas:ag.vendas,cac:d.cac,roas:d.roas}; });
  ads.sort((a,b)=>{ const ra=a.roas==null?-1:a.roas, rb=b.roas==null?-1:b.roas; if(rb!==ra) return rb-ra;
    const ca=a.cac==null?Infinity:a.cac, cb=b.cac==null?Infinity:b.cac; return ca-cb; });
  const top=ads.slice(0,5), topSet=new Set(top.map(a=>a.name));
  const worst=ads.filter(a=>!topSet.has(a.name)).slice(-5).reverse();
  const adCols=[{label:'Anúncio',cls:'dim'},{label:'Gasto'},{label:'Vendas'},{label:'CAC'},{label:'ROAS'},{label:'Link',cls:'dim'}];
  const adRows=list=>list.map(a=>[{v:esc(a.name),cls:'dim'},{v:brl(a.gasto)},{v:intf(a.vendas)},
    {v:brl(a.cac),cls:relColor(a.cac,'cac')},{v:roasf(a.roas),cls:relColor(a.roas,'roas')},{v:adLink(a.name),cls:'dim'}]);
  relRenderTable('relTop',adCols,adRows(top));
  relRenderTable('relWorst',adCols,adRows(worst));

  /* briefing do gestor (texto pré-gerado por IA) */
  renderRelBrief();
}

/* ---------------- PAGE 3: IA Insights ---------------- */
const r2=v=>(v==null||!isFinite(v))?null:Math.round(v*100)/100;
const r4=v=>(v==null||!isFinite(v))?null:Math.round(v*10000)/10000;
const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function iaMetricRow(x,d){
  return {gasto:r2(d.gasto),impressoes:x.im,cpm:r2(d.cpm),cliques:x.cl,cpc:r2(d.cpc),ctr:r4(d.ctr),
    page_views:x.pv,cpv:r2(d.cpv),cr:r4(d.cr),carrinhos:x.atc,cpatc:r2(d.cpatc),txatc:r4(d.txatc),txck:r4(d.txck),checkouts:x.ck,cpic:r2(d.cpic),vischk:r4(d.vischk),
    convlp:r4(d.convlp),vendas:x.vendas,cac:r2(d.cac),convchk:r4(d.convchk),
    faturamento:r2(x.fat),roas:r2(d.roas),ticket:r2(d.ticket)};
}
/* janela própria da IA — independente do filtro de período das outras abas */
const IA_WINDOWS=[['3d',3,'3 dias'],['7d',7,'7 dias'],['14d',14,'14 dias'],['30d',30,'30 dias']];
function iaWinDays(){ const w=IA_WINDOWS.find(x=>x[0]===STATE.iaWin); return w?w[1]:14; }
function iaRenderWin(){
  document.getElementById('iaWin').innerHTML=IA_WINDOWS.map(w=>
    `<button class="chip ${STATE.iaWin===w[0]?'active':''}" data-w="${w[0]}">${w[2]}</button>`).join('');
  document.querySelectorAll('#iaWin .chip').forEach(c=>c.addEventListener('click',()=>{
    STATE.iaWin=c.dataset.w; localStorage.setItem('ia_win',STATE.iaWin); iaRenderWin();
  }));
}
function iaSumBuckets(arr){ const a=newBucket(); arr.forEach(x=>{a.sp+=x.sp;a.im+=x.im;a.cl+=x.cl;a.pv+=x.pv;a.ck+=x.ck;a.atc+=x.atc;a.vendas+=x.vendas;a.vendasM+=x.vendasM;a.fat+=x.fat;}); return a; }
function iaPctDelta(a,b){ return (a==null||b==null||!isFinite(a)||!isFinite(b)||b===0)?null:+(((a-b)/b)*100).toFixed(1); }
function iaCmp(dR,dP,k){ return {recente:r2(dR[k]), anterior:r2(dP[k]), variacao_pct:iaPctDelta(dR[k],dP[k])}; }
function iaBuildData(){
  const winDays=iaWinDays(), from=addDays(TODAY,-(winDays-1)), to=TODAY;
  const inWin=d=>d && d>=from && d<=to;
  const fM=META.filter(m=>inWin(m.d)), fSall=SALES.filter(s=>inWin(s.d)), fSmeta=fSall.filter(s=>s.meta);
  const t=totals(fSall,fM), tm=totals(fSmeta,fM);
  const byProd={}; fSmeta.forEach(s=>{byProd[s.prod]=(byProd[s.prod]||0)+1;});

  /* --- séries diárias e janelas de tendência (escopo Meta) --- */
  const dd=daily(fSmeta,fM);                              // buckets diários (asc)
  const serie=dd.slice(-90).map(x=>{const dv=derive(x); return {d:x.d, gasto:r2(dv.gasto), cpm:r2(dv.cpm),
    ctr:r4(dv.ctr), cr:r4(dv.cr), txatc:r4(dv.txatc), txck:r4(dv.txck), vischk:r4(dv.vischk), convchk:r4(dv.convchk),
    vendas:x.vendas, cac:r2(dv.cac), fat:r2(x.fat), roas:r2(dv.roas)};});
  const days=dd.map(x=>x.d), n=days.length, half=Math.max(1,Math.floor(n/2));
  let comparativo=null, recentSet=null, prevSet=null;
  if(n>=2){
    recentSet=new Set(days.slice(n-half));
    prevSet=new Set(days.slice(Math.max(0,n-2*half), n-half));
    const R=iaSumBuckets(dd.filter(x=>recentSet.has(x.d))), P=iaSumBuckets(dd.filter(x=>prevSet.has(x.d)));
    const dR=derive(R), dP=derive(P);
    comparativo={
      dias_por_janela:half,
      janela_recente:{de:days[n-half], ate:days[n-1]},
      janela_anterior:prevSet.size?{de:days[Math.max(0,n-2*half)], ate:days[n-half-1]}:null,
      cpm:iaCmp(dR,dP,'cpm'), ctr:iaCmp(dR,dP,'ctr'), cr:iaCmp(dR,dP,'cr'),
      txatc:iaCmp(dR,dP,'txatc'), txck:iaCmp(dR,dP,'txck'), cpatc:iaCmp(dR,dP,'cpatc'),
      vischk:iaCmp(dR,dP,'vischk'), convchk:iaCmp(dR,dP,'convchk'),
      cac:iaCmp(dR,dP,'cac'), roas:iaCmp(dR,dP,'roas'), gasto:iaCmp(dR,dP,'gasto'),
      vendas:{recente:R.vendas, anterior:P.vendas, variacao_pct:iaPctDelta(R.vendas,P.vendas)},
    };
  }
  /* top estruturas + tendência recente vs anterior */
  function topTrend(dim,lim){
    const map=buildAgg(fSmeta,fM,dim);
    const aggR = recentSet ? buildAgg(fSmeta.filter(r=>recentSet.has(r.d)), fM.filter(r=>recentSet.has(r.d)), dim) : {};
    const aggP = prevSet   ? buildAgg(fSmeta.filter(r=>prevSet.has(r.d)),   fM.filter(r=>prevSet.has(r.d)),   dim) : {};
    return Object.entries(map).sort((a,b)=>b[1].sp-a[1].sp).slice(0,lim).map(([nome,a])=>{
      const row=Object.assign({nome}, iaMetricRow(a,derive(a)));
      if(comparativo){
        const dvR=aggR[nome]?derive(aggR[nome]):null, dvP=aggP[nome]?derive(aggP[nome]):null;
        row.tendencia={
          cac_recente:dvR?r2(dvR.cac):null, cac_anterior:dvP?r2(dvP.cac):null,
          roas_recente:dvR?r2(dvR.roas):null, roas_anterior:dvP?r2(dvP.roas):null,
          gasto_recente:dvR?r2(dvR.gasto):null, gasto_anterior:dvP?r2(dvP.gasto):null };
      }
      return row;
    });
  }

  return {
    periodo:{de:from,ate:to,janela_ia:STATE.iaWin,dias_no_periodo:n},
    imposto_meta_aplicado: STATE.tax,
    obs:"Taxas em fração 0-1. cr=Connect Rate=PageViews/Cliques; txatc=Carrinhos/PageViews; txck=Checkouts/Carrinhos; cpatc=Gasto/Carrinhos; vischk=Checkouts/PageViews; convlp=Taxa de conversão=Vendas/PageViews; convchk=Taxa de compra=Vendas/Checkouts; cac=Custo por compra. total_todas_vendas inclui vendas orgânicas; conversões e estruturas consideram apenas Meta Ads. "+(ALL_MAIN?"E-commerce: cada pedido pago = 1 venda (sem produto principal).":"Produto principal = "+MAIN_PRODUCT+".")+" comparativo_periodo compara a janela recente vs a anterior (mesmo nº de dias) — use para detectar SATURAÇÃO/fadiga (ex.: CPM subindo + CTR/ROAS caindo). serie_diaria = evolução dia a dia. variacao_pct = variação % recente vs anterior. Cada estrutura traz 'tendencia' (recente vs anterior).",
    total_todas_vendas: iaMetricRow(t,derive(t)),
    total_meta_ads: iaMetricRow(tm,derive(tm)),
    comparativo_periodo: comparativo,
    serie_diaria: serie,
    campanhas: topTrend('camp',10),
    conjuntos: topTrend('adset',10),
    anuncios: topTrend('ad',15),
    vendas_por_produto: Object.entries(byProd).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([produto,vendas])=>({produto,vendas})),
  };
}
function iaBackendUrl(){ return iaNormUrl(localStorage.getItem('ia_backend')||B.ia_worker_url||''); }
function iaStatusText(){
  const b=iaBackendUrl(), p=localStorage.getItem('ia_pass');
  document.getElementById('iaStatus').textContent = b ? '' : 'backend não configurado — clique em Configurar';
  document.getElementById('iaGen').disabled = !(b&&p);
}
function iaShow(html){ document.getElementById('iaCards').innerHTML=html; }
function iaFmtDate(ts){ try{ return new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(_){ return ''; } }
function iaRenderCards(insights,usage,at,from,to){
  if(!insights.length){ iaShow('<div class="ia-empty">A IA não retornou insights.</div>'); return; }
  const stamp = at ? `<div class="ia-empty" style="grid-column:1/-1;text-align:left">Gerado em ${iaFmtDate(at)}${from&&to?` · janela ${esc(from)} a ${esc(to)}`:''}</div>` : '';
  const sev=s=>['alta','media','baixa'].includes(String(s))?s:'baixa';
  const cards=insights.map(i=>{
    const s=sev(i.severidade); let verba='';
    if(i.verba && i.verba.acao && i.verba.acao!=='manter'){
      const v=i.verba, pct=(v.percentual!=null?(' '+Math.abs(v.percentual)+'%'):'');
      verba=`<div class="ins-verba">💰 <b>Verba:</b> ${esc(v.acao)}${pct} ${v.nivel_ajuste?('no '+esc(v.nivel_ajuste)):''}${v.observacao?(' — '+esc(v.observacao)):''}<span class="ins-apply">Peça no chat para eu aplicar no Meta Ads.</span></div>`;
    }
    return `<div class="ins-card sev-${s}">
      <div class="ins-head"><span class="ins-badge">${esc(i.nivel||'funil')} · ${esc(i.metrica||'')}</span><span class="ins-sev">${esc(s)}</span></div>
      <div class="ins-title">${esc(i.titulo||'')}</div>
      <div class="ins-diag">${esc(i.diagnostico||'')}</div>
      <div class="ins-rec"><b>Ação:</b> ${esc(i.recomendacao||'')}</div>
      ${i.estrutura?`<div class="ins-struct">Estrutura: ${esc(i.estrutura)}</div>`:''}
      ${verba}
    </div>`;
  }).join('');
  const u = usage ? `<div class="ia-empty" style="grid-column:1/-1">Tokens: entrada ${usage.input_tokens||'?'} · saída ${usage.output_tokens||'?'}</div>` : '';
  iaShow(stamp+cards+u);
}
function iaNormUrl(u){ u=(u||'').trim(); if(u && !/^https?:\/\//i.test(u)) u='https://'+u; return u; }
async function iaGenerate(){
  const backend=iaBackendUrl(), pass=localStorage.getItem('ia_pass');
  if(!backend||!pass){ document.getElementById('iaConfig').style.display='block'; return; }
  const btn=document.getElementById('iaGen'); btn.classList.add('loading'); btn.disabled=true;
  iaShow('<div class="ia-empty">Gerando insights com a IA… (pode levar alguns segundos)</div>');
  try{
    const res=await fetch(backend,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pass,data:iaBuildData()})});
    const txt=await res.text(); let j=null; try{ j=JSON.parse(txt); }catch{}
    if(!j){ iaShow('<div class="ins-card err"><div class="ins-title">Resposta inválida do backend</div><div class="ins-diag">HTTP '+res.status+'. A URL do Worker pode estar errada ou o Worker não está publicado. Abra a URL no navegador: deve mostrar <code>{"error":"Use GET ou POST."}</code>.</div><div class="ins-struct">'+esc(txt.slice(0,200))+'</div></div>'); return; }
    if(!res.ok || j.error){
      const extra=[]; if(j.detail) extra.push(String(j.detail)); if(j.stop_reason) extra.push('stop_reason='+j.stop_reason); if(j.raw) extra.push('Resposta do modelo: '+String(j.raw));
      iaShow('<div class="ins-card err"><div class="ins-title">Erro</div><div class="ins-diag">'+esc(j.error||('HTTP '+res.status))+'</div>'+(extra.length?('<div class="ins-struct" style="white-space:pre-wrap">'+esc(extra.join('\n').slice(0,1200))+'</div>'):'')+'</div>');
    }
    else {
      iaRenderCards(j.insights||[], j.usage, j.at||Date.now(), j.from, j.to);
    }
  }catch(e){ iaShow('<div class="ins-card err"><div class="ins-title">Falha de rede</div><div class="ins-diag">'+esc(e.message)+' — a URL deve começar com https:// e terminar em .workers.dev, e o Worker precisa estar publicado (CORS).</div></div>'); }
  finally{ btn.classList.remove('loading'); btn.disabled=false; }
}
async function iaLoadLatest(){
  const backend=iaBackendUrl();
  if(!backend){ iaShow('<div class="ia-empty">Configure o backend e clique em <b>Gerar insights</b>.</div>'); return; }
  iaShow('<div class="ia-empty">Carregando insights…</div>');
  try{
    const res=await fetch(backend,{method:'GET'});
    const j=await res.json().catch(()=>null);
    if(j && Array.isArray(j.insights) && j.insights.length){ iaRenderCards(j.insights, j.usage, j.at, j.from, j.to); }
    else { iaShow('<div class="ia-empty">Nenhum insight gerado ainda. Clique em <b>Gerar insights</b>.</div>'); }
  }catch(e){ iaShow('<div class="ia-empty">Não foi possível carregar os insights agora. Clique em <b>Gerar insights</b>.</div>'); }
}
function renderIA(){ iaStatusText(); iaRenderWin(); iaLoadLatest(); }

/* ---------------- date presets ---------------- */
const PRESETS=[
  ['hoje','Hoje',()=>[TODAY,TODAY]],
  ['ontem','Ontem',()=>[addDays(TODAY,-1),addDays(TODAY,-1)]],
  ['3d','3 dias',()=>[addDays(TODAY,-2),TODAY]],
  ['7d','7 dias',()=>[addDays(TODAY,-6),TODAY]],
  ['14d','14 dias',()=>[addDays(TODAY,-13),TODAY]],
  ['30d','30 dias',()=>[addDays(TODAY,-29),TODAY]],
  ['mes','Este mês',()=>{const [y,m]=TODAY.split('-');return [`${y}-${m}-01`,TODAY];}],
  ['mespass','Mês passado',()=>{const dt=new Date(TODAY+'T00:00:00');const f=new Date(dt.getFullYear(),dt.getMonth()-1,1);const l=new Date(dt.getFullYear(),dt.getMonth(),0);return [dstr(f),dstr(l)];}],
  ['todo','Máximo',()=>[B.date_min,B.date_max]],
];
/* rótulo do botão de período — mostra o intervalo aplicado dentro do próprio botão */
function syncDateInputs(){
  const el=document.getElementById('periodBtnLabel'); if(!el) return;
  if(STATE.selDays.size){ el.textContent=STATE.selDays.size+(STATE.selDays.size>1?' dias selecionados':' dia selecionado'); return; }
  const pr=PRESETS.find(p=>p[0]===STATE.preset);
  if(STATE.from&&STATE.to) el.textContent=brdate(STATE.from)+' – '+brdate(STATE.to)+(pr?' · '+pr[1]:'');
  else el.textContent='Selecionar período';
}
function applyPreset(id){ const p=PRESETS.find(x=>x[0]===id); if(!p)return; const [f,t]=p[2]();
  STATE.from=f; STATE.to=t; STATE.preset=id; STATE.selDays.clear(); ppClose(); syncDateInputs(); renderAll(); }

/* ---- popover do seletor de período (estilo Data Studio) ---- */
const MONTHS_PT=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW_PT=['D','S','T','Q','Q','S','S'];
const PP={from:null,to:null,preset:'',fromView:'',toView:''};
function ymView(ds){ return (ds||TODAY).slice(0,7); }
function shiftView(view,delta){ const [y,m]=view.split('-').map(Number); const dt=new Date(y,m-1+delta,1); return dt.getFullYear()+'-'+pad(dt.getMonth()+1); }
function ppIsOpen(){ const pop=document.getElementById('periodPop'); return pop && !pop.hidden; }
function ppOpen(){
  PP.from=STATE.from; PP.to=STATE.to; PP.preset=STATE.selDays.size?'':STATE.preset;
  PP.fromView=ymView(STATE.from); PP.toView=ymView(STATE.to);
  document.getElementById('periodPop').hidden=false;
  document.getElementById('periodBtn').setAttribute('aria-expanded','true');
  ppRenderAll();
}
function ppClose(){ const pop=document.getElementById('periodPop'); if(pop) pop.hidden=true;
  const b=document.getElementById('periodBtn'); if(b) b.setAttribute('aria-expanded','false'); }
function ppRenderAll(){ ppRenderPresets(); ppRenderCal('from'); ppRenderCal('to'); ppRenderRange(); }
function ppRenderPresets(){
  const host=document.getElementById('ppPresets');
  host.innerHTML=PRESETS.map(p=>`<button class="pp-preset ${PP.preset===p[0]?'active':''}" data-p="${p[0]}">${p[1]}</button>`).join('');
  host.querySelectorAll('.pp-preset').forEach(c=>c.addEventListener('click',()=>{
    const p=PRESETS.find(x=>x[0]===c.dataset.p); const [f,t]=p[2]();
    PP.from=f; PP.to=t; PP.preset=p[0]; PP.fromView=ymView(f); PP.toView=ymView(t); ppRenderAll();
  }));
}
function ppRenderCal(side){
  const host=document.getElementById(side==='from'?'ppCalFrom':'ppCalTo');
  const view=side==='from'?PP.fromView:PP.toView;
  const [y,m]=view.split('-').map(Number);
  const startDow=new Date(y,m-1,1).getDay(), dim=new Date(y,m,0).getDate();
  let cells='';
  for(let i=0;i<startDow;i++) cells+='<span class="pp-day empty"></span>';
  for(let d=1;d<=dim;d++){
    const ds=view+'-'+pad(d);
    const inR=PP.from&&PP.to&&ds>=PP.from&&ds<=PP.to, isEdge=(ds===PP.from||ds===PP.to);
    const cls=['pp-day']; if(inR) cls.push('in'); if(ds===PP.from) cls.push('edge-l'); if(ds===PP.to) cls.push('edge-r'); if(isEdge) cls.push('sel');
    cells+=`<button class="${cls.join(' ')}" data-side="${side}" data-d="${ds}">${d}</button>`;
  }
  host.innerHTML=`<div class="pp-cal-head"><span class="pp-cal-title">${side==='from'?'Data de início':'Data de término'}</span></div>
    <div class="pp-cal-nav"><button class="pp-nav" data-nav="-1">‹</button><span class="pp-cal-month">${MONTHS_PT[m-1]} ${y}</span><button class="pp-nav" data-nav="1">›</button></div>
    <div class="pp-dow">${DOW_PT.map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="pp-grid">${cells}</div>`;
  host.querySelectorAll('.pp-nav').forEach(b=>b.addEventListener('click',()=>{
    const nv=shiftView(view,+b.dataset.nav); if(side==='from') PP.fromView=nv; else PP.toView=nv; ppRenderCal(side);
  }));
  host.querySelectorAll('.pp-day[data-d]').forEach(b=>b.addEventListener('click',()=>ppPickDay(side,b.dataset.d)));
}
function ppPickDay(side,ds){
  PP.preset='';
  if(side==='from'){ PP.from=ds; if(PP.to&&PP.from>PP.to) PP.to=PP.from; }
  else { PP.to=ds; if(PP.from&&PP.to<PP.from) PP.from=PP.to; }
  ppRenderAll();
}
function ppRenderRange(){
  const el=document.getElementById('ppRange');
  if(PP.from&&PP.to){ const n=Math.round((new Date(PP.to+'T00:00:00')-new Date(PP.from+'T00:00:00'))/86400000)+1;
    el.textContent=brdate(PP.from)+' – '+brdate(PP.to)+(n>0?' · '+n+(n>1?' dias':' dia'):''); }
  else el.textContent='Selecione as datas';
}
function ppApply(){
  if(!PP.from||!PP.to){ ppClose(); return; }
  STATE.from=PP.from; STATE.to=PP.to; STATE.preset=PP.preset||''; STATE.selDays.clear();
  ppClose(); syncDateInputs(); renderAll();
}

/* ---------------- navigation & boot ---------------- */
function setPage(p){ if(CLIENT && p!=='ins') p='geral'; if(p==='ins' && !HAS_NR) p='geral'; STATE.page=p;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===p));
  document.getElementById('page-geral').classList.toggle('active',p==='geral');
  document.getElementById('page-meta').classList.toggle('active',p==='meta');
  document.getElementById('page-rel').classList.toggle('active',p==='rel');
  document.getElementById('page-ia').classList.toggle('active',p==='ia');
  document.getElementById('page-ins').classList.toggle('active',p==='ins');
  document.getElementById('ptitle').textContent = p==='meta'?'Meta Ads':(p==='rel'?'Relatórios':(p==='ia'?'IA Insights':(p==='ins'?'Insights':'Visão Geral')));
  document.getElementById('navToggle').checked=false;
  history.replaceState(null,'', '#'+p);
  renderAll();
}
function renderAll(){ if(STATE.page==='meta') renderMeta(); else if(STATE.page==='rel') renderRelatorios(); else if(STATE.page==='ia') renderIA(); else if(STATE.page==='ins') renderInsights(); else renderGeral(); }

/* Tema ESCURO é o padrão; só fica claro se o usuário tiver escolhido 'light'. */
function applyTheme(){ const t=localStorage.getItem('dm_theme'); if(t==='light') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme','dark'); }
applyTheme();
document.getElementById('themeBtn').addEventListener('click',()=>{ const dark=document.documentElement.getAttribute('data-theme')==='dark'; localStorage.setItem('dm_theme',dark?'light':'dark'); applyTheme(); renderAll(); });

document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',()=>setPage(n.dataset.page)));
document.getElementById('taxToggle').addEventListener('click',function(){ STATE.tax=!STATE.tax; this.classList.toggle('on',STATE.tax); renderAll(); });
/* seletor de período: abre/fecha popover, aplicar/cancelar, fechar ao clicar fora/Esc */
document.getElementById('periodBtn').addEventListener('click',e=>{ e.stopPropagation(); ppIsOpen()?ppClose():ppOpen(); });
document.getElementById('ppApply').addEventListener('click',ppApply);
document.getElementById('ppCancel').addEventListener('click',ppClose);
document.getElementById('periodPop').addEventListener('click',e=>e.stopPropagation());
document.addEventListener('click',()=>{ if(ppIsOpen()) ppClose(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&ppIsOpen()) ppClose(); });
document.getElementById('clearBtn').addEventListener('click',()=>{ STATE.mSelC.clear();STATE.mSelA.clear();STATE.mSelAd.clear();STATE.selDays.clear(); applyPreset('mes'); });
document.getElementById('refreshBtn').addEventListener('click',function(){ this.classList.add('loading'); goRefresh(); });

/* IA Insights config + geração */
document.getElementById('iaCfgBtn').addEventListener('click',()=>{ const c=document.getElementById('iaConfig');
  c.style.display = c.style.display==='none'?'block':'none';
  document.getElementById('iaUrl').value=localStorage.getItem('ia_backend')||'';
  document.getElementById('iaPass').value=localStorage.getItem('ia_pass')||''; });
document.getElementById('iaSave').addEventListener('click',()=>{
  const u=iaNormUrl(document.getElementById('iaUrl').value), p=document.getElementById('iaPass').value;
  if(u) localStorage.setItem('ia_backend',u); else localStorage.removeItem('ia_backend');
  if(p) localStorage.setItem('ia_pass',p); else localStorage.removeItem('ia_pass');
  document.getElementById('iaCfgMsg').textContent='Salvo neste navegador ✓';
  document.getElementById('iaConfig').style.display='none'; iaStatusText(); });
document.getElementById('iaGen').addEventListener('click',iaGenerate);

document.title=(B.client_sub?B.client_sub+' · ':'')+(B.client_name||'Dashboard');
document.getElementById('logoMain').textContent=B.client_name||'—';
document.getElementById('logoSub').textContent=B.client_sub||'';
document.getElementById('taxLabel').textContent=B.tax_label||'Imposto';
const RATES_TXT=HAS_ATC?'Connect Rate, Tx Carrinho, Tx Checkout, Tx Compra, Tx Conversão':'Connect Rate, Tx Checkout, Tx Compra, Tx Conversão';
document.getElementById('noteG').innerHTML = ALL_MAIN
  ? `Vendas e Faturamento = <b>todos os pedidos pagos</b> (${esc(MAIN_PRODUCT)}), de qualquer origem. Taxas de conversão (${RATES_TXT}) = <b>só Meta Ads</b>.`
  : `Vendas e Faturamento = <b>totais</b> (todas as vendas). Vendas/Custo por Compra/Ticket = produto principal (${esc(MAIN_PRODUCT)}); taxas de conversão (${RATES_TXT}) = <b>só Meta Ads</b>.`;
document.getElementById('noteM').innerHTML = ALL_MAIN
  ? `Considera <b>apenas pedidos atribuídos ao Meta Ads</b> (utm_campaign + anúncio = Campaign Name + Ad Name). Cada pedido pago = 1 venda; Faturamento = valor total do pedido.`
  : `Considera <b>apenas vendas atribuídas ao Meta Ads</b> (utm_campaign + anúncio = Campaign Name + Ad Name). <b>Vendas/Custo por Compra/Tx Compra/Ticket</b> = produto principal (${esc(MAIN_PRODUCT)}); <b>Faturamento/ROAS</b> = todos os produtos do funil (orderbumps/upsells).`;
if(ALL_MAIN){ const pc=document.getElementById('gProdCard'); if(pc) pc.style.display='none'; }
if(!HAS_NR){ const ni=document.getElementById('navIns'); if(ni) ni.style.display='none'; }  /* Insights depende da base de clientes */  /* substituída por "Vendas por produto" completa */
document.getElementById('noteProdG').textContent = ALL_MAIN ? 'Pedidos que contêm cada produto · % sobre o total de pedidos' : MAIN_PRODUCT+' = 100% · demais em % (todas as vendas)';
document.getElementById('noteProdM').textContent = ALL_MAIN ? 'Pedidos que contêm cada produto · só Meta Ads' : MAIN_PRODUCT+' = 100% · só Meta Ads';
document.getElementById('updated').innerHTML='Última atualização:<br>'+B.generated_at_brt+' (BRT)';
document.getElementById('buildFoot').textContent='build __BUILD_ID__';
document.getElementById('buildFoot2').textContent='· build __BUILD_ID__';

syncDateInputs(); iaStatusText();
document.getElementById('taxToggle').classList.toggle('on', STATE.tax);  /* imposto Meta ON por padrão */
setPage(location.hash==='#meta'?'meta':(location.hash==='#rel'?'rel':(location.hash==='#ia'?'ia':'geral')));

/* ---------------- Aviso de nova versão (sem recarregar por cima do usuário) ----------------
   O build publica uma versão nova a cada ~30 min, mas o GitHub Pages serve o HTML
   com Cache-Control próprio (as metatags http-equiv do <head> NÃO controlam o cache
   HTTP), então abrir a URL "pelada" pode entregar uma cópia antiga.

   Em vez de recarregar a página sozinho — o que apagava filtros, seleção e rolagem no
   meio do uso, e empilhava uma entrada no histórico a cada 30 min —, aqui a página
   CONSULTA a versão publicada com cache:'no-store' e, se houver build novo, mostra um
   aviso discreto. Quem decide a hora de atualizar é o usuário. */
const UPD_CHECK_MS = 5*60*1000;   /* consulta a cada 5 min (a página tem ~35 KB) */
let updPending = false;

function goRefresh(){
  /* replace() em vez de href: não empilha histórico a cada atualização */
  location.replace(location.pathname+'?t='+Date.now()+location.hash);
}

function updShowBanner(){
  if(updPending || document.getElementById('updBanner')) return;
  updPending = true;
  const el = document.createElement('div');
  el.id = 'updBanner';
  el.innerHTML = '<span>Novos dados publicados.</span>'
               + '<button class="btn primary" id="updNow">Atualizar agora</button>'
               + '<button class="btn" id="updLater" title="Continuar nesta versão">Depois</button>';
  document.body.appendChild(el);
  document.getElementById('updNow').addEventListener('click', goRefresh);
  document.getElementById('updLater').addEventListener('click', ()=>{ el.remove(); });
}

async function updCheck(){
  if(updPending || document.hidden) return;
  try{
    const r = await fetch(location.pathname+'?v='+Date.now(), {cache:'no-store'});
    if(!r.ok) return;
    const html = await r.text();
    const m = html.match(/<meta\s+name="build"\s+content="([^"]+)"/i);
    if(m && B.build_id && m[1] !== B.build_id) updShowBanner();
  }catch(e){ /* offline ou falha de rede: tenta de novo no próximo ciclo */ }
}

setInterval(updCheck, UPD_CHECK_MS);
/* uma checagem logo após abrir: se o Pages entregou uma cópia de cache, o usuário
   descobre em segundos em vez de ficar olhando número velho sem saber */
setTimeout(updCheck, 15*1000);
/* e ao voltar para a aba, que é quando a pessoa vai de fato olhar os números */
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) updCheck(); });

