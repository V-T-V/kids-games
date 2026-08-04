/* eslint-disable */
/*
 * Comprehensive game tester for kids-games (CommonJS).
 * Usage: node tester.cjs <gameId> [seed]
 * Auto-detects mechanism; prints JSON result.
 */
const puppeteer = require('D:/M_X_M/kids-games/node_modules/puppeteer-core');
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5191/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gameId = process.argv[2];
if (!gameId) { console.error('need gameId'); process.exit(2); }

async function launch() {
  const b = await puppeteer.launch({ executablePath: EXE, headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--mute-audio','--disable-gpu'],
    defaultViewport: { width: 400, height: 800 } });
  const p = (await b.pages())[0] || (await b.newPage());
  p.setDefaultTimeout(8000);
  return { b, p };
}
async function gotoGame(p, id) {
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch(e){} });
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(700);
  await p.evaluate((gid) => { window.location.hash = '#/' + gid; }, id);
  await sleep(1500);
}
async function checkClear(p) {
  await sleep(150);
  return await p.evaluate(() => {
    const ov = document.querySelector('.overlay--clear');
    if (ov) return { cleared: true, stars: (ov.querySelector('.overlay__body')?.textContent||'').replace(/\s+/g,' ').trim().slice(0,18) };
    const rest = document.querySelector('.overlay--rest');
    if (rest) return { cleared:false, rest:true };
    const any = document.querySelector('.overlay');
    if (any) return { cleared:false, overlay: (any.textContent||'').replace(/\s+/g,' ').trim().slice(0,40) };
    return { cleared:false };
  });
}
async function roundTotalFromTask(p, sel) {
  return await p.evaluate((s) => {
    const t = document.querySelector(s)?.textContent || '';
    let m = t.match(/第\s*1\/(\d+)\s*关/);
    if (m) return parseInt(m[1]);
    m = t.match(/(\d+)\s*\/\s*(\d+)\s*关/);
    if (m) return parseInt(m[2]);
    m = t.match(/(\d+)\s*\/\s*(\d+)/); // "1 / 3"
    if (m) return parseInt(m[2]);
    return null;
  }, sel);
}

// Source-data overrides for text-matching ordering games (prefix + ordered text list)
const STEP_DATA = {
  'tie-shoe':     { prefix:'tsh', order:['交叉','穿洞','拉紧','打结'] },
  'brush-teeth':  { prefix:'brt', order:['挤牙膏','刷外面','刷里面','刷上面','漱口','擦嘴'] },
  'wash-hands':   { prefix:'whs', order:['湿水','抹肥皂','手心搓','手背搓','指缝搓','冲洗','擦干'] },
  'dress-order':  { prefix:'dro', order:['内裤','背心','袜子','裤子','外套'] },
  'tie-bow':      { prefix:'tbw', order:['两根带子交叉','绕一个小圈圈','穿过去','拉紧成蝴蝶结'] },
  'fold-paper-2': { prefix:'fpw2', order:['对折成长方形','折成三角形','展开变回纸','捏成小鸟成型'] },
  'tie-hair':     { prefix:'thrh', order:['梳顺头发','分一缕头发','皮筋绕几圈','打个结固定'] },
  'fire-safety':  { prefix:'frs2', order:['捂住口鼻','弯下腰走','赶紧往外跑','拨打 119'] },
};

// Generic "click by data-idx in ascending order" games (prefix of the card + slot count via data-idx)
// cycle/ecosystem/seed-sprout/ice-melt/potion-brew/story-order/sequence-word/bath-steps/sleep-routine/wake-up/rock-cycle/water-cycle
const DATAIDX_GAMES = {
  'rock-cycle':'rkc','water-cycle':'wcy','ecosystem':'ec','seed-sprout':{card:'ss2-card',attr:'order'},
  'ice-melt':{card:'im-card',attr:'order'},'potion-brew':'','story-order':'','sequence-word':'','bath-steps':'',
  'sleep-routine':'','wake-up':'',
};

