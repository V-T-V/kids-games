/* 变色龙 Chameleon Color —— 背景变成某种颜色，变色龙要变成和背景一样的颜色才能"隐身"。
   孩子从颜色选项里选和当前背景匹配的颜色。视觉：变色场景 + 变色龙 + 颜色选项。
   独特点：颜色感知 + 反应。难度 = 颜色相似度（越相似越难分辨）。
   通关 = 变对目标轮数。前缀 chm-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface ColorOpt {
  name: string;
  hex: string;
}

// 基础鲜艳色（easy）：彼此差异大
const BASIC: ColorOpt[] = [
  { name: "红", hex: "#ef4444" },
  { name: "黄", hex: "#fbbf24" },
  { name: "蓝", hex: "#3b82f6" },
  { name: "绿", hex: "#22c55e" },
  { name: "紫", hex: "#a855f7" },
  { name: "橙", hex: "#f97316" },
];

// 相似色组（hard）：组内颜色接近，更难分辨
const SIMILAR_GROUPS: ColorOpt[][] = [
  [
    { name: "天蓝", hex: "#38bdf8" },
    { name: "深蓝", hex: "#2563eb" },
    { name: "青色", hex: "#06b6d4" },
  ],
  [
    { name: "草绿", hex: "#65a30d" },
    { name: "翠绿", hex: "#16a34a" },
    { name: "嫩绿", hex: "#84cc16" },
  ],
  [
    { name: "粉色", hex: "#f472b6" },
    { name: "玫红", hex: "#e11d48" },
    { name: "紫色", hex: "#a855f7" },
  ],
  [
    { name: "土黄", hex: "#ca8a04" },
    { name: "橙色", hex: "#f97316" },
    { name: "棕色", hex: "#92400e" },
  ],
];

export class ChameleonColorGame extends BaseGame {
  constructor() {
    super("chameleon-color");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private bgHex = "";
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 生成本轮的颜色集合（含正确答案），保证颜色互不相同。 */
  private genColors(): { target: ColorOpt; options: ColorOpt[] } {
    if (this.difficulty === "easy") {
      // 4 个鲜艳色
      const pool = shuffle(BASIC).slice(0, 4)!;
      return { target: pool[0]!, options: pool };
    }
    if (this.difficulty === "medium") {
      // 5 色，含一组相似色中的干扰
      const group = shuffle(SIMILAR_GROUPS)[0]!;
      const target = shuffle(group)[0]!;
      const distract = group.filter((c) => c.hex !== target.hex).slice(0, 1);
      const others = shuffle(BASIC.filter((c) => c.hex !== target.hex)).slice(
        0,
        3,
      );
      const options = shuffle([target, ...distract, ...others]).slice(0, 5);
      return { target, options };
    }
    // hard：取一组相似色（3个），全部加入，再补 2 个其它色，共 5 选 1
    const group = shuffle(SIMILAR_GROUPS)[0]!;
    const target = shuffle(group)[0]!;
    const inGroup = group.slice();
    const others = shuffle(
      BASIC.filter((c) => !group.some((g) => g.hex === c.hex)),
    ).slice(0, 2);
    const options = shuffle([...inGroup, ...others]).slice(0, 5);
    return { target, options };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const { target, options } = this.genColors();
    this.bgHex = target.hex;

    const wrap = document.createElement("div");
    wrap.className = "chm-wrap";
    wrap.style.setProperty("--chm-bg", target.hex);

    const task = document.createElement("div");
    task.className = "chm-task";
    task.innerHTML = `变色龙要变成和背景<b>一样的颜色</b>才能隐身！第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "chm-scene";
    // 隐身指示：和背景同色时变色龙淡出
    const lizard = document.createElement("div");
    lizard.className = "chm-lizard";
    lizard.id = "chm-lizard";
    lizard.textContent = "🦎";
    lizard.style.color = "#cbd5e1"; // 初始灰，未匹配
    scene.appendChild(lizard);
    // 叶子装饰
    const leaf = document.createElement("div");
    leaf.className = "chm-leaf";
    leaf.textContent = "🍃";
    scene.appendChild(leaf);
    wrap.appendChild(scene);

    const label = document.createElement("div");
    label.className = "chm-label";
    label.textContent = "点背景颜色的那一块：";
    wrap.appendChild(label);

    const opts = document.createElement("div");
    opts.className = "chm-options";
    shuffle(options).forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chm-opt";
      b.style.setProperty("--chm-c", c.hex);
      b.setAttribute("aria-label", c.name);
      b.addEventListener("click", () => this.choose(b, c.hex, lizard));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(
    btn: HTMLButtonElement,
    hex: string,
    lizard: HTMLElement,
  ): void {
    if (this.locked) return;
    if (hex.toLowerCase() === this.bgHex.toLowerCase()) {
      this.locked = true;
      btn.classList.add("chm-opt--right");
      // 变色龙变背景色 → 隐身
      lizard.style.color = this.bgHex;
      lizard.classList.add("chm-lizard--hide");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 950);
    } else {
      btn.classList.add("chm-opt--wrong");
      this.trackTimeout(() => btn.classList.remove("chm-opt--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    this.locked = true;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🦎",
      variant: "rest",
      body: "先看看整个背景是什么颜色，再在下面找一模一样颜色的那一块～",
      primary: {
        text: "继续",
        icon: "🎨",
        onClick: () => {
          ov.destroy();
          this.locked = false;
        },
      },
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
    if (document.getElementById("chm-style")) return;
    const st = document.createElement("style");
    st.id = "chm-style";
    st.textContent = CHM_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function CHM_CSS(theme: string): string {
  return `
.chm-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.chm-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.chm-task b{color:${theme};}
.chm-scene{position:relative;width:100%;max-width:440px;height:220px;border-radius:20px;background:var(--chm-bg,#4d96ff);box-shadow:var(--shadow);overflow:hidden;transition:background .4s ease;display:flex;align-items:flex-end;justify-content:center;padding-bottom:18px;}
.chm-scene::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 30% 30%,rgba(255,255,255,.25),transparent 60%);}
.chm-lizard{position:relative;z-index:2;font-size:4.2rem;line-height:1;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));transition:opacity .5s ease,transform .5s ease,color .4s ease;animation:chm-bob 2s ease-in-out infinite alternate;}
@keyframes chm-bob{from{transform:translateY(0) rotate(-3deg)}to{transform:translateY(-6px) rotate(3deg)}}
.chm-lizard--hide{opacity:.18;transform:scale(.9);}
.chm-leaf{position:absolute;left:14px;top:14px;font-size:1.8rem;opacity:.6;animation:chm-sway 3s ease-in-out infinite alternate;}
@keyframes chm-sway{from{transform:rotate(-12deg)}to{transform:rotate(12deg)}}
.chm-label{font-size:1rem;font-weight:800;color:#374151;}
.chm-options{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.chm-opt{width:64px;height:64px;border-radius:18px;border:4px solid #fff;background:var(--chm-c,#888);cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.15),0 6px 10px rgba(0,0,0,.12);transition:transform .1s;}
.chm-opt:active{transform:translateY(3px);}
.chm-opt--right{box-shadow:0 0 0 4px ${theme},0 4px 0 rgba(0,0,0,.15);animation:chm-pop .4s ease;}
.chm-opt--wrong{animation:chm-shake .5s ease;}
@keyframes chm-pop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes chm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.chm-scene{height:190px;}.chm-lizard{font-size:3.4rem;}.chm-opt{width:54px;height:54px;}}
`;
}

export function create(): ChameleonColorGame {
  return new ChameleonColorGame();
}
