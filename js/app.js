// ── MAP ──
const mapOuter=document.getElementById('mapOuter');
const mapInner=document.getElementById('mapInner');
const mapImg=document.getElementById('mapImg');
const mapSvg=document.getElementById('mapSvg');
let curYrIdx=0,colorMode='uniform',opacity=0.72,activeFilter='all',allCircles=[],allDots=[],curFond='1867',fondOverride=null;
let editMode=false,dragEl=null,dragData=null;
const corrections=new Map(); // id_obs -> record
let calibMode=false;
const calibPoints=[]; // {label,fond,plan,x,y,e,n}
const RADIUS_SCALE=0.72;
let mS=1,mPX=0,mPY=0,mD=false,mSX,mSY,mSPX,mSPY,mDownX=0,mDownY=0;

const LEG_REFS=[{v:200000,l:'200k'},{v:400000,l:'400k'},{v:700000,l:'700k'},{v:1000000,l:'1M'},{v:2000000,l:'2M'},{v:5000000,l:'5M+'}];
const legSI=document.getElementById('legSizeItems');
LEG_REFS.forEach(ref=>{
  const r=Math.sqrt(ref.v/CONFIG.FORTUNE_MAX)*55*RADIUS_SCALE,d=r*2;
  legSI.innerHTML+=`<div class="ls-item"><div class="ls-circle" style="width:${d}px;height:${d}px"></div><span>${ref.l}</span></div>`;
});
const legPI=document.getElementById('legProfItems');
Object.entries(CONFIG.PROF_COLORS).forEach(([n,c])=>{legPI.innerHTML+=`<div class="lp-item"><div class="lp-dot" style="background:${c}"></div>${n}</div>`;});

const tlMarks=document.getElementById('tlMarks');
CONFIG.YEARS.forEach((yr,i)=>{
  const sp=document.createElement('span');sp.className='tl-mark'+(i===0?' active':'');sp.textContent=yr;sp.onclick=()=>setYear(i);tlMarks.appendChild(sp);
});