// number-labeled click-in-order games (selector that the numbered buttons match; click 1..N by text content)
const NUMBER_GAMES = {
  'connect-dots':'cd-dot','constellation':'cn-star','dot-to-dot':'dtd-dot','star-map':null,
  'pond-skip':'ps-pad','number-bridge':null,
};

async function solve(p, id) {
  await gotoGame(p, id);

  // ---- Motor / sandbox games: click a "done" button each round ----
  const MOTOR = {
    'stretch-game':{btn:'button.strg-btn', rounds:null},
    'throw-ball':{btn:'button.tb-done', rounds:null},
    'follow-action':{btn:'button.fa-done', rounds:null},
    'kick-ball':{btn:'button.kb-done', rounds:null},
    'music-echo':{btn:null}, // special
  };
  if (MOTOR[id]) {
    return await playMotor(p, id, MOTOR[id]);
  }

  // ---- breath-game: has 结束 button -> just click 结束 to finish ----
  if (id === 'breath-game') {
    // rounds driven by a different mechanic; inspect
    return await playBreath(p);
  }
  if (id === 'dance-step') return await playDanceStep(p);
  if (id === 'scale-piano') return await playScalePiano(p);

  // ---- StepOrderGame text-matching ----
  if (STEP_DATA[id]) return await playStep(p, id, STEP_DATA[id]);

  // ---- data-idx ascending games ----
  if (DATAIDX_GAMES[id] !== undefined) return await playDataIdx(p, id, DATAIDX_GAMES[id]);

  // ---- sequence demo-capture games ----
  const SEQ = { rhythm:'rh', 'sound-sequence':'ss', 'echo-cave':null, 'jellyfish-glow':null,
    'dance-copy':'dnc','feed-order':'fo','reverse-memory':'rm', 'music-stairs':'ms' };
  if (SEQ[id]) return await playSeq(p, id, SEQ[id]);

  // ---- number-labeled connect games ----
  if (id==='connect-dots'||id==='dot-to-dot'||id==='pond-skip') return await playNumbered(p,id);
  if (id==='constellation') return await playConstellation(p);
  if (id==='star-map') return await playStarMap(p);

  // ---- size/rank sort ----
  if (id==='size-sort') return await playSizeSort(p);
  if (id==='ant-march') return await playAntMarch(p);

  // ---- rainbow color order games ----
  if (id==='spectrum'||id==='rainbow-bridge'||id==='rainbow-slide'||id==='rainbow-order')
    return await playRainbow(p, id);

  // ---- candy-pattern: read answer from DOM belt (find '?' then extrapolate period) ----
  if (id==='candy-pattern') return await playCandyPattern(p);
  if (id==='pattern-design') return await playPatternDesign(p);

  // ---- time-timeline: place cards by hour order ----
  if (id==='time-timeline') return await playTimeline(p);

  return { error: 'no strategy' };
}

