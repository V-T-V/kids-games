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
  buildDomainReport,
  formatParentSummary,
} from "../core/parentReport.ts";
import {
  loadFeedback,
  clearFeedback,
  resolveFeedback,
  deleteFeedback,
  exportFeedback,
  FEEDBACK_TYPES,
  type FeedbackType,
} from "../core/feedback.ts";
import {
  getSyncConfig,
  setSyncConfig,
  isSyncReady,
  getPendingCount,
  flushAllPending,
  clearPending,
  SYNC_EVENT,
} from "../core/sync.ts";
import { LEARN_PATHS, pathClearedCount } from "../learn/paths.ts";
import { isTTSEnabled, setTTSEnabled } from "../core/tts.ts";
import type { Difficulty, SyncConfig } from "../types.ts";

const DIFF_LABEL_FB: Record<Difficulty | "", string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
  "": "",
};

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
function buildBody(getOverlay?: () => Overlay | undefined): HTMLElement {
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

  // 反馈同步到 generic-admin 后台（默认关闭，opt-in）。
  // 开关 + 「配置」按钮（弹 prompt 输入 baseUrl + token，存独立 localStorage key）。
  const syncCfg = getSyncConfig();
  const syncControl = el("div", "pp-sync-control");
  syncControl.appendChild(
    toggleBtn(syncCfg.enabled, () => {
      const c = getSyncConfig();
      c.enabled = !c.enabled;
      setSyncConfig(c);
      if (c.enabled && (!c.baseUrl || !c.token)) {
        toast("已开启，请点「配置」填后台地址和 token ⚙️");
      } else {
        toast(c.enabled ? "反馈同步已开启 ☁️" : "反馈同步已关闭");
      }
      return c.enabled;
    }),
  );
  const cfgBtn = document.createElement("button");
  cfgBtn.type = "button";
  cfgBtn.className = "pp-sync-config-btn";
  cfgBtn.textContent = "⚙️ 配置";
  cfgBtn.addEventListener("click", () => {
    const c = getSyncConfig();
    const baseUrl = window.prompt(
      "后台 API 地址\n（generic-admin，如 http://127.0.0.1:8080/api/v1）",
      c.baseUrl || "http://127.0.0.1:8080/api/v1",
    );
    if (baseUrl === null) return; // 取消
    const token = window.prompt(
      "API token\n（在 generic-admin 后台创建，用于推送反馈）",
      c.token,
    );
    if (token === null) return; // 取消
    const next: SyncConfig = {
      enabled: baseUrl.trim().length > 0 && token.trim().length > 0,
      baseUrl: baseUrl.trim(),
      token: token.trim(),
    };
    setSyncConfig(next);
    toast(isSyncReady() ? "配置已保存 ☁️" : "地址或 token 为空，未启用");
  });
  syncControl.appendChild(cfgBtn);
  settingsBox.appendChild(settingRow("反馈同步", syncControl));

  // 语音朗读（TTS）：为不识字的孩子朗读游戏任务
  settingsBox.appendChild(
    settingRow(
      "🔊 任务朗读",
      toggleBtn(isTTSEnabled(), () => {
        const next = !isTTSEnabled();
        setTTSEnabled(next);
        toast(next ? "朗读已开启 🔊" : "朗读已关闭");
        return next;
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

  /* —— 学习路径进度（家长最关心：孩子学到哪了）—— */
  const learnBox = el("div", "pp-section");
  const lTitle = el("h3", "pp-section__title");
  lTitle.textContent = "📚 学习路径";
  learnBox.appendChild(lTitle);
  for (const path of LEARN_PATHS) {
    const cleared = pathClearedCount(path, save);
    const total = path.games.length;
    const pct = total > 0 ? Math.round((cleared / total) * 100) : 0;
    const done = cleared >= total;
    const row = el("div", "pp-learn-row");
    row.innerHTML = `<span class="pp-learn-row__icon">${path.icon}</span>
      <span class="pp-learn-row__name">${path.title}<small>${path.ageRange} · ${path.subtitle}</small></span>
      <span class="pp-learn-row__progress">${done ? "✅ 完成" : cleared + "/" + total + "（" + pct + "%）"}</span>`;
    learnBox.appendChild(row);
  }
  root.appendChild(learnBox);

  /* —— 六大领域能力概览（加德纳多元智能，与学习中心一致）—— */
  const domainBox = el("div", "pp-section");
  const dTitle = el("h3", "pp-section__title");
  dTitle.textContent = "🧠 六大领域能力";
  domainBox.appendChild(dTitle);
  const domainReport = buildDomainReport(save);
  for (const dr of domainReport) {
    if (dr.played === 0) continue; // 未玩的领域不显示
    const row = el("div", "pp-learn-row");
    const pct = dr.games > 0 ? Math.round((dr.cleared / dr.games) * 100) : 0;
    row.innerHTML = `<span class="pp-learn-row__icon">${dr.icon}</span>
      <span class="pp-learn-row__name">${dr.title}<small>体验 ${dr.played}/${dr.games} · 通关 ${dr.cleared} · ⭐${dr.avgStars}</small></span>
      <span class="pp-learn-row__progress">${pct}%</span>`;
    domainBox.appendChild(row);
  }
  root.appendChild(domainBox);

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

  /* —— 问题反馈汇总（增强：上下文/标记已处理/单条删除/导出/类型筛选）—— */
  const feedback = loadFeedback();
  if (feedback.length > 0) {
    const fbBox = el("div", "pp-section");
    const fbTitle = el("h3", "pp-section__title");
    const unresolved = feedback.filter((f) => !f.resolved).length;
    fbTitle.textContent = `💬 问题反馈（${feedback.length} 条${unresolved > 0 ? `，${unresolved} 条未处理` : "，全部已处理"}）`;
    fbBox.appendChild(fbTitle);

    // 按类型统计 + 筛选 chips
    const typeCounts: Record<string, number> = {};
    feedback.forEach((f) => {
      typeCounts[f.type] = (typeCounts[f.type] ?? 0) + 1;
    });
    const fbSummary = el("div", "pp-fb-summary");
    let activeFilter: FeedbackType | "all" = "all";
    const filterChips: HTMLElement[] = [];
    const allChip = el("span", "pp-fb-chip pp-fb-chip--active");
    allChip.textContent = `全部 ×${feedback.length}`;
    allChip.addEventListener("click", () => {
      activeFilter = "all";
      filterChips.forEach((c) => c.classList.remove("pp-fb-chip--active"));
      allChip.classList.add("pp-fb-chip--active");
      refreshList();
    });
    filterChips.push(allChip);
    fbSummary.appendChild(allChip);
    (Object.keys(typeCounts) as FeedbackType[]).forEach((t) => {
      const info = FEEDBACK_TYPES[t];
      const chip = el("span", "pp-fb-chip");
      chip.textContent = `${info.icon} ${info.short} ×${typeCounts[t]}`;
      chip.addEventListener("click", () => {
        activeFilter = t;
        filterChips.forEach((c) => c.classList.remove("pp-fb-chip--active"));
        chip.classList.add("pp-fb-chip--active");
        refreshList();
      });
      filterChips.push(chip);
      fbSummary.appendChild(chip);
    });
    fbBox.appendChild(fbSummary);

    // 反馈列表容器（支持筛选刷新）
    const fbList = el("div", "pp-fb-list");
    fbBox.appendChild(fbList);

    function refreshList(): void {
      fbList.innerHTML = "";
      const shown =
        activeFilter === "all"
          ? feedback.slice().reverse()
          : feedback.filter((f) => f.type === activeFilter).reverse();
      shown.forEach((f) => {
        const info = FEEDBACK_TYPES[f.type];
        const date = new Date(f.timestamp);
        const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
        const diffLabel = DIFF_LABEL_FB[f.difficulty] ?? "";
        const ctx = f.context
          ? `<span class="pp-fb__ctx">第${f.context.round ?? "?"}关 · 对${f.context.right ?? 0}错${f.context.wrong ?? 0}${f.context.durationMs != null ? ` · ${Math.round(f.context.durationMs / 1000)}秒` : ""}</span>`
          : "";
        const item = el("div", "pp-fb-item");
        if (f.resolved) item.classList.add("pp-fb-item--resolved");
        item.innerHTML = `<span class="pp-fb__icon">${info.icon}</span>
          <div class="pp-fb__content">
            <div class="pp-fb__head">${f.gameTitle}${diffLabel ? ` · ${diffLabel}` : ""} · ${info.short} · <small>${timeStr}</small></div>
            ${ctx}
            ${f.description ? `<div class="pp-fb__desc">${f.description}</div>` : ""}
          </div>`;
        // 操作按钮：标记已处理 / 删除
        const actions = el("div", "pp-fb__actions");
        const resolveBtn = el("button", "pp-fb__btn");
        resolveBtn.textContent = f.resolved ? "↩ 撤销" : "✓ 已处理";
        resolveBtn.addEventListener("click", () => {
          resolveFeedback(f.timestamp, !f.resolved);
          getOverlay?.()?.destroy();
          openParentPanel();
        });
        const delBtn = el("button", "pp-fb__btn pp-fb__btn--del");
        delBtn.textContent = "🗑";
        delBtn.title = "删除这条反馈";
        delBtn.addEventListener("click", () => {
          deleteFeedback(f.timestamp);
          getOverlay?.()?.destroy();
          openParentPanel();
        });
        actions.appendChild(resolveBtn);
        actions.appendChild(delBtn);
        item.appendChild(actions);
        fbList.appendChild(item);
      });
    }
    refreshList();

    // 底部操作栏：导出 + 清空
    const fbActions = el("div", "pp-fb-bottom");
    const exportBtn = el("button", "pp-fb-clear");
    exportBtn.textContent = "📋 复制全部";
    exportBtn.addEventListener("click", async () => {
      const text = exportFeedback();
      try {
        await navigator.clipboard.writeText(text);
        toast("反馈已复制到剪贴板 📋");
      } catch {
        // 降级：选中文本提示手动复制
        toast("复制失败，请手动选择文本");
      }
    });
    fbActions.appendChild(exportBtn);

    // 同步就绪时显示「立即同步」按钮（推 pending + 全量补推本地）。
    if (isSyncReady()) {
      const syncBtn = document.createElement("button");
      syncBtn.type = "button";
      syncBtn.className = "pp-fb-clear";
      const renderSyncBtn = (): void => {
        syncBtn.textContent = `☁️ 同步到后台 (${getPendingCount()})`;
      };
      renderSyncBtn();
      syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = "☁️ 同步中…";
        try {
          const r = await flushAllPending();
          toast(
            r.failed === 0
              ? `同步完成，已推送 ${r.success} 条 ☁️`
              : `推送 ${r.success} 条，${r.failed} 条待重试`,
          );
        } catch {
          toast("同步失败，已保存本地稍后重试");
        } finally {
          syncBtn.disabled = false;
          renderSyncBtn();
        }
      });
      // pending 变化时刷新按钮数字（同步成功/新入队都会派发 SYNC_EVENT）
      const onSync = (): void => renderSyncBtn();
      window.addEventListener(SYNC_EVENT, onSync);
      fbActions.appendChild(syncBtn);
    }

    const clearBtn = el("button", "pp-fb-clear");
    clearBtn.textContent = "🗑️ 清空全部";
    clearBtn.addEventListener("click", () => {
      clearFeedback();
      clearPending(); // 联动：清空反馈时一并清空待同步队列
      toast("反馈已清空");
      getOverlay?.()?.destroy();
      openParentPanel();
    });
    fbActions.appendChild(clearBtn);
    fbBox.appendChild(fbActions);

    root.appendChild(fbBox);
  }

  return root;
}

export function openParentPanel(): void {
  const overlayRef: { current: Overlay | null } = { current: null };
  const overlay = new Overlay({
    title: "家长面板",
    body: buildBody(() => overlayRef.current ?? undefined),
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
        clearFeedback(); // 联动：重置进度时一并清空反馈，语义统一
        clearParticles();
        hideMascot();
        toast("进度已重置 ✨");
        overlay.destroy();
      },
    },
  });
  overlayRef.current = overlay;
  overlay.show();
}