const FOND_GEO={'1867':{scale:1.1711883120033941,bearing:0},'1896':{scale:1.306114,bearing:0},'1937':{scale:1.306672,bearing:0},'1959':{scale:1.306277,bearing:0},'1873':{scale:1.25,bearing:0},'1889':{scale:1.25,bearing:0},'1894':{scale:1.24840396,bearing:0},'1926':{scale:1.252663441576222,bearing:0},'1934':{scale:1.25,bearing:0},'1945':{scale:1.25,bearing:0},};
function niceScaleValue(target){
  if(target<=0)return 100;
  const pow=Math.pow(10,Math.floor(Math.log10(target)));
  const n=target/pow;
  let nice;
  if(n<1.5)nice=1;else if(n<3.5)nice=2;else if(n<7.5)nice=5;else nice=10;
  return nice*pow;
}
function fmtScaleLabel(m){return m>=1000?((m/1000)+' km'):(m+' m');}
const FOND_TRANSFORM={
  '1867':{p1:1.1711883120033941,p2:-0.0021619134859065525,p3:-7.411121508652979e-05,p4:-1.1911788278618474,c:2535423.7445432455,d:1155188.8149150808},
  '1896':{p1:1.306114,p2:-2.25e-05,p3:-2.25e-05,p4:-1.306121,c:2535403.0,d:1155051.843},
  '1937':{p1:1.306672,p2:-2.55e-05,p3:-2.55e-05,p4:-1.306681,c:2535402.522,d:1155049.059},
  '1959':{p1:1.306277,p2:-0.00011325,p3:-0.00011325,p4:-1.306289,c:2535402.57,d:1155048.384},
  '1873':{p1:1.25,p2:0.0,p3:0.0,p4:-1.25,c:2533700.0,d:1160400.0}, // mosaique 9 feuilles, georef exacte .tfw
  '1889':{p1:1.25,p2:0.0,p3:0.0,p4:-1.25,c:2533700.0,d:1160400.0}, // mosaique 9 feuilles, georef exacte .tfw
  '1894':{p1:1.24840396,p2:1.30804816e-05,p3:0.000265509241,p4:-1.24619279,c:2533703.11,d:1160375.32}, // mosaique 9 feuilles, georef exacte .tfw
  '1926':{p1:1.252663441576222,p2:-0.0015753254169226238,p3:-0.0027840611364838975,p4:-1.2448770902657316,c:2533703.1077493024,d:1160379.2847383746}, // mosaique 9 feuilles, georef exacte .tfw
  '1934':{p1:1.25,p2:0.0,p3:0.0,p4:-1.25,c:2533700.0,d:1160400.0}, // mosaique 9 feuilles, georef exacte .tfw
  '1945':{p1:1.25,p2:0.0,p3:0.0,p4:-1.25,c:2533700.0,d:1160400.0}, // mosaique 9 feuilles, georef exacte .tfw
};
function fondToLV95(x,y,fond){
  const t=FOND_TRANSFORM[fond];
  return[t.p1*x+t.p2*y+t.c, t.p3*x+t.p4*y+t.d];
}
function lv95ToFond(E,N,fond){
  const t=FOND_TRANSFORM[fond];
  const det=t.p1*t.p4-t.p2*t.p3;
  const dE=E-t.c,dN=N-t.d;
  const x=(t.p4*dE-t.p2*dN)/det, y=(-t.p3*dE+t.p1*dN)/det;
  return[x,y];
}
function reprojectPt(x,y,fromFond,toFond){
  if(fromFond===toFond||!FOND_TRANSFORM[fromFond]||!FOND_TRANSFORM[toFond])return[x,y];
  const[E,N]=fondToLV95(x,y,fromFond);
  return lv95ToFond(E,N,toFond);
}
const FOND_PLAN_LABEL={'1867':'Plan Lebet, 1867','1896':'Plan de Lausanne, ~1896','1937':'Plan cadastral, ~1937','1959':'Plan cadastral, ~1959','1873':'Carte Siegfried, 1873','1889':'Carte Siegfried, 1889','1894':'Carte Siegfried, 1894','1926':'Carte Siegfried, 1926 (sud: éd. 1925)','1934':'Carte Siegfried, 1934','1945':'Carte Siegfried, 1945 (sud: éd. 1934)',};
const YR_TO_SIEGFRIED={'1867':'1873','1887':'1889','1900':'1894','1913':'1926','1923':'1926','1936':'1934','1953':'1945','1955':'1945'};
const GRAD_STOPS=[[0,'#3288bd'],[0.05,'#66c2a5'],[0.12,'#fee08b'],[0.25,'#f46d43'],[1,'#9e0142']];
function hexToRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function gradColor(pct){
  pct=Math.max(0,Math.min(1,pct));
  for(let i=1;i<GRAD_STOPS.length;i++){
    const[p0,c0]=GRAD_STOPS[i-1],[p1,c1]=GRAD_STOPS[i];
    if(pct<=p1){
      const t=p1>p0?(pct-p0)/(p1-p0):0;
      const[r0,g0,b0]=hexToRgb(c0),[r1,g1,b1]=hexToRgb(c1);
      return[Math.round(r0+(r1-r0)*t),Math.round(g0+(g1-g0)*t),Math.round(b0+(b1-b0)*t)];
    }
  }
  return hexToRgb(GRAD_STOPS[GRAD_STOPS.length-1][1]);
}
function getColor(pt,pctOverride){
  if(colorMode==='prof'){const c=CONFIG.PROF_COLORS[pt.cat]||'#888';const[r,g,b]=hexToRgb(c);return[`rgba(${r},${g},${b},${opacity})`,c];}
  if(colorMode==='fortune'){const pct=pctOverride!==undefined?pctOverride:pt.fortune/CONFIG.FORTUNE_MAX;const[r,g,b]=gradColor(pct);const hex='#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');return[`rgba(${r},${g},${b},${opacity})`,hex];}
  return[`rgba(231,76,60,${opacity})`,'rgb(231,76,60)'];
}

