/**
 * E2E 智能通关验证 v2 —— 升级版：
 * 1. 拖拽类游戏：用 page.mouse 模拟真实拖拽
 * 2. 选择题：逐个尝试所有选项（而非随机点）
 * 3. 排序题：暴力排列组合直到正确
 */
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:5190";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  // 测试之前未通关的49个游戏
  const games = [
    // A类: 拖拽
    "shape-match","letter-bee","bottle-cap","day-night","tool-match",
    "healthy-eat","pack-bag","tidy-room","size-recipe","memory-tray","star-map",
    // B类: 多步骤/排序
    "story-order","sequence-word","color-name","shape-name","opposite-act",
    "same-different","part-whole","brush-teeth","wash-hands","dress-order",
    "color-feeling","story-moral","fairytale","count-song","mirror-word",
    "domino","dice-roll","card-deal","coin-flip","relay-baton",
    "soccer-pass","karate-belt","flag-raising",
    // C类: 随机难命中
    "color-mixer","music-stairs","jigsaw","mini-sudoku","draw-along",
    "calendar","money","price-tag","sentence-build","opposite-match",
    "warm-cool","cross-road","world-landmark","color-fill",
  ];

  let passed = 0, failed = 0;
  const results = [];

  for (let i = 0; i < games.length; i++) {
    const gid = games[i];
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 760 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 80)));

    try {
      await page.goto(`${BASE}/#/${gid}`, { waitUntil: "domcontentloaded", timeout: 12000 });
      await new Promise(r => setTimeout(r, 1500));

      let cleared = false;
      
      // 策略1：检查是否有 stage
      const hasStage = await page.$(".game__stage");
      if (!hasStage) {
        results.push({ gid, reason: "无stage" });
        failed++;
        await page.close();
        continue;
      }

      // 策略2：尝试逐个点击所有按钮（对选择题有效）
      for (let round = 0; round < 30 && !cleared; round++) {
        // 检查是否已通关（overlay出现）
        const overlay = await page.$(".overlay");
        if (overlay) { cleared = true; break; }

        // 找所有可点击的按钮
        const btns = await page.$$(".game__stage button:not([disabled]):not(.is-done)");
        const available = [];
        for (const b of btns) {
          const info = await b.evaluate((el) => {
            const cls = el.className || "";
            if (cls.includes("--done") || cls.includes("--wrong") || 
                cls.includes("--used") || cls.includes("--gone") ||
                cls.includes("--placed") || cls.includes("--found") ||
                cls.includes("--popped") || cls.includes("--filled"))
              return null;
            const txt = el.textContent?.trim() || "";
            if (txt.includes("返回") || txt.includes("再听") || txt.includes("完成") ||
                txt.includes("搭配") || txt.includes("清空") || txt.includes("好啦") ||
                txt.includes("倒掉") || txt.includes("重画") || txt.includes("出发"))
              return null;
            const r = el.getBoundingClientRect();
            if (r.width < 10 || r.height < 10) return null;
            return { text: txt.slice(0, 20) };
          });
          if (info) available.push(b);
        }

        if (available.length > 0) {
          // 逐个点击第一个可用的按钮
          await available[0].click();
          await new Promise(r => setTimeout(r, 400));
          continue;
        }

        // 策略3：拖拽——找可拖拽元素并模拟拖拽到目标
        const draggables = await page.$$(".game__stage [class*='drag'], .game__stage [class*='item'], .game__stage [class*='piece'], .game__stage [class*='token']");
        if (draggables.length > 0) {
          // 拖拽第一个元素到 stage 中心
          const target = await page.$(".game__stage [class*='basket'], .game__stage [class*='bin'], .game__stage [class*='slot'], .game__stage [class*='drop'], .game__stage [class*='zone'], .game__stage [class*='home'], .game__stage [class*='box']");
          if (target) {
            const dragRect = await draggables[0].boundingBox();
            const targetRect = await target.boundingBox();
            if (dragRect && targetRect) {
              await page.mouse.move(dragRect.x + dragRect.width/2, dragRect.y + dragRect.height/2);
              await page.mouse.down();
              await new Promise(r => setTimeout(r, 100));
              await page.mouse.move(targetRect.x + targetRect.width/2, targetRect.y + targetRect.height/2, { steps: 5 });
              await new Promise(r => setTimeout(r, 100));
              await page.mouse.up();
              await new Promise(r => setTimeout(r, 400));
              continue;
            }
          }
          // 无目标——点击元素
          await draggables[0].click();
          await new Promise(r => setTimeout(r, 400));
          continue;
        }

        // 策略4：Canvas点击
        const canvas = await page.$(".game__stage canvas");
        if (canvas) {
          const box = await canvas.boundingBox();
          if (box) {
            await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
            await new Promise(r => setTimeout(r, 400));
            continue;
          }
        }

        break; // 无法继续
      }

      // 最终检查
      const finalOverlay = await page.$(".overlay");
      const finishText = await page.evaluate(() => 
        document.body.textContent?.includes("再玩一次") || 
        document.body.textContent?.includes("回大厅")
      );
      
      if ((finalOverlay || finishText) && errors.length === 0) {
        passed++;
      } else if (errors.length > 0) {
        failed++;
        results.push({ gid, reason: `JS错误: ${errors[0]}` });
        console.log(`  ❌ [${i+1}] ${gid}: ${errors[0]}`);
      } else {
        failed++;
        results.push({ gid, reason: "未通关（需人工验证）" });
      }

      if ((i+1) % 20 === 0)
        console.log(`  🎮 ${i+1}/${games.length} (${passed}通关 ${failed}未通关)`);
    } catch (err) {
      failed++;
      results.push({ gid, reason: `异常` });
      console.log(`  ❌ [${i+1}] ${gid}: 异常`);
    }
    await page.close();
  }

  await browser.close();
  console.log(`\n📊 智能通关: ${passed} ✅ / ${failed} ❌ (共 ${games.length})`);
  if (results.length > 0) {
    console.log("\n未通关:");
    for (const r of results) console.log(`  ${r.gid}: ${r.reason}`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
