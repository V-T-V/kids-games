/**
 * 家长面板 —— 难度锁定、静音、休息护盾、成就墙、进度、重置。
 *
 * 入口是右上角齿轮（index.html 固定）。模态覆盖层。
 * 使用真实 DOM 节点直接绑定事件，设置实时写入存档并生效。
 */
import { Overlay } from "./Overlay.ts";
import { toast } from "./toast.ts";
import { loadSave, resetSave, updateSettings } from "../core/storage.ts";
import { GAMES } from "../games/registry.ts";
import { unlockAudio } from "../core/audio.ts";
import { clearParticles } from "../core/particles.ts";
import { hideMascot } from "../core/mascot.ts";
import { ACHIEVEMENTS } from "../core/achievements.ts";
import {
  buildParentReport,
  formatParentSummary,
} from "../core/parentReport.ts";
import type { Difficulty } from "../types.ts";

const CAT_LABEL: Record<string, string> = {
  milestone: "🏆 里程碑",
  category: "📂 品类集齐",
  skill: "⭐ 技能挑战",
  hidden: "🎁 隐藏成就",
};

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

function settingRow(label: string, control: HTMLElement): HTMLElement {
  const row = el("div", "pp-row");
  const l = el("span", "pp-row__label");
  l.textContent = label;
  row.appendChild(l);
  row.appendChild(control);
  return row;
}

/** 开关按钮：点击切换并回调，返回当前是否开启。 */
function toggleBtn(
  active: boolean,
  onToggle: () => boolean,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  const render = (on: boolean) => {
    b.className = `pp-toggle ${on ? "pp-toggle--on" : ""}`;
    b.textContent = on ? "开 ✅" : "关";
  };
  render(active);
  b.addEventListener("click", () => {
    unlockAudio();
    render(onToggle());
  });
  return b;
}

function diffPicker(
  current: Difficulty | null,
  onChange: (d: Difficulty | null) => void,
): HTMLElement {
  const wrap = el("div", "pp-diff");
  const opts: { v: Difficulty | null; label: string }[] = [
    { v: null, label: "自动" },
    { v: "easy", label: "简单" },
    { v: "medium", label: "中等" },
    { v: "hard", label: "困难" },
  ];
  for (const o of opts) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `pp-diff__btn ${current === o.v ? "is-active" : ""}`;
    b.textContent = o.label;
    b.addEventListener("click", () => {
      onChange(o.v);
      wrap
        .querySelectorAll(".pp-diff__btn")
        .forEach((n) => n.classList.remove("is-active"));
      b.classList.add("is-active");
    });
    wrap.appendChild(b);
  }
  return wrap;
}

