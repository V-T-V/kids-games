/** 只验证5个超时游戏 */
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5190';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const games = ['color-mixer','shape-match','hedgehog-roll','cake-decor','olympic-rings'];
async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  for (const gid of games) {
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 760 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0,80)));
    try {
      await page.goto(`${BASE}/#/${gid}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 2000));
      const info = await page.evaluate(() => {
        const s = document.querySelector('.game__stage');
        return s ? { kids: s.children.length, text: (s.textContent||'').trim().length } : { kids: 0, text: 0 };
      });
      console.log(`${gid}: kids=${info.kids} text=${info.text} errors=${errors.length} ${errors.length > 0 ? errors[0] : ''}`);
    } catch(e) {
      console.log(`${gid}: FAILED - ${e.message.slice(0,80)}`);
    }
    await page.close();
  }
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
