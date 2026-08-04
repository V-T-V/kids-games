/**
 * 大厅 —— 童趣游戏屋的入口。
 *
 * 575 个游戏卡片 + 通关进度条 + 分类筛选 + 搜索 + 状态过滤。
 * 卡片根据存档显示星数与通关徽章；颜色按游戏主题。
 */
import { GAMES, findGame } from "../games/registry.ts";
import type { GameMeta } from "../types.ts";
import { countCleared, loadSave, ALL_GAME_IDS } from "../core/storage.ts";
import { LEARN_PATHS, pathClearedCount } from "../learn/paths.ts";
import { navigate } from "../router.ts";
import { getCssVar, debounce } from "./util.ts";
import {
  getValidFavorites,
  getValidRecent,
  isFavorite,
  toggleFavorite,
  FAVORITES_MAX,
  FAVORITES_EVENT,
  RECENT_EVENT,
} from "../core/favorites.ts";
import { toast } from "../ui/toast.ts";
import {
  categoryOf,
  discoveryMeta,
  filterGames,
  type AgeFilter,
  type CompletionFilter,
  type DurationFilter,
} from "./contentFilters.ts";

/**
 * 大厅快捷区事件监听的生命周期控制器。
 * renderLobby 每次重建大厅时 abort 旧的、建新的，避免 window 上累积重复监听。
 */