// ===== implementations =====
async function playStep(p, id, cfg) {
  const pf = cfg.prefix;
  const total = await roundTotalFromTask(p, '.'+pf+'-task') || 2;
  for (let r=0;r<total;r++){
    await p.waitForFunction((pr)=>document.querySelectorAll('.'+pr+'-card').length>0,{timeout:6000},pf).catch(()=>{});
    const n = await p.evaluate((pr)=>document.querySelectorAll('.'+pr+'-slot').length, pf);
    for (const t of cfg.order.slice(0,n)){
      await p.evaluate((pr,txt)=>{const c=Array.from(document.querySelectorAll('.'+pr+'-card')).find(x=>!x.classList.contains(pr+'-card--used')&&(x.textContent||'').includes(txt));if(c)c.click();},pf,t);
      await sleep(260);
    }
    await sleep(1150);
  }
  await sleep(1700); return await checkClear(p);
}
async function playDataIdx(p, id, cfg) {
  // resolve card class + attr
  let cardClass, attr='idx', prefix=null;
  if (typeof cfg === 'string') { prefix = cfg; cardClass = cfg+'-card'; }
  else if (cfg && cfg.card) { cardClass = cfg.card; attr = cfg.attr||'idx'; }
  else { cardClass = (prefix||'x')+'-card'; }
  // fallback: detect from DOM the first "--card" class present
  const detected = await p.evaluate(() => {
    const c = document.querySelector('[class*="-card"]');
    return c ? c.className.split(' ').find(x=>x.endsWith('-card')) : null;
  });
  if (detected) cardClass = detected;
  const attr2 = attr;
  const total = await roundTotalFromTask(p, '.'+cardClass.replace(/-card$/,'')+'-task') || await roundTotalFromTask(p,'.task') || 2;
  for (let r=0;r<total;r++){
    await p.waitForFunction((cc)=>document.querySelectorAll('.'+cc).length>0,{timeout:6000},cardClass).catch(()=>{});
    // count slots if any
    const count = await p.evaluate((cc,attr)=>{
      const cards=Array.from(document.querySelectorAll('.'+cc));
      let max=-1; cards.forEach(c=>{const v=Number(c.dataset[attr]); if(!isNaN(v)&&v>max)max=v;}); return max+1;
    },cardClass,attr2);
    const cnt = count>0?count: await p.evaluate(()=>document.querySelectorAll('[class*="-slot"]').length)||4;
    for (let i=0;i<cnt;i++){
      await p.evaluate((cc,attr,val)=>{const c=Array.from(document.querySelectorAll('.'+cc)).find(x=>!x.classList.contains(cc+'--used')&&!x.disabled&&x.dataset[attr]===String(val));if(c)c.click();},cardClass,attr2,i);
      await sleep(250);
    }
    await sleep(1250);
  }
  await sleep(1700); return await checkClear(p);
}

async function playSeq(p, id, prefix) {
  // Determine card selector + flash selector + replay button
  const map = {
    rhythm: { card:'rh-drum', idxAttr:null, flash:'rh-drum--hit', totalSel:'.rh-task', demoMs: (len)=>len*600+600+700, clickBy:'flash' },
    'sound-sequence': { card:'ss-bell', flash:'ss-bell--ring', totalSel:'.ss-task', clickBy:'flash', demoMs:(l)=>l*650+600+700 },
    'dance-copy': { card:'dnc-pad', flash:'dnc-pad--hit', totalSel:'.dnc-task', clickBy:'flash', demoMs:(l)=>l*600+600 },
    feed_order_dummy:null,
  };
  // We'll capture the flash order via a page-side recorder across the demo.
  const total = await roundTotalFromTask(p, '.'+prefix+'-task') || (id==='rhythm'?3:2);
  for (let r=0;r<total;r++){
    // wait for cards present
    const cardSel = '.'+prefix+'-drum, .'+prefix+'-bell, .'+prefix+'-pad, .'+prefix+'-animal, .'+prefix+'-opt, .'+prefix+'-stair';
    await p.waitForFunction((s)=>document.querySelectorAll(s).length>0,{timeout:6000},cardSel).catch(()=>{});
    const order = await captureSeqByFlash(p, prefix, id);
    if (!order || !order.length) return { error:'could not capture sequence' };
    // replay sequence
    for (const key of order){
      await clickSeqTarget(p, id, prefix, key);
      await sleep(220);
    }
    await sleep(1100);
  }
  await sleep(1700); return await checkClear(p);
}

