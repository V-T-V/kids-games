/**
 * 大厅 —— 童趣游戏屋的入口。
 *
 * 81 个游戏卡片 + 通关进度条 + 分类筛选 + 搜索 + 状态过滤。
 * 卡片根据存档显示星数与通关徽章；颜色按游戏主题。
 */
import { GAMES } from "../games/registry.ts";
import type { GameMeta } from "../types.ts";
import { countCleared, loadSave, ALL_GAME_IDS } from "../core/storage.ts";
import { navigate } from "../router.ts";
import { getCssVar } from "./util.ts";
import {
  categoryOf,
  discoveryMeta,
  filterGames,
  type AgeFilter,
  type CompletionFilter,
  type DurationFilter,
} from "./contentFilters.ts";

/** 所有出现的分类（按出现顺序）。 */
const CATEGORIES: string[] = (() => {
  const seen: string[] = [];
  for (const g of GAMES) {
    const c = categoryOf(g.tag);
    if (!seen.includes(c)) seen.push(c);
  }
  return seen;
})();

/** 分类 → emoji 图标。 */
const CAT_ICON: Record<string, string> = {
  认知: "🧠",
  数学: "🔢",
  语言: "📖",
  科学: "🔬",
  反应: "⚡",
  逻辑: "🧩",
  创造: "🎨",
  记忆: "💭",
  艺术: "🎵",
};

