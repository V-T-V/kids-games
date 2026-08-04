import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();

  console.log('Connecting to http://localhost:5190/ ...');
  const resp = await page.goto('http://localhost:5190/', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  console.log('HTTP status:', resp?.status());

  // 等 SPA 渲染
  await new Promise((r) => setTimeout(r, 2000));

  const title = await page.title();
  console.log('Title:', title);

  const cardCount = await page
    .$$eval('.game-card', (els) => els.length)
    .catch(() => 0);
  console.log('Game cards:', cardCount);

  await browser.close();
  console.log('Done.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
