/** 对指定游戏重新截图（验证视觉优化效果） */
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5190';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'e2e/screenshots';
const games = ['scarecrow-dress','raindrop-math','olympic-rings','gravity-flip','ninja-jump','fruit-catch','catch-star'];

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  for (const gid of games) {
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 760 });
    await page.goto(`${BASE}/#/${gid}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: `${OUT}/${gid}_optimized.png` });
    console.log(`📸 ${gid} 截图完成`);
    await page.close();
  }
  await browser.close();
  console.log('Done.');
}
main().catch(e => { console.error(e); process.exit(1); });
