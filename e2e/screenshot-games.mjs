/**
 * E2E 截图脚本 —— 为每个游戏截 3 张截图（不同时间点）。
 * 截图保存到 e2e/screenshots/<gameId>_1.png / _2.png / _3.png
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5190';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'e2e/screenshots';

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log('📸 启动 Chrome 截图模式...');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
           '--window-size=400,760'],
  });

  // 设置移动端视口（375x667 常见手机尺寸）
  const viewport = { width: 400, height: 760, deviceScaleFactor: 1 };

  // 1. 获取所有 gameId
  const lobbyPage = await browser.newPage();
  await lobbyPage.setViewport(viewport);
  await lobbyPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 3000));

  const gameIds = await lobbyPage.evaluate(async () => {
    const cards = document.querySelectorAll('.game-card');
    const ids = [];
    for (let i = 0; i < cards.length; i++) {
      cards[i].click();
      await new Promise((r) => setTimeout(r, 30));
      ids.push(location.hash.replace(/^#\//, ''));
    }
    return ids;
  });
  await lobbyPage.close();
  console.log(`📋 ${gameIds.length} 个游戏，每个截 3 张（共 ${gameIds.length * 3} 张）\n`);

  let done = 0;
  let failed = 0;

  // 2. 逐个截图
  for (let i = 0; i < gameIds.length; i++) {
    const gid = gameIds[i];
    const page = await browser.newPage();
    await page.setViewport(viewport);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message.slice(0, 80)));

    try {
      await page.goto(`${BASE}/#/${gid}`, { waitUntil: 'domcontentloaded', timeout: 12000 });

      // 截图1：加载后 1s（初始渲染）
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot({ path: `${OUT}/${gid}_1.png` });

      // 截图2：加载后 2.5s（动画/交互渲染）
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: `${OUT}/${gid}_2.png` });

      // 截图3：加载后 4s（完全渲染）
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: `${OUT}/${gid}_3.png` });

      done++;
      if ((i + 1) % 20 === 0)
        console.log(`  📸 ${i + 1}/${gameIds.length} (${done * 3} 张截图)`);
    } catch (err) {
      failed++;
      // 失败的游戏也截一张（便于诊断）
      try { await page.screenshot({ path: `${OUT}/${gid}_ERR.png` }); } catch {}
      console.log(`  ⚠️ [${i + 1}] ${gid}: ${err.message?.slice(0, 60)}`);
    }

    await page.close();
  }

  await browser.close();

  console.log('\n========================================');
  console.log(`📊 截图完成: ${done} 游戏 × 3 = ${done * 3} 张截图`);
  console.log(`   失败: ${failed}`);
  console.log(`   保存到: ${OUT}/`);
  console.log('========================================');
  process.exit(0);
}

main().catch((e) => {
  console.error('崩溃:', e);
  process.exit(2);
});