async function captureSeqByFlash(p, prefix, id) {
  // For feed-order/reverse-memory/music-stairs the demo shows emojis in a display element.
  if (id==='feed-order' || id==='reverse-memory') {
    const sel = id==='feed-order' ? '#fo-show' : '#rm-display';
    const len = await p.evaluate((id2)=>{const t=document.querySelector('.'+id2.slice(0,2)+'-task')?.textContent||'';const m=t.match(/第\s*1\/(\d+)/);return m?parseInt(m[1]):1;},id);
    // record text changes of the display during the demo
    return await p.evaluate(async (sel)=>{
      const seen=[]; let prev=''; const start=Date.now();
      while (Date.now()-start < 6000){ const el=document.querySelector(sel); const v=el?el.textContent.trim():''; if(v&&v!==prev&&v.length<4&&!/该你|倒着|现在|✅|\/\d/.test(v)){ seen.push(v); prev=v;} await new Promise(r=>setTimeout(r,90)); }
      return seen;
    }, sel);
  }
  if (id==='music-stairs') {
    // demo: stairs flash ms-stair--hit in song order. Capture which note buttons flash.
    return await p.evaluate(async ()=>{
      const seen=[]; const start=Date.now(); let lastNote=null;
      while(Date.now()-start<5000){ const h=document.querySelector('.ms-stair--hit'); if(h){const n=h.textContent.trim(); if(n!==lastNote){seen.push(n);lastNote=n;}} await new Promise(r=>setTimeout(r,80)); }
      return seen;
    });
  }
  // drum/bell/pad: capture index of flashed element
  const cardSel = prefix+'-drum, .'+prefix+'-bell, .'+prefix+'-pad';
  return await p.evaluate(async (cs)=>{
    const seen=[]; const start=Date.now(); let last=null;
    while(Date.now()-start<5500){
      const els=Array.from(document.querySelectorAll(cs));
      const fi=els.findIndex(e=>e.classList.contains(cs.split(',')[0].replace(/^\./,'')+'--hit')||e.classList.contains(cs.split(',')[1].trim().replace(/^\./,'')+'--ring')||e.classList.contains(cs.split(',')[2].trim().replace(/^\./,'')+'--hit'));
      if(fi>=0 && fi!==last){ seen.push(fi); last=fi; }
      await new Promise(r=>setTimeout(r,70));
    }
    return seen;
  }, '.'+cardSel);
}
async function clickSeqTarget(p, id, prefix, key){
  await p.evaluate((id2,pr,k)=>{
    if(id2==='rhythm'||id2==='sound-sequence'||id2==='dance-copy'){
      const cls = id2==='rhythm'?pr+'-drum':id2==='sound-sequence'?pr+'-bell':pr+'-pad';
      const els=Array.from(document.querySelectorAll('.'+cls));
      if(els[k]) els[k].click();
    } else if(id2==='feed-order'){
      const els=Array.from(document.querySelectorAll('.'+pr+'-animal')).filter(e=>!e.classList.contains(pr+'-animal--eat'));
      // click first whose text==k and not matching already-correct? we click by emoji sequentially
      const t=els.find(e=>(e.textContent||'').trim()===k); if(t)t.click();
    } else if(id2==='reverse-memory'){
      const els=Array.from(document.querySelectorAll('.'+pr+'-opt')).filter(e=>!e.classList.contains(pr+'-opt--done'));
      const t=els.find(e=>(e.textContent||'').trim()===k); if(t)t.click();
    } else if(id2==='music-stairs'){
      const els=Array.from(document.querySelectorAll('.'+pr+'-stair'));
      const t=els.find(e=>(e.textContent||'').trim()===k); if(t)t.click();
    }
  }, id, prefix, key);
}