const MIN_SCREEN_R=4.5,MAX_SCREEN_R=15,MIN_SCREEN_R_TOP=8.5,MAX_SCREEN_R_TOP=25;
function renderCircles(pts){
  while(mapSvg.firstChild)mapSvg.removeChild(mapSvg.firstChild);allCircles=[];allDots=[];
  const nativeFond=CONFIG.YR_TO_FOND[String(CONFIG.YEARS[curYrIdx])];
  const needsReproj=nativeFond!==curFond;
  const sortedDesc=[...pts].sort((a,b)=>b.fortune-a.fortune);
  const top10=new Set(sortedDesc.slice(0,10));
  const top100=new Set(sortedDesc.slice(0,100));
  const nPts=sortedDesc.length;
  const pctMap=new Map(sortedDesc.map((d,i)=>[d,nPts>1?1-(i/(nPts-1)):1]));
  pts.forEach(d=>{
    const[fill,stroke]=getColor(d,pctMap.get(d));
    const isTop=top10.has(d);
    const[px,py]=needsReproj?reprojectPt(d.x,d.y,nativeFond,curFond):[d.x,d.y];
    const rawR=Math.max(d.taille*RADIUS_SCALE,1.2);
    let el;
    if(isTop){
      el=document.createElementNS('http://www.w3.org/2000/svg','polygon');
      el.setAttribute('stroke-width','2.5');
      el.classList.add('top10-mark');
      el.dataset.top='1';
    }else{
      el=document.createElementNS('http://www.w3.org/2000/svg','circle');
      el.setAttribute('stroke-width','1.5');
    }
    el.dataset.cx=px;el.dataset.cy=py;el.dataset.rawr=rawR;
    el.setAttribute('fill',isTop?'#ff5a3c':fill);el.setAttribute('stroke',isTop?'#ffd54a':stroke);
    el.setAttribute('stroke-opacity','0.95');
    el.dataset.cat=d.cat;el.dataset.top100=top100.has(d)?'1':'0';
    el.addEventListener('click',e=>{e.stopPropagation();if(editMode)return;showPopup(d,e);});
    el.addEventListener('mousedown',e=>{if(!editMode)return;e.stopPropagation();e.preventDefault();startDrag(el,d);});
    mapSvg.appendChild(el);allCircles.push(el);
    const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.classList.add('center-dot');
    dot.setAttribute('fill','#000');
    dot.setAttribute('fill-opacity','0.85');
    dot.setAttribute('pointer-events','none');
    mapSvg.appendChild(dot);allDots.push(dot);
  });applyFilter();updateMarkerSizes();
}
const CENTER_DOT_R=1.6;
function updateMarkerSizes(){
  allCircles.forEach((el,i)=>{
    const cx=+el.dataset.cx,cy=+el.dataset.cy,rawR=+el.dataset.rawr;
    const isTop=el.dataset.top==='1';
    const mult=isTop?1.55:1;
    const minS=isTop?MIN_SCREEN_R_TOP:MIN_SCREEN_R, maxS=isTop?MAX_SCREEN_R_TOP:MAX_SCREEN_R;
    let screenR=rawR*mult*mS;
    screenR=Math.min(Math.max(screenR,minS),maxS);
    const r=screenR/mS;
    const dot=allDots[i];
    if(dot){dot.setAttribute('cx',cx);dot.setAttribute('cy',cy);dot.setAttribute('r',CENTER_DOT_R/mS);}
    if(el.tagName==='circle'){
      el.setAttribute('cx',cx);el.setAttribute('cy',cy);el.setAttribute('r',r);
    }else{
      const p1=`${cx},${cy-r}`,p2=`${cx+r*0.9},${cy+r*0.75}`,p3=`${cx-r*0.9},${cy+r*0.75}`;
      el.setAttribute('points',`${p1} ${p2} ${p3}`);
    }
  });
}
function applyFilter(){
  allCircles.forEach((c,i)=>{
    let show;
    if(activeFilter==='all')show=true;
    else if(activeFilter==='top100')show=c.dataset.top100==='1';
    else show=c.dataset.cat===activeFilter;
    c.style.display=show?'':'none';
    const dot=allDots[i];
    if(dot)dot.style.display=show?'':'none';
  });
}

function buildFilterBar(pts){
  const bar=document.getElementById('fbRow');bar.innerHTML='';
  const mkBtn=(label,val,active)=>{
    const btn=document.createElement('button');btn.className='fb'+(active?' active':'');btn.textContent=label;
    btn.onclick=()=>{activeFilter=val;bar.querySelectorAll('.fb').forEach(x=>x.classList.remove('active'));btn.classList.add('active');applyFilter();};
    bar.appendChild(btn);return btn;
  };
  mkBtn('Tous','all',activeFilter==='all'||activeFilter===undefined);
  mkBtn('Top 100 fortunes','top100',activeFilter==='top100');
  if(colorMode==='prof'){[...new Set(pts.map(p=>p.cat))].sort().forEach(cat=>{
    mkBtn(cat,cat,activeFilter===cat);
  });}
}

