/* 雪花配对 Snowflake Match —— 几片不同花纹的雪花，
   找出花纹完全相同的两片配对。点两片配对。
   独特点：视觉辨识（6 角对称花纹）+ 短时记忆。
   视觉：深蓝夜空 + 用 CSS 绘制的 6 角雪花（每片花纹独特）+ 飘落动画。
   巧思：每片雪花由"中心+ 6 条枝"的花纹决定，保证恰好成对；配对成功后融为星点。
   难度 = 配对数。通关 = 配完目标轮数。前缀 sfm-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface FlakeKind {
  key: string;
  /** 枝形状：line / dot / fork / star */
  arm: "line" | "dot" | "fork" | "star";
  /** 中心样式 */
  center: "o" | "x" | "hex";
  /** 主色 */
  color: string;
}

const ARM_OPTS: FlakeKind["arm"][] = ["line", "dot", "fork", "star"];
const CENTER_OPTS: FlakeKind["center"][] = ["o", "x", "hex"];
const COLORS = ["#e0f7ff", "#b3e5fc", "#cfd8ff", "#d8f5ff", "#ffffff"];

/** 生成若干种不重复的花纹。 */
function genUniqueKinds(count: number): FlakeKind[] {
  const out: FlakeKind[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const arm = sample(ARM_OPTS);
    const center = sample(CENTER_OPTS);
    const color = sample(COLORS);
    const key = `${arm}-${center}-${color}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({ key, arm, center, color });
  }
  return out;
}

export class SnowflakeMatchGame extends BaseGame {
  constructor() {
    super("snowflake-match");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private picked: number | null = null;
  private locked = false;
  private flakeEls: HTMLButtonElement[] = [];
  private kinds: FlakeKind[] = [];
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 与 timer 由基类清理 */
  }

  private pairs(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.picked = null;
    this.locked = false;
    this.root.innerHTML = "";

    const pairs = this.pairs();
    const baseKinds = genUniqueKinds(pairs);
    // 每种两片
    const list: FlakeKind[] = [];
    baseKinds.forEach((k) => {
      list.push({ ...k });
      list.push({ ...k });
    });
    this.kinds = shuffle(list);
    this.remaining = pairs;

    const wrap = document.createElement("div");
    wrap.className = "sfm-wrap";

    const task = document.createElement("div");
    task.className = "sfm-task";
    task.innerHTML = `找出<b>花纹一样</b>的两片雪花配对～（第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 剩 <b id="sfm-left">${this.remaining}</b> 对）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "sfm-board";
    this.flakeEls = [];
    this.kinds.forEach((k, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sfm-flake";
      b.dataset.idx = String(idx);
      b.dataset.key = k.key;
      b.style.setProperty("--sfm-color", k.color);
      b.style.animationDelay = `${(idx * 0.25).toFixed(2)}s`;
      b.innerHTML = this.flakeSvg(k);
      b.addEventListener("click", () => this.click(idx));
      board.appendChild(b);
      this.flakeEls.push(b);
    });
    wrap.appendChild(board);

    const hint = document.createElement("div");
    hint.className = "sfm-hint";
    hint.textContent = "比一比每片雪花的枝杈、中心和颜色～";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
    this.reportProgress(this.roundsDone, this.roundTotal);
  }

  /** 用内联 SVG 绘制一片 6 角雪花。 */
  private flakeSvg(k: FlakeKind): string {
    const arms = [];
    for (let i = 0; i < 6; i++) {
      const angle = i * 60;
      arms.push(
        `<g transform="rotate(${angle} 50 50)">${this.armPath(k.arm)}</g>`,
      );
    }
    const center = this.centerPath(k.center);
    return `<svg class="sfm-svg" viewBox="0 0 100 100">${arms.join("")}${center}</svg>`;
  }

  private armPath(arm: FlakeKind["arm"]): string {
    const stroke = "var(--sfm-color)";
    switch (arm) {
      case "line":
        return `<line x1="50" y1="50" x2="50" y2="8" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>`;
      case "dot":
        return `<line x1="50" y1="50" x2="50" y2="20" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="12" r="5" fill="${stroke}"/>`;
      case "fork":
        return `<line x1="50" y1="50" x2="50" y2="14" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/><line x1="50" y1="26" x2="42" y2="18" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/><line x1="50" y1="26" x2="58" y2="18" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`;
      case "star":
        return `<line x1="50" y1="50" x2="50" y2="10" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/><line x1="50" y1="20" x2="44" y2="14" stroke="${stroke}" stroke-width="2"/><line x1="50" y1="20" x2="56" y2="14" stroke="${stroke}" stroke-width="2"/><line x1="50" y1="30" x2="44" y2="24" stroke="${stroke}" stroke-width="2"/><line x1="50" y1="30" x2="56" y2="24" stroke="${stroke}" stroke-width="2"/>`;
      default:
        return "";
    }
  }

  private centerPath(c: FlakeKind["center"]): string {
    const fill = "var(--sfm-color)";
    switch (c) {
      case "o":
        return `<circle cx="50" cy="50" r="6" fill="${fill}"/>`;
      case "x":
        return `<path d="M44 44 L56 56 M56 44 L44 56" stroke="${fill}" stroke-width="3" stroke-linecap="round"/>`;
      case "hex":
        return `<polygon points="50,43 56,47 56,53 50,57 44,53 44,47" fill="${fill}"/>`;
      default:
        return "";
    }
  }

  private click(idx: number): void {
    if (this.locked) return;
    const el = this.flakeEls[idx]!;
    if (this.picked === null) {
      this.picked = idx;
      el.classList.add("sfm-flake--picked");
      sfxPop();
      return;
    }
    if (this.picked === idx) {
      el.classList.remove("sfm-flake--picked");
      this.picked = null;
      return;
    }
    const a = this.kinds[this.picked]!;
    const b = this.kinds[idx]!;
    if (a.key === b.key) {
      // 配对成功
      this.locked = true;
      this.flakeEls[this.picked]!.classList.add("sfm-flake--match");
      this.flakeEls[this.picked]!.classList.remove("sfm-flake--picked");
      el.classList.add("sfm-flake--match");
      this.flakeEls[this.picked]!.disabled = true;
      el.disabled = true;
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.remaining -= 1;
      const left = this.root.querySelector("#sfm-left");
      if (left) left.textContent = String(this.remaining);
      if (this.remaining <= 0) {
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      } else {
        // 短暂锁定后解锁继续配对
        this.trackTimeout(() => {
          this.locked = false;
        }, 500);
      }
      this.picked = null;
    } else {
      el.classList.add("sfm-flake--wrong");
      this.flakeEls[this.picked]!.classList.add("sfm-flake--wrong");
      const aIdx = this.picked;
      const paused = this.onWrong();
      this.trackTimeout(() => {
        el.classList.remove("sfm-flake--wrong");
        this.flakeEls[aIdx]?.classList.remove("sfm-flake--wrong");
      }, 600);
      this.picked = null;
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "❄️",
      variant: "rest",
      body: "比一比雪花每条枝的形状、中心图案和颜色～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
      secondary: {
        text: "回大厅",
        icon: "🏠",
        onClick: () => {
          ov.destroy();
          navigate("");
        },
      },
    });
    ov.show();
  }

  private injectStyle(): void {
    if (document.getElementById("sfm-style")) return;
    const st = document.createElement("style");
    st.id = "sfm-style";
    st.textContent = SFM_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function SFM_CSS(theme: string): string {
  return `
.sfm-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(540px,100%);}
.sfm-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.sfm-board{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:20px;background:radial-gradient(circle at 30% 20%,#1a2a4a,#0d1830);border-radius:22px;box-shadow:var(--shadow);width:100%;max-width:460px;min-height:200px;}
.sfm-flake{width:78px;height:78px;border:none;background:rgba(255,255,255,.08);border-radius:14px;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;transition:transform .15s,background .15s;animation:sfm-fall .6s ease;}
.sfm-svg{width:64px;height:64px;filter:drop-shadow(0 0 4px ${theme});}
.sfm-flake:active{transform:scale(.92);}
.sfm-flake--picked{background:rgba(255,255,255,.28);transform:translateY(-6px) scale(1.06);box-shadow:0 0 12px ${theme};}
.sfm-flake--match{animation:sfm-melt .7s ease forwards;}
.sfm-flake--wrong{animation:sfm-shake .5s ease;}
@keyframes sfm-fall{0%{transform:translateY(-30px);opacity:0;}100%{transform:translateY(0);opacity:1;}}
@keyframes sfm-melt{0%{transform:scale(1);opacity:1;}60%{transform:scale(1.25);opacity:.8;}100%{transform:scale(.2);opacity:0;}}
@keyframes sfm-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px) rotate(-4deg);}75%{transform:translateX(5px) rotate(4deg);}}
.sfm-hint{font-size:.95rem;font-weight:700;color:#4a6a8a;text-align:center;}
@media (max-width:380px){.sfm-flake{width:64px;height:64px;}.sfm-svg{width:52px;height:52px;}.sfm-board{gap:8px;padding:14px;}}
`;
}

export function create(): SnowflakeMatchGame {
  return new SnowflakeMatchGame();
}