let quickController: AbortController | null = null;

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
  社交: "🤝",
  生活: "🏠",
  精细: "✋",
  专注: "🔍",
  健康: "🏃",
  概率: "🎲",
  物理: "⚙️",
  控制: "🎮",
  瞄准: "🎯",
  策略: "♟️",
  观察: "👁️",
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
    <p class="lobby__subtitle">${ALL_GAME_IDS.length} 个小游戏 · 边玩边学 · 3-6 岁专属</p>
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

  /* —— 学习中心入口（主路径，醒目大按钮）——
     若孩子正在某条路径中途（已开始但未全通），按钮变成「继续学习」
     并直接跳那条路径详情；否则显示「学习中心」跳学习中心首页。 */
  const learnBtn = document.createElement("button");
  learnBtn.type = "button";
  learnBtn.className = "lobby__learn";
  // 若已有任何学习进度（已开始），停止脉冲引导
  const hasAnyProgress = LEARN_PATHS.some((p) => pathClearedCount(p, save) > 0);
  if (hasAnyProgress) learnBtn.classList.add("lobby__learn--started");
  // 找"进行中"路径：已通关 0+ 关但未全通，取第一条
  const inProgress = LEARN_PATHS.find((p) => {
    const c = pathClearedCount(p, save);
    return c > 0 && c < p.games.length;
  });
  if (inProgress) {
    const c = pathClearedCount(inProgress, save);
    learnBtn.innerHTML =
      '<span class="lobby__learn__icon">' +
      inProgress.icon +
      '</span> 继续学习<span class="lobby__learn__hint">' +
      inProgress.title +
      " · " +
      c +
      "/" +
      inProgress.games.length +
      " 关</span>";
    learnBtn.setAttribute(
      "aria-label",
      "继续学习" + inProgress.title + "，已完成" + c + "关",
    );
    learnBtn.addEventListener("click", () =>
      navigate("learn/" + inProgress.id),
    );
  } else {
    learnBtn.innerHTML =
      '<span class="lobby__learn__icon">📚</span> 学习中心<span class="lobby__learn__hint">跟着路径一步步学</span>';
    learnBtn.setAttribute("aria-label", "进入学习中心");
    learnBtn.addEventListener("click", () => navigate("learn"));
  }
  lobby.appendChild(learnBtn);

  /* —— 惊喜随机按钮 —— 从未玩过的游戏里随机挑一个，给孩子探索新鲜感 —— */
  const surpriseBtn = document.createElement("button");
  surpriseBtn.type = "button";
  surpriseBtn.className = "lobby__surprise";
  surpriseBtn.innerHTML =
    '<span class="lobby__surprise__icon">🎲</span> 给我一个惊喜！';
  surpriseBtn.setAttribute("aria-label", "随机玩一个游戏");
  surpriseBtn.addEventListener("click", () => {
    // 优先从未玩过的游戏里抽；都玩过了就随机抽
    const unplayed = ALL_GAME_IDS.filter((id) => !save.progress[id]?.cleared);
    const pool = unplayed.length > 0 ? unplayed : ALL_GAME_IDS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) navigate(pick);
  });
  lobby.appendChild(surpriseBtn);

  /* —— 快捷区：我的收藏 + 最近玩过（首访为空时不渲染，零干扰）—— */
  const quickContainer = document.createElement("div");
  quickContainer.className = "lobby__quick-wrap";
  lobby.appendChild(quickContainer);

  /** 已注册游戏 id 集合（用于过滤掉历史里已下架的幽灵卡片）。 */
  const validIds = new Set<string>(ALL_GAME_IDS as readonly string[]);

  /* —— 搜索框 —— */
  const searchBar = document.createElement("div");
  searchBar.className = "lobby__search";
  searchBar.innerHTML = `<input type="search" id="lobby-search" placeholder="🔍 搜游戏名/拼音/类型…" autocomplete="off" aria-label="搜索游戏" />`;
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
  // 分块渲染的令牌：每次 rerender 自增，旧批次检测到失配即中止。
  let renderToken = 0;

  /** 渲染「我的收藏」+「最近玩过」快捷区。两区都为空时隐藏整个容器（首访零干扰）。 */
  function renderQuick(): void {
    quickContainer.innerHTML = "";
    const favIds = getValidFavorites(validIds);
    const recentIds = getValidRecent(validIds);
    if (favIds.length === 0 && recentIds.length === 0) return;

    if (recentIds.length > 0) {
      quickContainer.appendChild(
        buildQuickRow("🕘 最近玩过", recentIds, "最近玩过的游戏会出现在这里"),
      );
    }
    if (favIds.length > 0) {
      quickContainer.appendChild(
        buildQuickRow("⭐ 我的收藏", favIds, "点卡片右上角的 ☆ 收藏喜欢的游戏"),
      );
    }
  }

  /** 构建一行快捷卡片（标题 + 横向滚动条）。空时调用方应自行跳过。 */
  function buildQuickRow(
    title: string,
    ids: readonly string[],
    emptyHint: string,
  ): HTMLElement {
    const section = document.createElement("section");
    section.className = "lobby__quick";
    const head = document.createElement("div");
    head.className = "lobby__quick-title";
    head.textContent = `${title} · ${ids.length}`;
    section.appendChild(head);
    const row = document.createElement("div");
    row.className = "lobby__quick-row";
    for (const id of ids) {
      const g = findGame(id);
      if (!g) continue;
      const p = save.progress[g.id];
      const card = makeCard(g, p.bestStars, p.cleared);
      // 快捷区卡片进入对应游戏；收藏态可在大网格里管理
      row.appendChild(card);
    }
    section.appendChild(row);
    // 保留 emptyHint 参数以便未来扩展（当前调用方已确保非空）
    void emptyHint;
    return section;
  }

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
    resultLine.textContent =
      shownGames.length > 0
        ? `找到 ${shownGames.length} 个游戏${searchTerm ? ` · 搜"${searchTerm}"` : ""}`
        : searchTerm
          ? `没找到"${searchTerm}"，换个词试试～ 🔍`
          : "这个筛选下没有游戏，换一个试试～ 🎈";
    // 卡片数 > 80 时禁用入场动画（性能优化）
    grid.classList.toggle("lobby__grid--many", shownGames.length > 80);
    if (shownGames.length === 0) {
      grid.innerHTML = searchTerm
        ? `<div class="lobby__empty">🔍 没找到"${searchTerm}"<br><br>试试搜：颜色、数学、古诗、记忆、安全…</div>`
        : '<div class="lobby__empty">这里还没有游戏，换个筛选试试～ 🎈</div>';
      return;
    }
    // 分块渲染：大量卡片（如"全部" 575 张）时，按 60 张一批用微任务让出主线程，
    // 避免一次性 createElement+appendChild 几百个节点阻塞低端机首帧、
    // 让孩子的点击在渲染途中也能被响应。取消上一次未完成的批次。
    renderToken += 1;
    const myToken = renderToken;
    const CHUNK = 60;
    let i = 0;
    const appendChunk = (): void => {
      if (myToken !== renderToken) return; // 已被新一轮 rerender 取代
      const end = Math.min(i + CHUNK, shownGames.length);
      const frag = document.createDocumentFragment();
      for (; i < end; i++) {
        const g = shownGames[i];
        if (!g) break;
        const p = save.progress[g.id];
        frag.appendChild(makeCard(g, p.bestStars, p.cleared));
      }
      grid.appendChild(frag);
      if (i < shownGames.length) {
        // 让出一帧后继续下一批
        setTimeout(appendChunk, 0);
      }
    };
    appendChunk();
  }

  /** 分类 tab 点击。 */
  function selectCat(cat: string): void {
    activeCat = cat;
    for (const [k, btn] of Object.entries(catTabs)) {
      const on = k === cat;
      btn.classList.toggle("lobby__cat--active", on);
      btn.setAttribute("aria-pressed", String(on));
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
      const on = k === f;
      ageTabs[k].classList.toggle("lobby__status-tab--active", on);
      ageTabs[k].setAttribute("aria-pressed", String(on));
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

  // 搜索（debounce 避免每次按键重建 575 卡片）
  const searchInput = document.getElementById(
    "lobby-search",
  ) as HTMLInputElement;
  const debouncedSearch = debounce(() => {
    searchTerm = searchInput.value.trim().toLowerCase();
    rerender();
  }, 150);
  searchInput.addEventListener("input", debouncedSearch);

  // 收藏/最近变化时只刷新快捷区（不全量重渲染 575 卡片，性能友好）。
  // 用 AbortController 绑定，renderLobby 每次重建大厅时旧 controller 自动失效，
  // 避免 showLobby 重复调用导致 window 上累积重复监听器。
  quickController?.abort();
  quickController = new AbortController();
  const onQuickChange = (): void => renderQuick();
  window.addEventListener(FAVORITES_EVENT, onQuickChange, {
    signal: quickController.signal,
  });
  window.addEventListener(RECENT_EVENT, onQuickChange, {
    signal: quickController.signal,
  });

  // 首次渲染：快捷区 + 卡片网格
  renderQuick();
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
  b.innerHTML = `<span class="lobby__cat-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
  b.setAttribute("aria-label", `筛选${label}类游戏`);
  b.setAttribute("aria-pressed", String(active));
  return b;
}

function makeStatusTab(label: string, active: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `lobby__status-tab ${active ? "lobby__status-tab--active" : ""}`;
  b.textContent = label;
  b.setAttribute("aria-pressed", String(active));
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
  const tagCat = g.tag.split("·")[0] ?? "";
  const tagIcon: Record<string, string> = {
    认知: "🧠",
    数学: "🔢",
    语言: "📖",
    科学: "🔬",
    反应: "⚡",
    逻辑: "🧩",
    创造: "🎨",
    记忆: "💭",
    艺术: "🎵",
    社交: "🤝",
    专注: "🔍",
    生活: "🏠",
  };
  const catIcon = tagIcon[tagCat] ?? "🎮";
  const fav = isFavorite(g.id);
  card.innerHTML = `
    ${stars}
    ${badge}
    <div class="game-card__icon" aria-hidden="true">${g.icon}</div>
    <div class="game-card__title">${g.title}</div>
    <div class="game-card__meta"><span aria-hidden="true">${catIcon}</span> ${g.age} · ${meta.estimatedMinutes}分钟</div>
    <div class="game-card__tag">${g.tag}</div>
    <button type="button" class="game-card__fav ${fav ? "game-card__fav--on" : ""}" aria-label="${fav ? "取消收藏" : "收藏"}" aria-pressed="${fav}">${fav ? "⭐" : "☆"}</button>`;
  const status = cleared
    ? `已通关，${bestStars}星`
    : bestStars > 0
      ? `玩过，${bestStars}星`
      : "未玩";
  card.setAttribute(
    "aria-label",
    `${g.title}，${g.tag}，${g.age}，约${meta.estimatedMinutes}分钟，${status}`,
  );
  card.addEventListener("click", () => navigate(g.id));

  // ⭐ 收藏角标：拦截点击不触发卡片进游戏。达上限弹 toast 提示。
  const favBtn = card.querySelector<HTMLButtonElement>(".game-card__fav")!;
  favBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    const nowFav = isFavorite(g.id);
    if (!nowFav) {
      const ok = toggleFavorite(g.id);
      if (!ok) {
        toast(`收藏已满（${FAVORITES_MAX} 个），先取消一些再收藏吧～ ⭐`);
        return;
      }
      favBtn.classList.add("game-card__fav--on");
      favBtn.textContent = "⭐";
      favBtn.setAttribute("aria-label", "取消收藏");
      favBtn.setAttribute("aria-pressed", "true");
    } else {
      toggleFavorite(g.id);
      favBtn.classList.remove("game-card__fav--on");
      favBtn.textContent = "☆";
      favBtn.setAttribute("aria-label", "收藏");
      favBtn.setAttribute("aria-pressed", "false");
    }
    // toggleFavorite 已派发 FAVORITES_EVENT → renderLobby 的监听器刷新快捷区
  });
  return card;
}
