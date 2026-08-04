/**
 * E2E 全面验证报告 v5 —— 368 个游戏逐个深度检测。
 *
 * 检测维度（每个游戏）：
 * 1. 页面加载是否成功（HTTP 状态）
 * 2. 游戏 stage 是否有实质内容（子元素数 + 文本长度）
 * 3. 控制台是否有 error
 * 4. 加载耗时（从导航到 stage 出现内容）
 * 5. 截图（每个游戏 1 张代表性截图）
 *
 * 输出：完整报告 + JSON 数据
 */
import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "fs";

const BASE = "http://localhost:5190";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = "e2e/screenshots";
const REPORT = "e2e/report.json";

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log("🔬 E2E 全面验证启动...\n");

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  // 1. 获取所有 gameId
  const lobbyPage = await browser.newPage();
  await lobbyPage.setViewport({ width: 400, height: 760 });
  await lobbyPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 3000));

  const gameIds = await lobbyPage.evaluate(async () => {
    const cards = document.querySelectorAll(".game-card");
    const ids = [];
    for (let i = 0; i < cards.length; i++) {
      cards[i].click();
      await new Promise((r) => setTimeout(r, 30));
      ids.push(location.hash.replace(/^#\//, ""));
    }
    return ids;
  });
  await lobbyPage.close();
  console.log(`📋 检测 ${gameIds.length} 个游戏\n`);

  const results = [];
  let pass = 0;
  let fail = 0;
  let warn = 0;

  // 2. 逐个深度检测
  for (let i = 0; i < gameIds.length; i++) {
    const gid = gameIds[i];
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 760 });
    const errors = [];
    const warnings = [];

    page.on("console", (msg) => {
      const t = msg.type();
      if (t === "error") errors.push(msg.text().slice(0, 200));
      else if (t === "warning") warnings.push(msg.text().slice(0, 100));
    });
    page.on("pageerror", (err) => errors.push(err.message.slice(0, 200)));

    const t0 = Date.now();
    let status = "pass";
    let reason = "";

    try {
      const resp = await page.goto(`${BASE}/#/${gid}`, {
        waitUntil: "domcontentloaded",
        timeout: 12000,
      });
      await new Promise((r) => setTimeout(r, 2000));

      const loadMs = Date.now() - t0;

      // 深度检测 stage 内容
      const info = await page.evaluate(() => {
        const stage = document.querySelector(".game__stage");
        if (!stage) return { hasStage: false, kids: 0, textLen: 0, hasButtons: 0, hasCanvas: false };
        const kids = stage.children.length;
        const text = (stage.textContent || "").trim().length;
        const btns = stage.querySelectorAll("button").length;
        const canvas = !!stage.querySelector("canvas");
        return { hasStage: true, kids, textLen: text, hasButtons: btns, hasCanvas: canvas };
      });

      // 截图
      await page.screenshot({ path: `${OUT}/${gid}.png` });

      // 判定
      if (!info.hasStage) {
        status = "fail";
        reason = "无.game__stage元素";
        fail++;
      } else if (info.kids === 0 && info.textLen < 5) {
        status = "fail";
        reason = "stage内容为空";
        fail++;
      } else if (errors.length > 0) {
        status = "fail";
        reason = `JS错误: ${errors[0].slice(0, 80)}`;
        fail++;
      } else if (info.kids === 0) {
        status = "warn";
        reason = `stage子元素为0(文本${info.textLen})`;
        warn++;
      } else if (warnings.length > 3) {
        status = "warn";
        reason = `控制台${warnings.length}条警告`;
        warn++;
      } else {
        pass++;
      }

      results.push({
        gid,
        status,
        reason,
        loadMs,
        stageKids: info.kids,
        textLen: info.textLen,
        buttons: info.hasButtons,
        canvas: info.hasCanvas,
        errors: errors.length,
        warnings: warnings.length,
      });

      if (status === "fail")
        console.log(`  ❌ [${i + 1}] ${gid}: ${reason}`);
      else if (status === "warn")
        console.log(`  ⚠️ [${i + 1}] ${gid}: ${reason}`);
      else if ((i + 1) % 50 === 0)
        console.log(`  ✅ ${i + 1}/${gameIds.length} (${pass}通过 ${warn}警告 ${fail}失败)`);
    } catch (err) {
      fail++;
      status = "fail";
      reason = `超时/异常`;
      results.push({ gid, status, reason, loadMs: Date.now() - t0, errors: 1 });
      console.log(`  ❌ [${i + 1}] ${gid}: 超时/异常`);
    }

    await page.close();
  }

  await browser.close();

  // 3. 统计分析
  const loadTimes = results.filter((r) => r.loadMs).map((r) => r.loadMs);
  const avgLoad = Math.round(loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length);
  const maxLoad = Math.max(...loadTimes);
  const minLoad = Math.min(...loadTimes);
  const slowGames = results.filter((r) => r.loadMs > 5000).map((r) => `${r.gid}(${r.loadMs}ms)`);
  const emptyStage = results.filter((r) => r.stageKids === 0).map((r) => r.gid);
  const withCanvas = results.filter((r) => r.canvas).length;

  const report = {
    summary: {
      total: gameIds.length,
      pass,
      warn,
      fail,
      passRate: `${((pass / gameIds.length) * 100).toFixed(1)}%`,
    },
    performance: {
      avgLoadMs: avgLoad,
      minLoadMs: minLoad,
      maxLoadMs: maxLoad,
      slowGames: slowGames.slice(0, 10),
    },
    quality: {
      emptyStageGames: emptyStage.slice(0, 10),
      canvasGames: withCanvas,
      gamesWithWarnings: results.filter((r) => r.warnings > 0).length,
    },
    failures: results.filter((r) => r.status === "fail"),
    warnings: results.filter((r) => r.status === "warn"),
  };

  // 写 JSON 报告
  writeFileSync(REPORT, JSON.stringify(report, null, 2));

  // 打印完整报告
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║       E2E 全面验证报告                    ║");
  console.log("╚══════════════════════════════════════════╝\n");

  console.log("📊 总结:");
  console.log(`   总游戏数: ${report.summary.total}`);
  console.log(`   ✅ 通过:   ${report.summary.pass} (${report.summary.passRate})`);
  console.log(`   ⚠️ 警告:   ${report.summary.warn}`);
  console.log(`   ❌ 失败:   ${report.summary.fail}`);

  console.log("\n⏱️ 性能:");
  console.log(`   平均加载: ${report.performance.avgLoadMs}ms`);
  console.log(`   最快:     ${report.performance.minLoadMs}ms`);
  console.log(`   最慢:     ${report.performance.maxLoadMs}ms`);
  if (slowGames.length > 0) {
    console.log(`   慢游戏(>5s): ${slowGames.length} 个`);
    for (const s of report.performance.slowGames) console.log(`     - ${s}`);
  }

  console.log("\n📋 质量:");
  console.log(`   Canvas游戏: ${report.quality.canvasGames}`);
  console.log(`   有控制台警告的游戏: ${report.quality.gamesWithWarnings}`);
  if (report.quality.emptyStageGames.length > 0) {
    console.log(`   stage子元素=0的游戏: ${report.quality.emptyStageGames.length}`);
    for (const g of report.quality.emptyStageGames) console.log(`     - ${g}`);
  }

  if (report.failures.length > 0) {
    console.log("\n❌ 失败详情:");
    for (const f of report.failures)
      console.log(`   ${f.gid}: ${f.reason}`);
  }
  if (report.warnings.length > 0) {
    console.log("\n⚠️ 警告详情:");
    for (const w of report.warnings)
      console.log(`   ${w.gid}: ${w.reason}`);
  }

  console.log(`\n📄 完整 JSON 报告: ${REPORT}`);
  console.log(`📸 截图: ${OUT}/ (${results.filter((r) => r.status !== "fail").length} 张)\n`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("脚本崩溃:", e);
  process.exit(2);
});
