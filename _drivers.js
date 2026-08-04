globalThis.tapStage = async function () {
  await globalThis.page.evaluate(() => {
    const s = document.querySelector('.game__stage');
    if (s) {
      const r = s.getBoundingClientRect();
      s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }));
    }
  });
};

globalThis.clickTargets = async function (reSrc) {
  return await globalThis.page.evaluate((reSrc) => {
    const stage = document.querySelector('.game__stage');
    if (!stage) return 0;
    const re = new RegExp(reSrc, 'i');
    let n = 0;
    const all = stage.querySelectorAll('div,span,button,img,svg');
    for (const e of all) {
      if (n > 6) break;
      const cls = typeof e.className === 'string' ? e.className : '';
      if (re.test(cls)) {
        const r = e.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) {
          try { e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 2 })); } catch (_) {}
          e.click();
          n++;
        }
      }
    }
    return n;
  }, reSrc);
};

globalThis.clickFinishBtn = async function () {
  return await globalThis.page.evaluate(() => {
    const re = /完成|画好|做好了|完工|完成啦|提交|晒图|画完|展示|我画完|做完了|好了！|^完成$/;
    const btns = Array.from(document.querySelectorAll('.game__stage button, .game button'));
    const fb = btns.find(b => re.test((b.textContent || '').trim()));
    if (fb) { fb.click(); return fb.textContent.trim().slice(0, 16); }
    return null;
  });
};

globalThis.sleep = function (ms) { return new Promise(r => setTimeout(r, ms)); };

globalThis.arcade = async function (id, opts) {
  opts = opts || {};
  const maxSec = opts.maxSec || 35;
  const tickMs = opts.tickMs || 85;
  const targetReSrc = opts.targetReSrc || 'star|item|fish|drop|fruit|mole|bubble|gem|coin|apple|bug|cloud|fly|egg|leaf|seed|petal|ball|note|sprout|orb|crab|firefly|popcorn|ring|bat|candy|litter|trash|dust|heart|arrow|balloon|bottle|sparkle|sprite';
  const keys = opts.keys || null;
  await globalThis.gotoGame(id);
  const present = await globalThis.page.evaluate(() => !!document.querySelector('.game__stage'));
  if (!present) return { id, cleared: false, reason: 'no-stage' };
  const start = Date.now();
  let cleared = false;
  let lastScore = null;
  while (Date.now() - start < maxSec * 1000) {
    const ov = await globalThis.page.evaluate(() => !!document.querySelector('.overlay--clear'));
    if (ov) { cleared = true; break; }
    await globalThis.tapStage();
    await globalThis.clickTargets(targetReSrc);
    if (keys) { for (const k of keys) { await globalThis.page.keyboard.press(k); await globalThis.sleep(25); } }
    lastScore = await globalThis.page.evaluate(() => { const e = document.querySelector('[id*="score" i], [class*="score" i]'); return e ? e.textContent.trim().slice(0, 40) : null; });
    await globalThis.sleep(tickMs);
  }
  const final = await globalThis.page.evaluate(() => ({ cleared: !!document.querySelector('.overlay--clear'), hash: location.hash }));
  return { id, cleared: cleared && final.cleared && final.hash === '#/' + id, finalHash: final.hash, lastScore, dur: Math.round((Date.now() - start) / 1000) };
};

globalThis.jumpGame = async function (id, opts) {
  opts = opts || {};
  const maxSec = opts.maxSec || 30;
  const hazardSel = opts.hazardSel || '[class*="crater" i],[class*="cactus" i],[class*="rock" i],[class*="spike" i],[class*="obstacle" i],[class*="hole" i],[class*="pit" i],[class*="boulder" i],[class*="fire" i],[class*="flame" i],[class*="barrier" i],[class*="wall" i],[class*="hay" i],[class*="log" i],[class*="cactus" i]';
  const footFrac = opts.footFrac || 0.32;
  await globalThis.gotoGame(id);
  const start = Date.now();
  let cleared = false;
  while (Date.now() - start < maxSec * 1000) {
    const ov = await globalThis.page.evaluate(() => !!document.querySelector('.overlay--clear'));
    if (ov) { cleared = true; break; }
    const decision = await globalThis.page.evaluate((sel, frac) => {
      const stage = document.querySelector('.game__stage');
      if (!stage) return { jump: false };
      const sr = stage.getBoundingClientRect();
      const hazards = stage.querySelectorAll(sel);
      const footX = sr.width * frac + 22;
      let jump = false;
      for (const h of hazards) {
        const hr = h.getBoundingClientRect();
        const hx = hr.left - sr.left;
        const cx = hx + hr.width / 2;
        const dist = cx - footX;
        if (dist > -20 && dist < 120) { jump = true; break; }
      }
      return { jump };
    }, hazardSel, footFrac);
    if (decision.jump) await globalThis.tapStage();
    await globalThis.sleep(35);
  }
  const final = await globalThis.page.evaluate(() => ({ cleared: !!document.querySelector('.overlay--clear'), hash: location.hash }));
  const sc = await globalThis.page.evaluate(() => { const e = document.querySelector('[id*="score" i],[class*="score" i]'); return e ? e.textContent.trim().slice(0, 40) : null; });
  return { id, cleared: cleared && final.cleared && final.hash === '#/' + id, lastScore: sc, dur: Math.round((Date.now() - start) / 1000) };
};

globalThis.creative = async function (id, opts) {
  opts = opts || {};
  await globalThis.gotoGame(id);
  const info = await globalThis.getStageInfo();
  await globalThis.drawOnCanvas();
  await globalThis.clickTargets('color|colour|stamp|tool|item|topping|deco|dress|accessory|sticker|bead|piece|ring|layer|palette|brush');
  await globalThis.sleep(400);
  let fb = await globalThis.clickFinishBtn();
  if (!fb) {
    await globalThis.clickTargets('color|stamp|tool|item|piece');
    await globalThis.sleep(300);
    fb = await globalThis.clickFinishBtn();
  }
  await globalThis.sleep(1600);
  const final = await globalThis.page.evaluate(() => ({ cleared: !!document.querySelector('.overlay--clear'), hash: location.hash }));
  return { id, cleared: final.cleared && final.hash === '#/' + id, finalHash: final.hash, finishBtn: fb, btns: info.btns };
};

globalThis.drawOnCanvas = async function () {
  await globalThis.page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return;
    const r = c.getBoundingClientRect();
    const mk = (t, x, y) => new MouseEvent(t, { bubbles: true, clientX: r.left + x, clientY: r.top + y });
    c.dispatchEvent(mk('mousedown', 30, 30));
    for (let i = 1; i <= 10; i++) c.dispatchEvent(mk('mousemove', 30 + i * 18, 30 + i * 9));
    c.dispatchEvent(mk('mouseup', 210, 120));
  });
};

globalThis.runBatch = async function (ids, fn, results, label) {
  for (const id of ids) {
    try {
      const r = await fn(id);
      results.push(r);
      console.log((r.cleared ? 'PASS ' : 'FAIL ') + id + ' :: ' + JSON.stringify(r.lastScore || r.finishBtn || r.reason || r.finalHash || ''));
    } catch (e) {
      results.push({ id, cleared: false, reason: 'EXC:' + e.message });
      console.log('EXC  ' + id + ' :: ' + e.message);
    }
  }
};

console.log('DRIVERS LOADED');