async function playNumbered(p, id){
  const sel = id==='connect-dots'?'.cd-dot':id==='dot-to-dot'?'.dtd-dot':'.ps-pad';
  const total = await roundTotalFromTask(p, '.'+id.split('-')[0]+'-task') || 2;
  for(let r=0;r<total;r++){
    await p.waitForFunction((s)=>document.querySelectorAll(s).length>0,{timeout:6000},sel).catch(()=>{});
    const n = await p.evaluate((s)=>document.querySelectorAll(s).length, sel);
    for(let i=1;i<=n;i++){
      await p.evaluate((s,v)=>{const els=Array.from(document.querySelectorAll(s));const t=els.find(e=>(e.textContent||'').trim()===String(v)&&!e.classList.contains('ps-pad--done')&&!e.disabled);if(t)t.click();},sel,i);
      await sleep(220);
    }
    await sleep(1500);
  }
  await sleep(1700); return await checkClear(p);
}
async function playConstellation(p){
  const total = await roundTotalFromTask(p,'.cn-task')||2;
  for(let r=0;r<total;r++){
    await p.waitForFunction(()=>document.querySelectorAll('.cn-star').length>0,{timeout:6000}).catch(()=>{});
    const n=await p.evaluate(()=>document.querySelectorAll('.cn-star').length);
    for(let i=1;i<=n;i++){ await p.evaluate((v)=>{const els=Array.from(document.querySelectorAll('.cn-star'));const t=els.find(e=>(e.querySelector('.cn-star__num')?.textContent.trim()===String(v)));if(t)t.click();},i); await sleep(230);}
    await sleep(1500);
  }
  await sleep(1700); return await checkClear(p);
}
async function playStarMap(p){
  const total = await roundTotalFromTask(p,'.smg-task')||2;
  for(let r=0;r<total;r++){
    await p.waitForFunction(()=>document.querySelectorAll('.smg-star').length>0,{timeout:6000}).catch(()=>{});
    const n=await p.evaluate(()=>document.querySelectorAll('.smg-star').length);
    for(let i=1;i<=n;i++){ await p.evaluate((v)=>{const els=Array.from(document.querySelectorAll('.smg-star'));const t=els.find(e=>e.dataset.num===String(v)&&!e.classList.contains('smg-star--on'));if(t)t.click();},i); await sleep(220);}
    await sleep(1200);
  }
  await sleep(1700); return await checkClear(p);
}
async function playSizeSort(p){
  const total = await roundTotalFromTask(p,'.ss-task')||3;
  for(let r=0;r<total;r++){
    await p.waitForFunction(()=>document.querySelectorAll('.ss-piece').length>0,{timeout:6000}).catch(()=>{});
    // sort pieces by computed font-size ascending and click
    const order=await p.evaluate(()=>{const els=Array.from(document.querySelectorAll('.ss-piece')).filter(e=>!e.classList.contains('ss-piece--done'));return els.map(e=>({i:[...document.querySelectorAll('.ss-piece')].indexOf(e),fs:parseFloat(getComputedStyle(e).fontSize)})).sort((a,b)=>a.fs-b.fs).map(o=>o.i);});
    for(const idx of order){ await p.evaluate((i)=>{const els=document.querySelectorAll('.ss-piece');if(els[i])els[i].click();},idx); await sleep(250);}
    await sleep(1400);
  }
  await sleep(1700); return await checkClear(p);
}
async function playAntMarch(p){
  const total = await roundTotalFromTask(p,'.am-task')||2;
  for(let r=0;r<total;r++){
    await p.waitForFunction(()=>document.querySelectorAll('.am-ant').length>0,{timeout:6000}).catch(()=>{});
    for(let rk=0;rk<99;rk++){ const done=await p.evaluate((rank)=>{const els=Array.from(document.querySelectorAll('.am-ant'));const t=els.find(e=>e.dataset.rank===String(rank)&&!e.classList.contains('am-ant--done'));if(t){t.click();return false;}return true;},rk); if(done)break; await sleep(230);}
    await sleep(1200);
  }
  await sleep(1700); return await checkClear(p);
}
async function playRainbow(p, id){
  // click color blocks in red->purple order by matching CSS var color
  const order = ['#ff5252','#ff5a5a','#ff6b9d','#ff9f43','#ffd93d','#ffd93d','#6bcf7f','#22d3ee','#4d96ff','#a55eea'];
  const cardSel = {spectrum:'.sp-chip','rainbow-bridge':'.rb-band','rainbow-slide':'.rsl-band','rainbow-order':null}[id];
  // For these we click by data-idx/order ascending if available, else by color
  const total = await roundTotalFromTask(p, '.'+id.split('-')[0]+'-task') || 2;
  for(let r=0;r<total;r++){
    await p.waitForFunction(()=>document.querySelector('[class*="-chip"],[class*="-band"]'),{timeout:6000}).catch(()=>{});
    // spectrum: sp-chip has data-idx ascending
    // rainbow-bridge: rb-band has data-order ascending
    // rainbow-slide: match RAINBOW order by --rsl-color (red->purple)
    if(id==='rainbow-slide'){
      const cols=['#ff5252','#ff9f43','#ffd93d','#6bcf7f','#22d3ee','#4d96ff','#a55eea'];
      for(const c of cols){ await p.evaluate((col)=>{const els=Array.from(document.querySelectorAll('.rsl-band'));const t=els.find(e=>!e.classList.contains('rsl-band--used')&&e.dataset.hex===col);if(t)t.click();},c); await sleep(220);}
    } else {
      // data-idx or data-order ascending
      const attr = id==='spectrum'?'idx':'order';
      const cls = id==='spectrum'?'sp-chip':'rb-band';
      const n = await p.evaluate((cc)=>document.querySelectorAll('.'+cc).length, cls);
      for(let i=0;i<n;i++){ await p.evaluate((cc,at,v)=>{const els=Array.from(document.querySelectorAll('.'+cc));const t=els.find(e=>!e.classList.contains(cc+'--done')&&!e.classList.contains(cc+'--used')&&e.dataset[at]===String(v));if(t)t.click();},cls,attr,i); await sleep(230);}
    }
    await sleep(1100);
  }
  await sleep(1700); return await checkClear(p);
}
async function playCandyPattern(p){
  // Determine answer: read belt, find '?', period from repetition, fill answer
  const total = await roundTotalFromTask(p,'.cp-task')||3;
  for(let r=0;r<total;r++){
    await p.waitForFunction(()=>document.querySelector('.cp-belt'),{timeout:6000}).catch(()=>{});
    const answer=await p.evaluate(()=>{
      const slots=Array.from(document.querySelectorAll('.cp-belt .cp-slot'));
      const cells=slots.map(s=>s.textContent.trim());
      const qi=cells.indexOf('？');
      // try period 2 then 3
      for(const period of [2,3]){ if(cells[qi+period] && cells[qi+period]!=='？'){ if(cells[qi-period]===cells[qi+period]) return cells[qi+period]; } if(cells[qi-period] && cells[qi-period]!=='？') return cells[qi-period]; }
      return cells[qi-2]||cells[1];
    });
    await p.evaluate((ans)=>{const els=Array.from(document.querySelectorAll('.cp-choice'));const t=els.find(e=>(e.textContent||'').trim()===ans);if(t)t.click();},answer);
    await sleep(1200);
  }
  await sleep(1700); return await checkClear(p);
}
async function playPatternDesign(p){
  // similar pattern fill; detect answer from DOM
  const total = await roundTotalFromTask(p,'.pd-task')||3;
  for(let r=0;r<total;r++){
    await p.waitForFunction(()=>document.querySelector('[class*="pd-"][class*="-slot"],[class*="pd-"][class*="-cell"]'),{timeout:6000}).catch(()=>{});
    const answer=await p.evaluate(()=>{
      const slots=Array.from(document.querySelectorAll('[class*="pd-"][class*="-slot"],[class*="pd-"][class*="-cell"]'));
      const cells=slots.map(s=>s.textContent.trim());
      const qi=cells.findIndex(c=>c==='？'||c==='?');
      if(qi<0) return null;
      for(const period of [2,3,4]){ if(cells[qi+period] && cells[qi+period]!=='？'&&cells[qi+period]!=='?'){ if(cells[qi-period]===cells[qi+period]) return cells[qi+period]; } }
      return cells[qi-2]||cells[1]||null;
    });
    if(answer){ await p.evaluate((ans)=>{const els=Array.from(document.querySelectorAll('button'));const t=els.find(e=>(e.textContent||'').trim()===ans);if(t)t.click();},answer); }
    await sleep(1200);
  }
  await sleep(1700); return await checkClear(p);
}
async function playTimeline(p){
  const total = await roundTotalFromTask(p,'.tl-task')||3;
  for(let r=0;r<total;r++){
    await p.waitForFunction(()=>document.querySelectorAll('.tl-card').length>0,{timeout:6000}).catch(()=>{});
    // cards have emoji+name; we must place in hour order. But hour unknown from DOM.
    // Strategy: place in DOM order (cards already shuffled). We need hour order.
    // The POOL hours: we can't read from DOM. Use known hour mapping by name.
    const HOURS={'起床':7,'吃早饭':8,'上学':8,'上课':9,'吃午餐':12,'午睡':13,'玩耍':16,'吃晚饭':18,'洗澡':19,'看电视':20,'刷牙':21,'睡觉':21};
    const cards=await p.evaluate(()=>Array.from(document.querySelectorAll('.tl-card')).map((c,i)=>({i:i, name:(c.querySelector('.tl-card__name')?.textContent||'').trim()})));
    cards.sort((a,b)=>(HOURS[a.name]??99)-(HOURS[b.name]??99));
    const nslots=await p.evaluate(()=>document.querySelectorAll('.tl-slot').length);
    for(let s=0;s<nslots;s++){
      const ci=cards[s].i;
      await p.evaluate((idx)=>{const c=document.querySelectorAll('.tl-card')[idx];if(c)c.click();},ci);
      await sleep(150);
      await p.evaluate((si)=>{const sl=document.querySelectorAll('.tl-slot')[si];if(sl)sl.click();},s);
      await sleep(180);
    }
    await sleep(1400);
  }
  await sleep(1700); return await checkClear(p);
}

