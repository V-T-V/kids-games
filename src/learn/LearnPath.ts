/**
 * 学习路径详情页 —— 展示某条路径的全部游戏，按由浅入深排序的有序步骤列表。
 *
 * 渐进解锁：第 1 关默认解锁，前一关 cleared 后才解锁下一关。
 * 未解锁的游戏显示 🔒 灰色、不可点击（点一下提示原因）。已解锁未通关的标"当前"。
 * 顶部：返回学习中心 + 路径进度。
 */
import { findPath, pathClearedCount } from "./paths.ts";
import {
  deriveSkillProfile,
  COGNITIVE_TIERS,
  BLOOM_LEVELS,
  type CognitiveTier,
} from "./model.ts";
import { loadSave } from "../core/storage.ts";
import { findGame } from "../games/registry.ts";
import { navigate } from "../router.ts";
import { getCssVar } from "../lobby/util.ts";
import { toast } from "../ui/toast.ts";
import type { GameId } from "../types.ts";

/** 某关是否已解锁：第 0 关恒解锁；其余需前一关 cleared。 */
function isUnlocked(
  games: readonly string[],
  i: number,
  save: ReturnType<typeof loadSave>,
): boolean {
  if (i <= 0) return true;
  return Boolean(save.progress[games[i - 1] as GameId]?.cleared);
}

export function renderLearnPath(root: HTMLElement, pathId: string): void {
  const path = findPath(pathId);
  if (!path) {
    navigate("learn");
    return;
  }
  const save = loadSave();
  const cleared = pathClearedCount(path, save);
  const total = path.games.length;
  const pct = total > 0 ? Math.round((cleared / total) * 100) : 0;
  const done = cleared >= total;
  const color = getCssVar(path.themeVar);

  root.innerHTML = "";
  const page = document.createElement("div");
  page.className = "learn-path";
  page.style.setProperty("--path-color", color);

  /* —— 从路径第一个游戏派生理论标注 —— */
  const firstGame = findGame(path.games[0] ?? "");
  const profile = firstGame
    ? deriveSkillProfile(firstGame.tag)
    : null;
  const tierInfo = profile
    ? COGNITIVE_TIERS[profile.cognitiveTier as CognitiveTier]
    : null;
  const bloomInfo = profile ? BLOOM_LEVELS[profile.bloomLevel] : null;

  /* —— 头部 —— */
  const header = document.createElement("header");
  header.className = "learn-path__header";
  header.innerHTML = `
    <button type="button" class="learn-path__back" aria-label="返回学习中心">← 学习中心</button>
    <div class="learn-path__title"><span class="learn-path__icon">${path.icon}</span> ${path.title}</div>
    <p class="learn-path__subtitle">${path.subtitle}</p>
    ${tierInfo ? `<div class="learn-path__theory">🧠 ${tierInfo.title}（${tierInfo.age}）· ${tierInfo.theory}${bloomInfo ? " · " + bloomInfo.title + "：" + bloomInfo.theory : ""}</div>` : ""}
    <div class="learn-path__progress">
      <div class="learn-path__progress-track"><div class="learn-path__progress-fill" style="width:${pct}%"></div></div>
      <span>${cleared}/${total} 通关${done ? " · 已完成 🎉" : ""}</span>
    </div>`;
  page.appendChild(header);

  header
    .querySelector<HTMLButtonElement>(".learn-path__back")!
    .addEventListener("click", () => navigate("learn"));

  /* —— 游戏步骤列表（渐进解锁）—— */
  const list = document.createElement("ol");
  list.className = "learn-path__list";
  path.games.forEach((gid, i) => {
    const meta = findGame(gid);
    const p = save.progress[gid];
    const isCleared = p?.cleared;
    const unlocked = isUnlocked(path.games, i, save);
    const isCurrent = unlocked && !isCleared; // 已解锁未通关 = 当前
    const stars = p?.bestStars ?? 0;

    const li = document.createElement("li");
    li.className = "learn-step";
    if (isCleared) li.classList.add("learn-step--done");
    else if (!unlocked) li.classList.add("learn-step--locked");
    else if (isCurrent) li.classList.add("learn-step--current");
    li.style.setProperty("--step-color", color);

    // 状态图标：✅ 通关 / ▶ 当前可玩 / 🔒 未解锁 / 序号
    const numIcon = isCleared
      ? "✅"
      : !unlocked
        ? "🔒"
        : isCurrent
          ? "▶"
          : i + 1;

    li.innerHTML = `
      <div class="learn-step__num">${numIcon}</div>
      <div class="learn-step__body">
        <div class="learn-step__title">${meta?.icon ?? "🎮"} ${meta?.title ?? gid}</div>
        <div class="learn-step__meta">${meta?.tag ?? ""} · ${meta?.age ?? ""} ${stars > 0 ? "· " + "⭐".repeat(stars) : ""}</div>
        <div class="learn-step__hint">${unlocked ? (meta?.subtitle ?? "") : "先完成上一关解锁 🔒"}</div>
      </div>
      <div class="learn-step__go">${isCleared ? "再玩" : isCurrent ? "开始" : unlocked ? "试一试" : "🔒"} →</div>`;

    if (unlocked) {
      li.addEventListener("click", () => navigate(gid));
    } else {
      // 未解锁：点一下提示为什么锁着（孩子友好）
      li.addEventListener("click", () =>
        toast("先完成上一关，就能解锁这一关啦 🔒"),
      );
    }
    list.appendChild(li);
  });
  page.appendChild(list);

  /* —— 完成鼓励 —— */
  if (done) {
    const badge = document.createElement("div");
    badge.className = "learn-path__complete";
    badge.innerHTML =
      "🎉 这条路径全部通关啦！可以挑战下一条，或去大厅探索更多游戏～";
    page.appendChild(badge);
  }

  root.appendChild(page);
}
