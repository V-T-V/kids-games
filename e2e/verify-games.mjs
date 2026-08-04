/**
 * E2E 游戏验证脚本 v4 —— 高效版。
 * 从大厅页面 JS 运行时提取所有 gameId，然后逐个 hash 路由验证。
 */
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5190';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  console.log('🚀 启动 Chrome 无头浏览器...');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  // 1. 一次性获取所有 gameId —— 点击第一个卡片读 hash 模式
  //    更快：直接从 lobby 页面遍历卡片 aria-label（==游戏标题），再映射
  //    最快：直接读 import.meta.glob 的 keys
  const lobbyPage = await browser.newPage();
  await lobbyPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 3000));

  // 获取所有卡片的 hash（通过模拟点击收集）
  const gameIds = await lobbyPage.evaluate(async () => {
    const cards = document.querySelectorAll('.game-card');
    const ids = [];
    const oldHash = location.hash;
    for (let i = 0; i < cards.length; i++) {
      cards[i].click();
      await new Promise((r) => setTimeout(r, 30));
      ids.push(location.hash.replace(/^#\//, ''));
      location.hash = oldHash; // 回到大厅
    }
    return ids;
  });

  await lobbyPage.close();
  console.log(`📋 获取到 ${gameIds.length} 个游戏 ID\n`);

  const pass = [];
  const fail = [];

  // 2. 逐个验证
  for (let i = 0; i < gameIds.length; i++) {
    const gid = gameIds[i];
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text().slice(0, 150));
    });
    page.on('pageerror', (err) => errors.push(err.message.slice(0, 150)));

    try {
      await page.goto(`${BASE}/#/${gid}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await new Promise((r) => setTimeout(r, 1800));

      const info = await page.evaluate(() => {
        const stage = document.querySelector('.game__stage');
        if (!stage) return { ok: false, reason: '无stage' };
        const kids = stage.children.length;
        const text = (stage.textContent || '').trim().length;
        if (kids === 0 && text < 5) return { ok: false, reason: 'stage空' };
        return { ok: true };
      });

      if (info.ok && errors.length === 0) {
        pass.push(gid);
        if ((i + 1) % 50 === 0)
          console.log(`  ✅ ${i + 1}/${gameIds.length} (${pass.length}通过)`);
      } else {
        const reason = !info.ok ? info.reason : `JS: ${errors[0]?.slice(0, 80)}`;
        fail.push({ gid, reason });
        console.log(`  ❌ [${i + 1}] ${gid}: ${reason}`);
      }
    } catch (err) {
      fail.push({ gid, reason: `超时` });
      console.log(`  ❌ [${i + 1}] ${gid}: 超时`);
    }
    await page.close();
  }

  await browser.close();

  console.log('\n========================================');
  console.log(`📊 E2E: ${pass.length} ✅ / ${fail.length} ❌ (共 ${gameIds.length})`);
  if (fail.length > 0) {
    console.log('\n❌ 失败:');
    for (const f of fail) console.log(`  ${f.gid}: ${f.reason}`);
  } else {
    console.log('\n🎉 全部游戏 E2E 验证通过！');
  }
  console.log('========================================');
  process.exit(fail.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('崩溃:', e);
  process.exit(2);
});