function setYear(idx){
  idx=parseInt(idx);curYrIdx=idx;
  document.getElementById('tlSlider').value=idx;
  document.querySelectorAll('.tl-mark').forEach((m,i)=>m.classList.toggle('active',i===idx));
  const yr=CONFIG.YEARS[idx];
  const nativeFond=CONFIG.YR_TO_FOND[String(yr)];
  const resolvedOverride=fondOverride==='siegfried-auto'?YR_TO_SIEGFRIED[String(yr)]:fondOverride;
  const fond=resolvedOverride||nativeFond;
  const reprojected=resolvedOverride&&resolvedOverride!==nativeFond;
  const plan=resolvedOverride?(FOND_PLAN_LABEL[resolvedOverride]+(reprojected?' · positions estimées':'')):CONFIG.YR_TO_PLAN[String(yr)];
  curFond=fond;
  const dims=CONFIG.IMG_DIMS[fond];
  document.getElementById('tlYr').textContent=yr;
  document.getElementById('tlPlan').textContent=plan;
  document.getElementById('mapBadge').textContent=plan;
  mapImg.src='images/'+fond+'.jpg';
  mapImg.style.width=dims[0]+'px';
  mapSvg.setAttribute('viewBox',`0 0 ${dims[0]} ${dims[1]}`);
  mapSvg.style.width=dims[0]+'px';mapSvg.style.height=dims[1]+'px';
  const pts=CONFIG.PTS[String(yr)]||[];
  const total=pts.reduce((s,p)=>s+p.fortune,0);
  const sorted=[...pts].sort((a,b)=>a.fortune-b.fortune);
  const median=sorted.length?sorted[Math.floor(sorted.length/2)].fortune:0;
  const maxF=pts.length?Math.max(...pts.map(p=>p.fortune)):0;
  document.getElementById('hCount').textContent=pts.length.toLocaleString('fr-CH');
  document.getElementById('hTotal').textContent=(total/1000000).toFixed(1)+'M CHF';
  document.getElementById('hMedian').textContent=(median/1000).toFixed(0)+'k CHF';
  document.getElementById('tlStats').innerHTML=`<span class="ts"><strong>${pts.length}</strong> contribuables</span><span class="ts">Total : <strong>${(total/1000000).toFixed(1)}M CHF</strong></span><span class="ts">Médiane : <strong>${(median/1000).toFixed(0)}k CHF</strong></span><span class="ts">Max : <strong>${(maxF/1000).toFixed(0)}k CHF</strong></span>`;
  activeFilter='all';buildFilterBar(pts);mapReset();renderCircles(pts);updateNorthArrow();
}
function setFondOverride(v){
  fondOverride=v||null;
  setYear(curYrIdx);
}
function setColorMode(mode,btn){
  colorMode=mode;document.querySelectorAll('.cbtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  document.getElementById('legProf').classList.toggle('vis',mode==='prof');
  document.getElementById('legGrad').classList.toggle('vis',mode==='fortune');
  const pts=CONFIG.PTS[String(CONFIG.YEARS[curYrIdx])]||[];buildFilterBar(pts);renderCircles(pts);
}
function updateOpacity(v){opacity=v/100;document.getElementById('op_val').textContent=v+'%';const pts=CONFIG.PTS[String(CONFIG.YEARS[curYrIdx])]||[];renderCircles(pts);}

function applyMT(){mapInner.style.transform=`translate(${mPX}px,${mPY}px) scale(${mS})`;updateScaleBar();updateMarkerSizes();}
function mapZoom(f){const r=mapOuter.getBoundingClientRect(),cx=r.width/2,cy=r.height/2,ns=Math.min(Math.max(mS*f,0.2),16);mPX=cx-(cx-mPX)*(ns/mS);mPY=cy-(cy-mPY)*(ns/mS);mS=ns;applyMT();}
function mapReset(){
  const r=mapOuter.getBoundingClientRect();
  const dims=CONFIG.IMG_DIMS[curFond]||[3000,3000];
  mS=(r.width>0&&r.height>0)?Math.min(r.width/dims[0],r.height/dims[1]):1;
  mPX=0;mPY=0;applyMT();
}
function updateScaleBar(){
  const geo=FOND_GEO[curFond];if(!geo)return;
  const metersPerScreenPx=geo.scale/mS;
  const niceMeters=niceScaleValue(metersPerScreenPx*110);
  const px=niceMeters/metersPerScreenPx;
  const line=document.getElementById('sbLine'),lbl=document.getElementById('sbLabel');
  if(line){line.style.width=px.toFixed(0)+'px';}
  if(lbl){lbl.textContent=fmtScaleLabel(niceMeters);}
}
function updateNorthArrow(){
  const geo=FOND_GEO[curFond];if(!geo)return;
  const g=document.getElementById('naGroup');
  if(g)g.setAttribute('transform',`rotate(${geo.bearing} 15 15)`);
}
mapOuter.addEventListener('wheel',e=>{e.preventDefault();const r=mapOuter.getBoundingClientRect(),f=e.deltaY<0?1.15:0.87,ns=Math.min(Math.max(mS*f,0.2),16);mPX=(e.clientX-r.left)-((e.clientX-r.left)-mPX)*(ns/mS);mPY=(e.clientY-r.top)-((e.clientY-r.top)-mPY)*(ns/mS);mS=ns;applyMT();},{passive:false});
mapOuter.addEventListener('mousedown',e=>{mD=true;mSX=e.clientX;mSY=e.clientY;mSPX=mPX;mSPY=mPY;mDownX=e.clientX;mDownY=e.clientY;mapOuter.classList.add('grabbing');});
window.addEventListener('mousemove',e=>{if(!mD)return;mPX=mSPX+(e.clientX-mSX);mPY=mSPY+(e.clientY-mSY);applyMT();});
window.addEventListener('mouseup',()=>{mD=false;mapOuter.classList.remove('grabbing');});

function fmtF(n){return new Intl.NumberFormat('fr-CH').format(n)+' CHF';}
function showPopup(d,e){
  document.getElementById('pNom').textContent=d.nom;
  document.getElementById('pFortune').textContent=fmtF(d.fortune);
  document.getElementById('pAnnee').textContent='Registre '+CONFIG.YEARS[curYrIdx];
  document.getElementById('pProf').textContent=d.prof||'—';
  document.getElementById('pAdrH').textContent=d.adr_hist||'—';
  document.getElementById('pAdrM').textContent=d.adr_mod||'—';
  const u=document.getElementById('pUrl');
  if(d.url){u.href=d.url;u.style.display='';}else{u.removeAttribute('href');u.style.display='none';}
  document.getElementById('pCoord').textContent=fmtMN95Pt(d);
  const p=document.getElementById('popup');p.classList.add('vis');
  let x=e.clientX+16,y=e.clientY-10;
  if(x+320>window.innerWidth)x=e.clientX-330;
  if(y+260>window.innerHeight)y=e.clientY-270;
  p.style.left=x+'px';p.style.top=y+'px';
}
function closePopup(){document.getElementById('popup').classList.remove('vis');}
document.addEventListener('click',closePopup);

// ── MODE CORRECTION (glisser-déposer un point pour le recaler) ──
function toggleEditMode(btn){
  editMode=!editMode;
  if(editMode&&calibMode)toggleCalibMode(document.getElementById('calibModeBtn'));
  btn.classList.toggle('active',editMode);
  btn.textContent=editMode?'Mode correction : ACTIF':'Mode correction';
  mapOuter.classList.toggle('edit-mode',editMode||calibMode);
  document.getElementById('editPanel').classList.toggle('vis',editMode);
  document.getElementById('mapHint').textContent=editMode
    ? "Mode correction actif : clique-glisse un point pour le repositionner. Reclique sur « Mode correction » pour revenir à l'affichage normal."
    : "Molette = zoom · Cliquer-glisser = naviguer · Clic sur un point = fiche détaillée · ▲ = top 10 fortunes de l'année · Fond de carte : un choix manuel recalcule les positions par transformation géographique";
}
function startDrag(el,d){
  const rect=mapOuter.getBoundingClientRect();
  dragEl=el;dragData=d;el.classList.add('dragging');
  function onMove(ev){
    const x=(ev.clientX-rect.left-mPX)/mS,y=(ev.clientY-rect.top-mPY)/mS;
    el.dataset.cx=x;el.dataset.cy=y;updateMarkerSizes();
  }
  function onUp(){
    window.removeEventListener('mousemove',onMove);
    window.removeEventListener('mouseup',onUp);
    el.classList.remove('dragging');
    finalizeDrag(d,+el.dataset.cx,+el.dataset.cy);
    dragEl=null;dragData=null;
  }
  window.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
}
function finalizeDrag(d,xCur,yCur){
  const[E,N]=fondToLV95(xCur,yCur,curFond);
  const nativeFond=CONFIG.YR_TO_FOND[String(CONFIG.YEARS[curYrIdx])];
  const existing=corrections.get(d.id_obs);
  const[E0,N0]=existing?[existing.e_avant,existing.n_avant]:fondToLV95(d.x,d.y,nativeFond);
  const[xNative,yNative]=lv95ToFond(E,N,nativeFond);
  d.x=xNative;d.y=yNative; // reflete immediatement la correction pour le reste de la session
  corrections.set(d.id_obs,{
    id_obs:d.id_obs,nom:d.nom,annee:CONFIG.YEARS[curYrIdx],adr_hist:d.adr_hist,url:d.url,
    e_avant:E0,n_avant:N0,e_apres:E,n_apres:N,distance_m:Math.hypot(E-E0,N-N0),
  });
  persistLocal();
  updateEditPanel();
}
function updateEditPanel(){
  document.getElementById('editCount').textContent=corrections.size;
  const list=document.getElementById('editList');
  if(corrections.size===0){list.innerHTML='<div class="edit-empty">Aucune correction pour l\'instant</div>';return;}
  list.innerHTML='';
  [...corrections.values()].reverse().forEach(c=>{
    const row=document.createElement('div');row.className='edit-row';
    const txt=document.createElement('span');txt.className='er-txt';txt.title=c.nom+' ('+c.annee+')';
    txt.textContent=c.nom+' · '+c.annee+' · '+c.distance_m.toFixed(1)+'m';
    const btn=document.createElement('button');btn.title='Retirer';btn.textContent='✕';
    btn.onclick=()=>{corrections.delete(c.id_obs);persistLocal();updateEditPanel();};
    row.appendChild(txt);row.appendChild(btn);list.appendChild(row);
  });
}
function clearCorrections(){
  if(corrections.size===0)return;
  if(!confirm('Effacer les '+corrections.size+' correction(s) en attente ? Elles ne seront plus exportables ensuite (celles déjà écrites dans le HTML restent dans le fichier).'))return;
  corrections.clear();persistLocal();updateEditPanel();
}
function csvEsc(s){s=String(s==null?'':s);return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function exportCorrections(){
  if(corrections.size===0){alert('Aucune correction à exporter pour le moment.');return;}
  const header=['ID observation','Nom complet','Année','Adresse transcrite','URL Catima Individu','LV95_E_avant','LV95_N_avant','LV95_E_corrige','LV95_N_corrige','distance_m'];
  const lines=[header.join(';')];
  corrections.forEach(c=>{
    lines.push([c.id_obs,csvEsc(c.nom),c.annee,csvEsc(c.adr_hist),c.url,c.e_avant.toFixed(2),c.n_avant.toFixed(2),c.e_apres.toFixed(2),c.n_apres.toFixed(2),c.distance_m.toFixed(1)].join(';'));
  });
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='corrections_manuelles_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// MODE CALIBRATION -- releve de reperes communs sur deux fonds pour recaler
// l'un par rapport a l'autre (independant des points de donnees / corrections)
function toggleCalibMode(btn){
  calibMode=!calibMode;
  if(calibMode&&editMode)toggleEditMode(document.getElementById('editModeBtn'));
  btn.classList.toggle('active',calibMode);
  btn.textContent=calibMode?'Mode calibration : ACTIF':'Mode calibration';
  document.getElementById('calibPanel').classList.toggle('vis',calibMode);
  mapOuter.classList.toggle('edit-mode',calibMode||editMode);
  document.getElementById('mapHint').textContent=calibMode
    ? "Mode calibration actif : clique un repère réel identifiable (coin de bâtiment, croisement...), donne-lui un nom, puis reproduis le même clic avec le même nom sur l'autre fond à recaler."
    : "Molette = zoom · Cliquer-glisser = naviguer · Clic sur un point = fiche détaillée · ▲ = top 10 fortunes de l'année · Fond de carte : un choix manuel recalcule les positions par transformation géographique";
}
mapOuter.addEventListener('click',e=>{
  if(!calibMode)return;
  if(Math.hypot(e.clientX-mDownX,e.clientY-mDownY)>6)return; // c'etait un glisser-navigation, pas un clic
  const label=prompt('Nom de ce repère (identique sur les deux fonds, ex: "coin NE Hôtel des Postes") :');
  if(!label||!label.trim())return;
  const rect=mapOuter.getBoundingClientRect();
  const x=(e.clientX-rect.left-mPX)/mS, y=(e.clientY-rect.top-mPY)/mS;
  const [E,N]=fondToLV95(x,y,curFond);
  calibPoints.push({label:label.trim(),fond:curFond,plan:document.getElementById('tlPlan').textContent,x,y,e:E,n:N});
  updateCalibPanel();
});
function updateCalibPanel(){
  document.getElementById('calibCount').textContent=calibPoints.length;
  const list=document.getElementById('calibList');
  if(calibPoints.length===0){list.innerHTML='<div class="edit-empty">Aucun point pour l\'instant</div>';return;}
  list.innerHTML='';
  [...calibPoints].reverse().forEach((c,revIdx)=>{
    const idx=calibPoints.length-1-revIdx;
    const row=document.createElement('div');row.className='edit-row';
    const txt=document.createElement('span');txt.className='er-txt';txt.title=c.label+' — '+c.plan;
    txt.textContent=c.label+' · '+c.plan;
    const btn=document.createElement('button');btn.title='Retirer';btn.textContent='✕';
    btn.onclick=()=>{calibPoints.splice(idx,1);updateCalibPanel();};
    row.appendChild(txt);row.appendChild(btn);list.appendChild(row);
  });
}
function clearCalibPoints(){
  if(calibPoints.length===0)return;
  if(!confirm('Effacer les '+calibPoints.length+' point(s) de calibration ? Ils ne seront plus exportables ensuite.'))return;
  calibPoints.length=0;updateCalibPanel();
}
function exportCalibPoints(){
  if(calibPoints.length===0){alert('Aucun point de calibration à exporter pour le moment.');return;}
  const header=['label','fond','plan','pixel_x','pixel_y','lv95_e','lv95_n'];
  const lines=[header.join(';')];
  calibPoints.forEach(c=>{
    lines.push([csvEsc(c.label),c.fond,csvEsc(c.plan),c.x.toFixed(2),c.y.toFixed(2),c.e.toFixed(2),c.n.toFixed(2)].join(';'));
  });
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='calibration_reperes_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ───────── PERSISTANCE, EXPORT COMPLET, IMPORT, ENREGISTREMENT DANS LE HTML, COORDONNÉES MN95 ─────────
// Remarque : MN95 (français) = LV95 (allemand) = CH1903+ / EPSG:2056. Les valeurs E/N de cette carte
// sont donc directement des coordonnées MN95 (E ≈ 2 5xx xxx, N ≈ 1 1xx xxx) : aucune conversion à faire.
const LS_KEY='rl_corrections_v1';
function fmtSwiss(v){return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g,"’");}
function nativeFondOfYear(annee){return CONFIG.YR_TO_FOND[String(annee)];}
function ptEN(d,annee){return fondToLV95(d.x,d.y,nativeFondOfYear(annee));}
function fmtMN95Pt(d){
  if(d.src==='position_approximative_coin')return '— (position approximative, adresse inconnue)';
  const[E,N]=ptEN(d,CONFIG.YEARS[curYrIdx]);
  return 'E '+fmtSwiss(E)+' · N '+fmtSwiss(N);
}
mapOuter.addEventListener('mousemove',e=>{
  const rect=mapOuter.getBoundingClientRect();
  const x=(e.clientX-rect.left-mPX)/mS,y=(e.clientY-rect.top-mPY)/mS;
  const[E,N]=fondToLV95(x,y,curFond);
  document.getElementById('mapCoords').textContent='MN95 : E '+fmtSwiss(E)+' · N '+fmtSwiss(N);
});
function findPoint(id_obs,annee){
  const years=annee?[String(annee)]:CONFIG.YEARS.map(String);
  for(const y of years){
    const arr=CONFIG.PTS[y]||[];
    for(const p of arr){if(p.id_obs===String(id_obs))return{p,annee:+y};}
  }
  return null;
}
function applyCorrectionRecord(c){
  const f=findPoint(c.id_obs,c.annee);
  if(!f)return false;
  const[x,y]=lv95ToFond(c.e_apres,c.n_apres,nativeFondOfYear(f.annee));
  f.p.x=x;f.p.y=y;
  corrections.set(String(c.id_obs),c);
  return true;
}
function persistLocal(){
  try{localStorage.setItem(LS_KEY,JSON.stringify([...corrections.values()]));}catch(e){}
}
function loadStoredCorrections(){
  let n=0;
  try{
    const saved=JSON.parse(document.getElementById('saved-corrections').textContent||'[]');
    saved.forEach(c=>{if(applyCorrectionRecord(c))n++;});
  }catch(e){console.warn('bloc de corrections du HTML illisible',e);}
  try{
    const loc=JSON.parse(localStorage.getItem(LS_KEY)||'[]');
    loc.forEach(c=>{if(applyCorrectionRecord(c))n++;});
  }catch(e){}
  return n;
}
function downloadText(name,text,mime){
  const blob=new Blob([text],{type:mime||'text/plain;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function buildAllPointsCSV(){
  const header=['id_obs','nom','annee','fortune_chf','profession','categorie','adresse_transcrite','adresse_moderne','url_catima','E_MN95','N_MN95','source_position','corrige_manuellement'];
  const lines=[header.join(';')];
  CONFIG.YEARS.forEach(y=>{
    (CONFIG.PTS[String(y)]||[]).forEach(d=>{
      const coin=d.src==='position_approximative_coin';
      const[E,N]=coin?['','']:ptEN(d,y);
      const corr=corrections.has(String(d.id_obs))||d.src==='correction_mode_edition';
      lines.push([d.id_obs,csvEsc(d.nom),y,d.fortune,csvEsc(d.prof),csvEsc(d.cat),csvEsc(d.adr_hist),csvEsc(d.adr_mod),d.url,
        coin?'':E.toFixed(2),coin?'':N.toFixed(2),d.src,corr?'oui':'non'].join(';'));
    });
  });
  return '﻿'+lines.join('\r\n');
}
function exportAllPoints(){
  downloadText('points_MN95_'+new Date().toISOString().slice(0,10)+'.csv',buildAllPointsCSV(),'text/csv;charset=utf-8;');
}
function parseCSVText(text){
  text=text.replace(/^﻿/,'');
  const first=text.split(/\r?\n/)[0]||'';
  const delim=(first.split(';').length>=first.split(',').length)?(first.includes('\t')?'\t':';'):',';
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}
    else if(ch==='"')q=true;
    else if(ch===delim){row.push(cur);cur='';}
    else if(ch==='\n'){row.push(cur.replace(/\r$/,''));rows.push(row);row=[];cur='';}
    else cur+=ch;
  }
  if(cur!==''||row.length){row.push(cur.replace(/\r$/,''));rows.push(row);}
  return rows.filter(r=>r.some(c=>c.trim()!==''));
}
function importCSVText(text){
  const rows=parseCSVText(text);
  if(rows.length<2)return{ok:0,ko:0,skip:0,msg:'fichier vide'};
  const h=rows[0].map(s=>s.trim().toLowerCase());
  const col=(...names)=>{for(const n of names){const k=h.indexOf(n.toLowerCase());if(k>=0)return k;}return -1;};
  const cId=col('id_obs','ID observation'),cE=col('E_MN95','LV95_E_corrige','E_LV95','E'),cN=col('N_MN95','LV95_N_corrige','N_LV95','N'),cY=col('annee','Année');
  if(cId<0||cE<0||cN<0)return{ok:0,ko:0,skip:0,msg:'colonnes id_obs, E_MN95 et N_MN95 introuvables'};
  let ok=0,ko=0,skip=0;
  rows.slice(1).forEach(r=>{
    const id=(r[cId]||'').trim();
    const E=parseFloat((r[cE]||'').replace(',','.')),N=parseFloat((r[cN]||'').replace(',','.'));
    if(!id||isNaN(E)||isNaN(N)){skip++;return;}
    const f=findPoint(id,cY>=0?(r[cY]||'').trim():null);
    if(!f){ko++;return;}
    const[E0,N0]=ptEN(f.p,f.annee);
    const dist=Math.hypot(E-E0,N-N0);
    if(dist<0.01){skip++;return;} // inchangé
    const old=corrections.get(String(id));
    applyCorrectionRecord({id_obs:String(id),nom:f.p.nom,annee:f.annee,adr_hist:f.p.adr_hist,url:f.p.url,
      e_avant:old?old.e_avant:E0,n_avant:old?old.n_avant:N0,e_apres:E,n_apres:N,
      distance_m:Math.hypot(E-(old?old.e_avant:E0),N-(old?old.n_avant:N0))});
    ok++;
  });
  persistLocal();updateEditPanel();
  renderCircles(CONFIG.PTS[String(CONFIG.YEARS[curYrIdx])]||[]);
  return{ok,ko,skip,msg:''};
}
function importPointsCSV(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.csv,text/csv';
  inp.onchange=async()=>{
    if(!inp.files[0])return;
    const res=importCSVText(await inp.files[0].text());
    alert(res.msg?('Import impossible : '+res.msg):('Import terminé : '+res.ok+' point(s) déplacé(s), '+res.skip+' inchangé(s)/ignoré(s), '+res.ko+' introuvable(s).'));
  };
  inp.click();
}
function applySavedBlock(htmlText){
  const re=/(<script id="saved-corrections" type="application\/json">)([\s\S]*?)(<\/script>)/;
  if(!re.test(htmlText))return null;
  const json=JSON.stringify([...corrections.values()]).replace(/<\//g,'<\\/');
  return htmlText.replace(re,(m,a,b,c)=>a+json+c);
}
async function saveToHtml(){
  if(corrections.size===0){alert('Aucune correction à enregistrer pour le moment.');return;}
  const badFile='Ce fichier ne contient pas le bloc de corrections attendu : choisissez bien le fichier index.html de la carte.';
  if(window.showOpenFilePicker){
    try{
      const[h]=await window.showOpenFilePicker({multiple:false,types:[{description:'Carte HTML',accept:{'text/html':['.html','.htm']}}]});
      const f=await h.getFile();
      const nt=applySavedBlock(await f.text());
      if(nt==null){alert(badFile);return;}
      const w=await h.createWritable();await w.write(nt);await w.close();
      alert(corrections.size+' correction(s) écrite(s) directement dans « '+f.name+' ». Rechargez la page pour vérifier.');
      return;
    }catch(e){if(e&&e.name==='AbortError')return;}
  }
  const inp=document.createElement('input');inp.type='file';inp.accept='.html,.htm,text/html';
  inp.onchange=async()=>{
    if(!inp.files[0])return;
    const nt=applySavedBlock(await inp.files[0].text());
    if(nt==null){alert(badFile);return;}
    downloadText(inp.files[0].name,nt,'text/html;charset=utf-8;');
    alert('Une copie à jour de « '+inp.files[0].name+' » vient d\'être téléchargée : remplacez l\'ancien fichier par celle-ci.');
  };
  inp.click();
}

// INIT
if(!window.PUBLIC_VIEW)loadStoredCorrections();
updateEditPanel();
setYear(0);