/** 构建整个面板内容 DOM（含事件绑定）。 */
function buildBody(): HTMLElement {
  const save = loadSave();
  const root = el("div", "pp-root");

  /* —— 设置区 —— */
  const settingsBox = el("div", "pp-section");
  const sTitle = el("h3", "pp-section__title");
  sTitle.textContent = "⚙️ 设置";
  settingsBox.appendChild(sTitle);

  settingsBox.appendChild(
    settingRow(
      "音效",
      toggleBtn(!save.settings.muted, () => {
        const s = loadSave();
        updateSettings(s, { muted: !s.settings.muted });
        toast(s.settings.muted ? "已静音 🔇" : "已开启音效 🔊");
        return !s.settings.muted;
      }),
    ),
  );

  settingsBox.appendChild(
    settingRow(
      "休息护盾",
      toggleBtn(save.settings.restShield, () => {
        const s = loadSave();
        updateSettings(s, { restShield: !s.settings.restShield });
        toast(s.settings.restShield ? "护盾已开启 🛡️" : "护盾已关闭");
        return s.settings.restShield;
      }),
    ),
  );

  settingsBox.appendChild(
    settingRow(
      "难度锁定",
      diffPicker(save.settings.lockedDifficulty, (d) => {
        const s = loadSave();
        updateSettings(s, { lockedDifficulty: d });
        const label =
          d === null
            ? "自适应"
            : d === "easy"
              ? "简单"
              : d === "medium"
                ? "中等"
                : "困难";
        toast(`难度：${label}`);
      }),
    ),
  );
  root.appendChild(settingsBox);

  /* —— 家长报告 —— */
  const report = buildParentReport(save);
  const reportBox = el("div", "pp-section");
  const rTitle = el("h3", "pp-section__title");
  rTitle.textContent = "📈 家长报告";
  reportBox.appendChild(rTitle);
  const summary = el("div", "pp-report__summary");
  summary.textContent = formatParentSummary(report);
  reportBox.appendChild(summary);
  const stats = el("div", "pp-report__stats");
  stats.innerHTML = `<span>体验 ${report.playedGames}/${report.totalGames}</span>
    <span>通关 ${report.clearedGames}</span>
    <span>完成率 ${report.completionRate}%</span>
    <span>累计 ${report.totalPlayCount} 局</span>
    <span>时长 ${report.totalMinutes} 分钟</span>`;
  reportBox.appendChild(stats);
  if (report.averageSessionMinutes > 0) {
    const timeLine = el("div", "pp-report__line");
    timeLine.textContent = `平均每局：${report.averageSessionMinutes} 分钟；时长用于观察专注度，不用于评价孩子。`;
    reportBox.appendChild(timeLine);
  }
  if (report.strengths.length > 0) {
    const strong = el("div", "pp-report__line");
    strong.textContent = `优势能力：${report.strengths
      .map((s) => `${s.skill}(${s.averageStars}⭐)`)
      .join("、")}`;
    reportBox.appendChild(strong);
  }
  if (report.practice.length > 0) {
    const practice = el("div", "pp-report__line");
    practice.textContent = `建议练习：${report.practice
      .map((s) => `${s.skill}(${s.cleared}/${s.played}通关)`)
      .join("、")}`;
    reportBox.appendChild(practice);
  }
  const rec = el("div", "pp-report__line");
  rec.textContent = `推荐下一步：${report.recommendedGames
    .map((id) => GAMES.find((g) => g.id === id)?.title ?? id)
    .join("、")}`;
  reportBox.appendChild(rec);
  root.appendChild(reportBox);

  /* —— 成就墙（按分类分组） —— */
  const achBox = el("div", "pp-section");
  const aTitle = el("h3", "pp-section__title");
  aTitle.textContent = `🏆 成就墙（${save.achievements.length}/${ACHIEVEMENTS.length}）`;
  achBox.appendChild(aTitle);

  const cats = ["milestone", "category", "skill", "hidden"] as const;
  for (const cat of cats) {
    const items = ACHIEVEMENTS.filter((a) => a.category === cat);
    if (items.length === 0) continue;
    const catLabel = el("div", "pp-ach-cat");
    catLabel.textContent = CAT_LABEL[cat] ?? cat;
    achBox.appendChild(catLabel);
    const grid = el("div", "pp-ach");
    for (const a of items) {
      const unlocked = save.achievements.includes(a.id);
      const card = el("div", `pp-ach__card ${unlocked ? "" : "is-locked"}`);
      const showHint = unlocked || !a.hidden;
      card.innerHTML = `<div class="pp-ach__icon">${unlocked ? a.icon : "🔒"}</div>
        <div class="pp-ach__name">${unlocked || !a.hidden ? a.name : "???"}</div>
        <div class="pp-ach__desc">${showHint ? a.hint : "神秘成就，待你发现"}</div>`;
      grid.appendChild(card);
    }
    achBox.appendChild(grid);
  }
  root.appendChild(achBox);

  /* —— 进度 —— */
  const progBox = el("div", "pp-section");
  const pTitle = el("h3", "pp-section__title");
  pTitle.textContent = "📊 游戏进度";
  progBox.appendChild(pTitle);
  for (const g of GAMES) {
    const p = save.progress[g.id];
    const row = el("div", "pp-prog");
    row.innerHTML = `<span class="pp-prog__icon">${g.icon}</span>
      <span class="pp-prog__name">${g.title}</span>
      <span class="pp-prog__stars">${"⭐".repeat(p.bestStars)}${p.cleared ? " ✅" : ""}</span>`;
    progBox.appendChild(row);
  }
  root.appendChild(progBox);

  return root;
}

export function openParentPanel(): void {
  const overlay = new Overlay({
    title: "家长面板",
    body: buildBody(),
    variant: "default",
    primary: {
      text: "完成",
      icon: "👌",
      onClick: () => overlay.destroy(),
    },
    secondary: {
      text: "重置进度",
      icon: "🗑️",
      onClick: () => {
        resetSave();
        clearParticles();
        hideMascot();
        toast("进度已重置 ✨");
        overlay.destroy();
      },
    },
  });
  overlay.show();
}