async function playMotor(p, id, cfg){
  // Determine round total from task text like "1 / 3"
  const taskSel = { 'stretch-game':'.strg-task','throw-ball':'.tb-task','follow-action':'.fa-task','kick-ball':'.kb-task' }[id];
  let total = await roundTotalFromTask(p, taskSel);
  if(!total){
    // try generic
    total = await p.evaluate(()=>{const t=document.body.textContent;const m=t.match(/1\s*\/\s*(\d+)/);return m?parseInt(m[1]):3;});
  }
  for(let r=0;r<total;r++){
    await p.waitForFunction((b)=>document.querySelector(b),{timeout:6000},cfg.btn).catch(()=>{});
    // wait a bit for demo, then click
    await sleep(900);
    await p.evaluate((b)=>{const el=document.querySelector(b);if(el)el.click();},cfg.btn);
    await sleep(1000);
  }
  await sleep(1700); return await checkClear(p);
}
async function playBreath(p){
  // breath-game: rounds; find the confirm mechanism
  const total = await roundTotalFromTask(p,'.brth-task')||3;
  for(let r=0;r<total;r++){
    await sleep(1500);
    // click any "继续/做好了" button if present, else click a breath button
    await p.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(x=>/继续|做好|✅|完成/.test(x.textContent));if(b)b.click();});
    await sleep(800);
  }
  await sleep(1700); return await checkClear(p);
}
async function playDanceStep(p){
  const total = await roundTotalFromTask(p,'.ds-task')||3;
  for(let r=0;r<total;r++){ await sleep(1200); await p.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(x=>/✅|做好|做完|完成/.test(x.textContent));if(b)b.click();}); await sleep(800);}
  await sleep(1700); return await checkClear(p);
}
async function playScalePiano(p){
  const total = await roundTotalFromTask(p,'.sp-task')||2;
  for(let r=0;r<total;r++){ await sleep(1200); await p.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(x=>/✅|做好|做完|完成|再来/.test(x.textContent));if(b)b.click();}); await sleep(900);}
  await sleep(1700); return await checkClear(p);
}

(async () => {
  const t0 = Date.now();
  try {
    const { b, p } = await launch();
    let res = await solve(p, gameId);
    await b.close();
    console.log(JSON.stringify({ id: gameId, ms: Date.now()-t0, ...res }));
  } catch (e) {
    console.log(JSON.stringify({ id: gameId, error: e.message.split('\n')[0] }));
  }
})();
