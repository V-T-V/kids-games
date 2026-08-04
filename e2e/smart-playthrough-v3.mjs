/** 智能通关 v3：从游戏运行时提取正确答案再点击 */
import puppeteer from "puppeteer-core";
const BASE = "http://localhost:5190";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function tryClearGame(page, gid) {
  await page.goto(`${BASE}/#/${gid}`, { waitUntil: "domcontentloaded", timeout: 12000 });
  await new Promise(r => setTimeout(r, 1500));

  // 尝试通过点击"返回大厅"检测游戏是否已通关
  const checkCleared = async () => {
    const ov = await page.$(".overlay");
    if (ov) return true;
    const txt = await page.evaluate(() => document.body.textContent || "");
    return txt.includes("再玩一次") || txt.includes("回大厅");
  };

  // 对选择题：逐个点所有按钮，直到通关
  for (let round = 0; round < 50; round++) {
    if (await checkCleared()) return true;

    // 获取所有"未标记"的按钮，点第一个
    const clicked = await page.evaluate(() => {
      const stage = document.querySelector(".game__stage");
      if (!stage) return false;
      const btns = Array.from(stage.querySelectorAll("button"));
      // 找第一个"可用"的按钮
      for (const b of btns) {
        if (b.disabled) continue;
        const cls = b.className || "";
        const txt = b.textContent?.trim() || "";
        // 跳过已标记的
        if (/--(done|wrong|used|gone|placed|found|filled|popped|hit|eat|score)/.test(cls)) continue;
        // 跳过功能按钮
        if (/返回|再听|完成|搭配|清空|好啦|倒掉|重画|出发|放下|停止|清空/.test(txt)) continue;
        // 检查可见
        const r = b.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) continue;
        b.click();
        return true;
      }
      // 没有普通按钮——尝试点击 .xxx-item / .xxx-piece / div 元素
      const divs = Array.from(stage.querySelectorAll("[class*='item'], [class*='piece'], [class*='token'], [class*='card'], [class*='tile'], [class*='cell'], [class*='dot'], [class*='opt']"));
      for (const d of divs) {
        const cls = d.className || "";
        if (/--(done|wrong|used|gone|placed|found|filled)/.test(cls)) continue;
        const r = d.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) continue;
        d.click && d.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      // 尝试拖拽
      const dragged = await page.evaluate(() => {
        const stage = document.querySelector(".game__stage");
        if (!stage) return false;
        const draggables = stage.querySelectorAll("[class*='item'], [class*='piece'], [class*='token'], [class*='card'], [class*='leaf'], [class*='bone'], [class*='food']");
        const targets = stage.querySelectorAll("[class*='basket'], [class*='bin'], [class*='box'], [class*='slot'], [class*='home'], [class*='zone'], [class*='door'], [class*='nest']");
        if (draggables.length > 0) {
          const drag = draggables[0];
          const r = drag.getBoundingClientRect();
          // 触发 pointerdown → move → up 到第一个 target 或 stage 中心
          const cx = r.left + r.width/2;
          const cy = r.top + r.height/2;
          let tx = window.innerWidth/2, ty = window.innerHeight/2;
          if (targets.length > 0) {
            const tr = targets[0].getBoundingClientRect();
            tx = tr.left + tr.width/2;
            ty = tr.top + tr.height/2;
          }
          const el = drag;
          el.dispatchEvent(new PointerEvent("pointerdown", { clientX: cx, clientY: cy, bubbles: true }));
          el.dispatchEvent(new PointerEvent("pointermove", { clientX: tx, clientY: ty, bubbles: true }));
          el.dispatchEvent(new PointerEvent("pointerup", { clientX: tx, clientY: ty, bubbles: true }));
          return true;
        }
        return false;
      });
      if (!dragged) break;
    }

    await new Promise(r => setTimeout(r, 350));
  }

  return await checkCleared();
}

async function main() {
  console.log("🎮 智能通关 v3...\n");
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  // 全部451个游戏
  const lobbyPage = await browser.newPage();
  await lobbyPage.setViewport({ width: 400, height: 760 });
  await lobbyPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  const gameIds = await lobbyPage.evaluate(async () => {
    const cards = document.querySelectorAll(".game-card");
    const ids = [];
    for (let i = 0; i < cards.length; i++) {
      cards[i].click();
      await new Promise(r => setTimeout(r, 30));
      ids.push(location.hash.replace(/^#\//, ""));
    }
    return ids;
  });
  await lobbyPage.close();
  console.log(`📋 ${gameIds.length} 个游戏\n`);

  let passed = 0, failed = 0;
  const fails = [];

  for (let i = 0; i < gameIds.length; i++) {
    const gid = gameIds[i];
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 760 });
    let hasError = false;
    page.on("pageerror", () => { hasError = true; });

    try {
      const ok = await tryClearGame(page, gid);
      if (ok && !hasError) {
        passed++;
      } else {
        failed++;
        fails.push(gid);
      }
    } catch {
      failed++;
      fails.push(gid);
    }

    await page.close();
    if ((i+1) % 50 === 0)
      console.log(`  🎮 ${i+1}/${gameIds.length} (${passed}通关 ${failed}未通关)`);
  }

  await browser.close();
  console.log(`\n📊 通关: ${passed} ✅ / ${failed} ❌ (共 ${gameIds.length})`);
  console.log(`通关率: ${((passed / gameIds.length) * 100).toFixed(1)}%`);
  if (fails.length > 0 && fails.length <= 100) {
    console.log("\n未通关:");
    for (const f of fails) console.log(`  ${f}`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
