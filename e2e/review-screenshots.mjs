/** 截取指定游戏的交互后截图（模拟点击第一个按钮后的状态） */
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5190';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
// 取各类代表性游戏截图
const games = [
  'color-mixer','shape-match','number-monster','memory-flip','maze-adventure',
  'fruit-catch','snake','2048','pinyin','emotion','doodle','clock',
  'listen-act','story-order','share-toy','brush-teeth','warm-cool','lace-board',
  'world-landmark','plant-grow','color-feeling','letter-trace'
];
async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  for (const gid of games) {
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 760 });
    await page.goto(`${BASE}/#/${gid}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: `e2e/screenshots/${gid}_review.png` });
    console.log(`📸 ${gid}`);
    await page.close();
  }
  await browser.close();
  console.log('Done.');
}
main().catch(e => { console.error(e); process.exit(1); });
