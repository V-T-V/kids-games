/* eslint-disable */
/* Test harness for kids-games. Persistent across kernel calls via var bindings.
   Call ensureBrowser() first in every js block to (re)launch if needed. */
const PUP = 'D:/M_X_M/kids-games/node_modules/puppeteer-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5191/';

async function launchBrowser() {
  var puppeteer = require(PUP);
  var b = await puppeteer.launch({
    executablePath: EXE,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio', '--disable-gpu'],
    defaultViewport: { width: 400, height: 800 },
  });
  return b;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* Ensure a browser+page exist; (re)launch if dead. */
async function ensureBrowser() {
  var needNew = false;
  try {
    if (typeof globalBrowser === 'undefined' || !globalBrowser) needNew = true;
    else {
      // test it
      var pgs = await globalBrowser.pages();
      if (!pgs || pgs.length === 0) needNew = true;
    }
  } catch (e) { needNew = true; }
  if (needNew) {
    globalBrowser = await launchBrowser();
    globalPage = (await globalBrowser.pages())[0] || (await globalBrowser.newPage());
    globalPage.setDefaultTimeout(8000);
    return 'launched fresh';
  }
  try { if (typeof globalPage === 'undefined' || !globalPage) globalPage = (await globalBrowser.pages())[0]; }
  catch (e) {}
  return 'reused';
}

/* Navigate to a game with clean easy difficulty. */
async function gotoGame(id) {
  await ensureBrowser();
  await globalPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await globalPage.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await globalPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(700);
  await globalPage.evaluate((gid) => { window.location.hash = '#/' + gid; }, id);
  await sleep(1400);
}

/* Check for clear overlay. Returns {cleared, info} */
async function checkClear() {
  await sleep(200);
  var r = await globalPage.evaluate(() => {
    var ov = document.querySelector('.overlay--clear');
    if (ov) return { cleared: true, title: ov.querySelector('.overlay__title')?.textContent?.trim(), stars: ov.querySelector('.overlay__body')?.textContent?.replace(/\s+/g,' ').trim().slice(0, 30) };
    var rest = document.querySelector('.overlay--rest');
    if (rest) return { cleared: false, rest: true };
    var any = document.querySelector('.overlay');
    if (any) return { cleared: false, overlay: any.textContent?.trim().slice(0, 40) };
    return { cleared: false };
  });
  return r;
}

module.exports = {};