export function renderLobby(root: HTMLElement): void {
  const save = loadSave();
  const cleared = countCleared(save);
  const total = ALL_GAME_IDS.length;

  root.innerHTML = "";
  const lobby = document.createElement("div");
  lobby.className = "lobby";

  /* —— 头部 —— */
  const header = document.createElement("header");
  header.className = "lobby__header";
  const totalStars = ALL_GAME_IDS.reduce(
    (s, id) => s + save.progress[id].bestStars,
    0,
  );
  header.innerHTML = `
    <h1 class="lobby__title">
      <span class="lobby__emoji">🧸</span> 童趣游戏屋
    </h1>
    <p class="lobby__subtitle">81 个小游戏 · 边玩边学 · ${"3-6 岁专属"}</p>
    <div class="lobby__stats">
      <div class="lobby__progress">
        <span>🏆</span>
        <div class="lobby__progress-bar">
          <div class="lobby__progress-fill" style="width:${(cleared / total) * 100}%"></div>
        </div>
        <span>${cleared}/${total}</span>
      </div>
      <div class="lobby__stat-chip">⭐ ${totalStars}</div>
      <div class="lobby__stat-chip">🎖️ ${save.achievements.length}</div>
    </div>`;
  lobby.appendChild(header);

  /* —— 搜索框 —— */
  const searchBar = document.createElement("div");
  searchBar.className = "lobby__search";
  searchBar.innerHTML = `<input type="search" id="lobby-search" placeholder="🔍 搜索游戏名…" autocomplete="off" />`;
  lobby.appendChild(searchBar);

  /* —— 分类筛选 tab + 年龄/时长/状态过滤 —— */
  const toolbar = document.createElement("div");
  toolbar.className = "lobby__toolbar";

  const catRow = document.createElement("div");
  catRow.className = "lobby__cats";
  // 全部 tab
  const allTab = makeCatTab("全部", "🎯", true);
  catRow.appendChild(allTab);
  const catTabs: Record<string, HTMLButtonElement> = { 全部: allTab };
  for (const cat of CATEGORIES) {
    const t = makeCatTab(cat, CAT_ICON[cat] ?? "📁", false);
    catRow.appendChild(t);
    catTabs[cat] = t;
  }
  toolbar.appendChild(catRow);

  // 年龄过滤
  const ageRow = document.createElement("div");
  ageRow.className = "lobby__status";
  const ageTabs: Record<AgeFilter, HTMLButtonElement> = {
    all: makeStatusTab("全部年龄", true),
    "3": makeStatusTab("3 岁", false),
    "4": makeStatusTab("4 岁", false),
    "5": makeStatusTab("5 岁", false),
    "6": makeStatusTab("6 岁", false),
  };
  ageRow.append(
    ageTabs.all,
    ageTabs["3"],
    ageTabs["4"],
    ageTabs["5"],
    ageTabs["6"],
  );
  toolbar.appendChild(ageRow);

  // 时长过滤
  const durationRow = document.createElement("div");
  durationRow.className = "lobby__status";
  const durationTabs: Record<DurationFilter, HTMLButtonElement> = {
    all: makeStatusTab("全部时长", true),
    short: makeStatusTab("≤5 分钟", false),
    medium: makeStatusTab("6-8 分钟", false),
    long: makeStatusTab("8+ 分钟", false),
  };
  durationRow.append(
    durationTabs.all,
    durationTabs.short,
    durationTabs.medium,
    durationTabs.long,
  );
  toolbar.appendChild(durationRow);

  // 状态过滤
  const statusRow = document.createElement("div");
  statusRow.className = "lobby__status";
  const statusTabs: Record<CompletionFilter, HTMLButtonElement> = {
    all: makeStatusTab("全部", true),
    uncleared: makeStatusTab("🎮 未玩", false),
    cleared: makeStatusTab("✅ 已通关", false),
  };
  statusRow.append(statusTabs.all, statusTabs.uncleared, statusTabs.cleared);
  toolbar.appendChild(statusRow);
  lobby.appendChild(toolbar);

  /* —— 卡片网格 —— */
  const grid = document.createElement("div");
  grid.className = "lobby__grid";
  lobby.appendChild(grid);

  const resultLine = document.createElement("div");
  resultLine.className = "lobby__result";
  lobby.insertBefore(resultLine, grid);

  root.appendChild(lobby);

  /* —— 当前筛选状态 —— */
  let activeCat = "全部";
  let activeAge: AgeFilter = "all";
  let activeDuration: DurationFilter = "all";
  let activeStatus: CompletionFilter = "all";
  let searchTerm = "";

  /** 根据筛选条件渲染卡片。 */
  function rerender(): void {
    grid.innerHTML = "";
    const shownGames = filterGames(GAMES, save.progress, {
      category: activeCat,
      age: activeAge,
      duration: activeDuration,
      completion: activeStatus,
      searchTerm,
    });
    resultLine.textContent = `找到 ${shownGames.length} 个适合练习`;
    for (const g of shownGames) {
      const p = save.progress[g.id];
      grid.appendChild(makeCard(g, p.bestStars, p.cleared));
    }
    if (shownGames.length === 0) {
      grid.innerHTML =
        '<div class="lobby__empty">这里还没有游戏，换个筛选试试～ 🎈</div>';
    }
  }

  /** 分类 tab 点击。 */
  function selectCat(cat: string): void {
    activeCat = cat;
    for (const [k, btn] of Object.entries(catTabs)) {
      btn.classList.toggle("lobby__cat--active", k === cat);
    }
    rerender();
  }
  for (const [k, btn] of Object.entries(catTabs)) {
    btn.addEventListener("click", () => selectCat(k));
  }

  /** 年龄 tab 点击。 */
  function selectAge(f: AgeFilter): void {
    activeAge = f;
    (Object.keys(ageTabs) as AgeFilter[]).forEach((k) => {
      ageTabs[k].classList.toggle("lobby__status-tab--active", k === f);
    });
    rerender();
  }
  (Object.keys(ageTabs) as AgeFilter[]).forEach((k) => {
    ageTabs[k].addEventListener("click", () => selectAge(k));
  });

  /** 时长 tab 点击。 */
  function selectDuration(f: DurationFilter): void {
    activeDuration = f;
    (Object.keys(durationTabs) as DurationFilter[]).forEach((k) => {
      durationTabs[k].classList.toggle("lobby__status-tab--active", k === f);
    });
    rerender();
  }
  (Object.keys(durationTabs) as DurationFilter[]).forEach((k) => {
    durationTabs[k].addEventListener("click", () => selectDuration(k));
  });

  /** 状态 tab 点击。 */
  function selectStatus(f: CompletionFilter): void {
    activeStatus = f;
    (Object.keys(statusTabs) as CompletionFilter[]).forEach((k) => {
      statusTabs[k].classList.toggle("lobby__status-tab--active", k === f);
    });
    rerender();
  }
  (Object.keys(statusTabs) as CompletionFilter[]).forEach((k) => {
    statusTabs[k].addEventListener("click", () => selectStatus(k));
  });

  // 搜索
  const searchInput = document.getElementById(
    "lobby-search",
  ) as HTMLInputElement;
  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    rerender();
  });

  rerender();
}

function makeCatTab(
  label: string,
  icon: string,
  active: boolean,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `lobby__cat ${active ? "lobby__cat--active" : ""}`;
  b.innerHTML = `<span class="lobby__cat-icon">${icon}</span><span>${label}</span>`;
  return b;
}

function makeStatusTab(label: string, active: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `lobby__status-tab ${active ? "lobby__status-tab--active" : ""}`;
  b.textContent = label;
  return b;
}

function makeCard(
  g: GameMeta,
  bestStars: number,
  cleared: boolean,
): HTMLButtonElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "game-card";
  const color = getCssVar(g.theme);
  card.style.setProperty("--card-color", color);
  card.setAttribute("aria-label", g.title);
  const meta = discoveryMeta(g);
  const stars =
    bestStars > 0
      ? `<div class="game-card__stars">${"⭐".repeat(bestStars)}</div>`
      : "";
  const badge = cleared ? '<div class="game-card__badge">✅</div>' : "";
  card.innerHTML = `
    ${stars}
    ${badge}
    <div class="game-card__icon">${g.icon}</div>
    <div class="game-card__title">${g.title}</div>
    <div class="game-card__meta">${g.age} · ${meta.estimatedMinutes} 分钟</div>
    <div class="game-card__tag">${g.tag}</div>`;
  card.addEventListener("click", () => navigate(g.id));
  return card;
}
