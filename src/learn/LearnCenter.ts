/**
 * 学习中心 —— 把 575 个游戏组织成渐进学习路径的入口页。
 *
 * 展示 5 条路径卡片（启蒙认知 → 文字语言 → 数学思维 → 科学常识 → 综合复习），
 * 每张卡片显示年龄、进度条、通关数。点卡片进路径详情页（learn/<id>）。
 * 完成度由 save.progress[gameId].cleared 派生，零新存储。
 */
import "./learn.css";
import {
  LEARN_PATHS,
  pathClearedCount,
  learnOverallProgress,
} from "./paths.ts";
import {
  DOMAINS,
  allDomainProgress,
  recommendNextGame,
  getSkillProfile,
} from "./model.ts";
import { loadSave, countCleared, ALL_GAME_IDS } from "../core/storage.ts";
import { navigate } from "../router.ts";
import { getCssVar } from "../lobby/util.ts";
import { GAMES } from "../games/registry.ts";

export function renderLearnCenter(root: HTMLElement): void {
  const save = loadSave();
  const overall = learnOverallProgress(save);
  const totalCleared = countCleared(save);

  root.innerHTML = "";
  const center = document.createElement("div");
  center.className = "learn";

  /* —— 头部 —— */
  const header = document.createElement("header");
  header.className = "learn__header";
  const overallPct =
    overall.total > 0 ? Math.round((overall.cleared / overall.total) * 100) : 0;
  header.innerHTML = `
    <button type="button" class="learn__back" aria-label="返回大厅">← 大厅</button>
    <h1 class="learn__title"><span class="learn__emoji">📚</span> 学习中心</h1>
    <p class="learn__subtitle">跟着路径一步步学，从简单到挑战 🌱</p>
    <div class="learn__overall">
      <span>路径进度</span>
      <div class="learn__progress-bar"><div class="learn__progress-fill" style="width:${overallPct}%"></div></div>
      <span>${overall.cleared}/${overall.total}</span>
      <span class="learn__overall-chip">🎮 全游戏 ${totalCleared}/${ALL_GAME_IDS.length}</span>
    </div>`;
  center.appendChild(header);

  /* —— 返回大厅 —— */
  header
    .querySelector<HTMLButtonElement>(".learn__back")!
    .addEventListener("click", () => navigate(""));

  /* —— 6 大发展领域概览（加德纳多元智能）—— */
  const domainsBox = document.createElement("div");
  domainsBox.className = "learn__domains";
  const dTitle = document.createElement("h3");
  dTitle.className = "learn__domains-title";
  dTitle.textContent = "🧠 六大发展领域";
  domainsBox.appendChild(dTitle);
  const dGrid = document.createElement("div");
  dGrid.className = "learn__domains-grid";
  const dp = allDomainProgress(save);
  for (const d of DOMAINS) {
    const prog = dp.find((p) => p.domain === d.id)!;
    const pct =
      prog.total > 0 ? Math.round((prog.cleared / prog.total) * 100) : 0;
    const chip = document.createElement("div");
    chip.className = "learn__domain-chip";
    chip.style.setProperty("--domain-color", d.color);
    chip.innerHTML = `<span class="learn__domain-icon">${d.icon}</span>
      <span class="learn__domain-name">${d.title}</span>
      <span class="learn__domain-prog">${prog.cleared}/${prog.total}${prog.avgStars > 0 ? " · ⭐" + prog.avgStars : ""}</span>
      <div class="learn__domain-bar"><div class="learn__domain-fill" style="width:${pct}%"></div></div>`;
    dGrid.appendChild(chip);
  }
  domainsBox.appendChild(dGrid);
  center.appendChild(domainsBox);

  /* —— 智能推荐：基于理论模型推荐下一步该玩什么 —— */
  const recGameId = recommendNextGame(save);
  if (recGameId) {
    const recMeta = GAMES.find((g) => g.id === recGameId);
    if (recMeta) {
      const recProfile = getSkillProfile(recGameId);
      const recDomain = DOMAINS.find((d) => d.id === recProfile.domain);
      const recBox = document.createElement("button");
      recBox.type = "button";
      recBox.className = "learn__recommend";
      recBox.style.setProperty("--rec-color", recDomain?.color ?? "#4d96ff");
      recBox.innerHTML = `<span class="learn__recommend-icon">💡</span>
        <div class="learn__recommend-body">
          <div class="learn__recommend-label">推荐下一步</div>
          <div class="learn__recommend-title">${recMeta.icon} ${recMeta.title}</div>
          <div class="learn__recommend-hint">${recMeta.subtitle} · ${recDomain?.title ?? ""}</div>
        </div>
        <span class="learn__recommend-go">▶</span>`;
      recBox.setAttribute("aria-label", "推荐游戏：" + recMeta.title);
      recBox.addEventListener("click", () => navigate(recGameId));
      center.appendChild(recBox);
    }
  }

  /* —— 路径卡片网格 —— */
  const grid = document.createElement("div");
  grid.className = "learn__grid";
  for (const path of LEARN_PATHS) {
    grid.appendChild(makePathCard(path, save));
  }
  center.appendChild(grid);

  root.appendChild(center);
}

function makePathCard(
  path: (typeof LEARN_PATHS)[number],
  save: ReturnType<typeof loadSave>,
): HTMLElement {
  const cleared = pathClearedCount(path, save);
  const total = path.games.length;
  const pct = total > 0 ? Math.round((cleared / total) * 100) : 0;
  const done = cleared >= total;
  const color = getCssVar(path.themeVar);

  const card = document.createElement("button");
  card.type = "button";
  card.className = "learn-card";
  card.style.setProperty("--path-color", color);
  card.setAttribute(
    "aria-label",
    `${path.title}，${path.ageRange}，${cleared}/${total} 通关`,
  );
  card.innerHTML = `
    ${done ? '<div class="learn-card__done">✅</div>' : ""}
    <div class="learn-card__icon" aria-hidden="true">${path.icon}</div>
    <div class="learn-card__title">${path.title}</div>
    <div class="learn-card__age">${path.ageRange} · 第 ${path.stage} 阶</div>
    <div class="learn-card__subtitle">${path.subtitle}</div>
    <div class="learn-card__progress">
      <div class="learn-card__progress-track"><div class="learn-card__progress-fill" style="width:${pct}%"></div></div>
      <span>${cleared}/${total}</span>
    </div>
    <div class="learn-card__cta">${done ? "复习巩固" : cleared > 0 ? "继续学习" : "开始学习"} →</div>`;
  card.addEventListener("click", () => navigate("learn/" + path.id));
  return card;
}
