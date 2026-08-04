// Test harness for kids-games
const puppeteer = require('D:/M_X_M/kids-games/node_modules/puppeteer-core');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=400,800', '--hide-scrollbars'],
  defaultViewport: { width: 400, height: 800, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gotoGame(id) {
  await page.goto('http://localhost:5191/#/' + id, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1100);
}

async function checkClear(id) {
  return await page.evaluate((gid) => {
    const ov = document.querySelector('.overlay--clear');
    return { cleared: !!ov, hash: location.hash, expect: '#/' + gid };
  }, id);
}

async function getStageInfo() {
  return await page.evaluate(() => {
    const stage = document.querySelector('.game__stage');
    const scoreEl = document.querySelector('[id*="score" i], [class*="score" i]');
    const taskEl = document.querySelector('[class*="task" i], [class*="hint" i], [class*="prompt" i]');
    const btns = Array.from(document.querySelectorAll('.game__stage button, .game button')).map(b => (b.textContent || '').trim().slice(0, 14)).filter(Boolean);
    const hasCanvas = !!document.querySelector('canvas');
    return {
      stageLen: stage ? stage.innerHTML.length : 0,
      score: scoreEl ? scoreEl.textContent.trim().slice(0, 40) : null,
      task: taskEl ? taskEl.textContent.trim().slice(0, 70) : null,
      btns: btns.slice(0, 18),
      hasCanvas: hasCanvas,
    };
  });
}

async function tapStage() {
  await page.evaluate(() => {
    const s = document.querySelector('.game__stage');
    if (s) {
      const r = s.getBoundingClientRect();
      s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }));
    }
  });
}

async function clickTargets(reSrc) {
  return await page.evaluate((reSrc) => {
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
}

async function clickFinishBtn() {
  return await page.evaluate(() => {
    const re = /完成|画好|做好了|完工|完成啦|提交|晒图|画完|展示|我画完|做完了|好了！|^完成$/;
    const btns = Array.from(document.querySelectorAll('.game__stage button, .game button'));
    const fb = btns.find(b => re.test((b.textContent || '').trim()));
    if (fb) { fb.click(); return fb.textContent.trim().slice(0, 16); }
    return null;
  });
}

async function drawOnCanvas() {
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return;
    const r = c.getBoundingClientRect();
    const mk = (t, x, y) => new MouseEvent(t, { bubbles: true, clientX: r.left + x, clientY: r.top + y });
    c.dispatchEvent(mk('mousedown', 30, 30));
    for (let i = 1; i <= 10; i++) c.dispatchEvent(mk('mousemove', 30 + i * 18, 30 + i * 9));
    c.dispatchEvent(mk('mouseup', 210, 120));
  });
}

// Arcade autoplay: tap stage + click targets + optional keys
async function arcade(id, opts) {
  opts = opts || {};
  const maxSec = opts.maxSec || 35;
  const tickMs = opts.tickMs || 85;
  const targetRe = opts.targetRe || /star|item|fish|drop|fruit|mole|bubble|gem|coin|apple|bug|cloud|fly|egg|leaf|seed|petal|ball|note|sprout|orb|crab|firefly|popcorn|ring|bat|candy|litter|trash|dust|heart|arrow|balloon|bottle|sparkle|sprite/i;
  const keys = opts.keys || null;
  await gotoGame(id);
  const present = await page.evaluate(() => !!document.querySelector('.game__stage'));
  if (!present) return { id, cleared: false, reason: 'no-stage' };
  const start = Date.now();
  let cleared = false;
  let lastScore = null;
  while (Date.now() - start < maxSec * 1000) {
    const ov = await page.evaluate(() => !!document.querySelector('.overlay--clear'));
    if (ov) { cleared = true; break; }
    await tapStage();
    await clickTargets(targetRe.source);
    if (keys) { for (const k of keys) { await page.keyboard.press(k); await sleep(25); } }
    const sc = await page.evaluate(() => { const e = document.querySelector('[id*="score" i], [class*="score" i]'); return e ? e.textContent.trim().slice(0, 40) : null; });
    lastScore = sc;
    await sleep(tickMs);
  }
  const final = await page.evaluate(() => ({ cleared: !!document.querySelector('.overlay--clear'), hash: location.hash }));
  return { id, cleared: cleared && final.cleared && final.hash === '#/' + id, finalHash: final.hash, lastScore, dur: Math.round((Date.now() - start) / 1000) };
}

// Creative: interact then click finish
async function creative(id, opts) {
  opts = opts || {};
  await gotoGame(id);
  const info = await getStageInfo();
  // do some drawing/clicking
  await drawOnCanvas();
  await clickTargets(/color|colour|stamp|tool|item|topping|deco|dress|accessory|sticker|bead|piece|ring|layer/i.source);
  await sleep(400);
  // look for finish button
  let fb = await clickFinishBtn();
  if (!fb) {
    // maybe need more interaction; try clicking a color then finish
    await clickTargets(/color|stamp|tool/i.source);
    await sleep(300);
    fb = await clickFinishBtn();
  }
  await sleep(1600);
  const final = await page.evaluate(() => ({ cleared: !!document.querySelector('.overlay--clear'), hash: location.hash }));
  return { id, cleared: final.cleared && final.hash === '#/' + id, finalHash: final.hash, finishBtn: fb, btns: info.btns };
}

globalThis.browser = browser;
globalThis.page = page;
globalThis.gotoGame = gotoGame;
globalThis.checkClear = checkClear;
globalThis.getStageInfo = getStageInfo;
globalThis.tapStage = tapStage;
globalThis.clickTargets = clickTargets;
globalThis.clickFinishBtn = clickFinishBtn;
globalThis.drawOnCanvas = drawOnCanvas;
globalThis.arcade = arcade;
globalThis.creative = creative;
globalThis.sleep = sleep;

console.log('BOOTED OK');
