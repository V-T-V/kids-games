/* 海底探险 Ocean Explore —— 海域里各种海洋生物藏在海草/珊瑚后面。
   孩子点击海草翻开发现生物，收集到指定的生物完成探索。
   独特点：每丛海草后都是惊喜——可能是要找的，也可能是别的。
   视觉：海草摇摆动画，翻开露出生物的惊喜效果，气泡上浮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

interface Creature {
  emoji: string;
  name: string;
}

/** 海洋生物库。 */
const CREATURES: Creature[] = [
  { emoji: "🐠", name: "热带鱼" },
  { emoji: "🐟", name: "小鱼" },
  { emoji: "🐙", name: "章鱼" },
  { emoji: "🦀", name: "螃蟹" },
  { emoji: "🐬", name: "海豚" },
  { emoji: "🐢", name: "海龟" },
  { emoji: "🦑", name: "鱿鱼" },
  { emoji: "🐳", name: "鲸鱼" },
  { emoji: "🦞", name: "龙虾" },
  { emoji: "🐚", name: "海螺" },
];

export class OceanExploreGame extends BaseGame {
  constructor() {
    super("ocean-explore");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 海草丛数。 */
  private bushN = 6;
  /** 每轮要收集的目标生物种数。 */
  private targetN = 2;
  /** 每丛海草后的生物。 */
  private hides: Creature[] = [];
  /** 本轮要收集的目标集合。 */
  private targets: Creature[] = [];
  /** 已收集的目标（按 emoji 去重计数）。 */
  private collected: Set<string> = new Set();
  private busy = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    if (this.difficulty === "easy") {
      this.bushN = 6;
      this.targetN = 1;
    } else if (this.difficulty === "medium") {
      this.bushN = 8;
      this.targetN = 2;
    } else {
      this.bushN = 10;
      this.targetN = 3;
    }
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 + trackTimeout 自动清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    this.collected = new Set();
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 选目标 */
    this.targets = shuffle(CREATURES).slice(0, this.targetN);
    /* 在海草丛中放置生物：保证每个目标至少出现一次 */
    this.hides = new Array(this.bushN).fill(null).map(() => sample(CREATURES));
    /* 强制把目标放进去 */
    this.targets.forEach((t, i) => {
      this.hides[i % this.bushN] = t;
    });
    /* 再打乱位置 */
    this.hides = shuffle(this.hides);

    const wrap = document.createElement("div");
    wrap.className = "oxe-wrap";

    const task = document.createElement("div");
    task.className = "oxe-task";
    const targetStr = this.targets
      .map((t) => `${t.emoji}${t.name}`)
      .join(" ");
    task.innerHTML = `翻开海草找：<b>${targetStr}</b><br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    /* 收集栏 */
    const tray = document.createElement("div");
    tray.className = "oxe-tray";
    tray.id = "oxe-tray";
    for (const t of this.targets) {
      const slot = document.createElement("span");
      slot.className = "oxe-tray__slot";
      slot.dataset.emoji = t.emoji;
      slot.innerHTML = `<span class="oxe-tray__emoji">${t.emoji}</span><span class="oxe-tray__name">${t.name}</span>`;
      tray.appendChild(slot);
    }
    wrap.appendChild(tray);

    /* 海域 */
    const sea = document.createElement("div");
    sea.className = "oxe-sea";
    sea.id = "oxe-sea";

    /* 上浮气泡装饰（纯视觉） */
    for (let i = 0; i < 8; i++) {
      const bub = document.createElement("span");
      bub.className = "oxe-bubble";
      bub.style.left = `${randInt(5, 95)}%`;
      bub.style.animationDuration = `${randInt(6, 12)}s`;
      bub.style.animationDelay = `${randInt(0, 6)}s`;
      sea.appendChild(bub);
    }

    /* 海草丛 */
    for (let i = 0; i < this.bushN; i++) {
      const bush = document.createElement("button");
      bush.type = "button";
      bush.className = "oxe-bush";
      bush.setAttribute("aria-label", `海草丛 ${i + 1}`);
      const c = this.hides[i]!;
      bush.dataset.emoji = c.emoji;
      bush.dataset.name = c.name;
      /* 海草外观（多片叶子） */
      bush.innerHTML = `<span class="oxe-bush__leaf" style="height:${randInt(50, 80)}px"></span><span class="oxe-bush__leaf" style="height:${randInt(40, 70)}px"></span><span class="oxe-bush__leaf" style="height:${randInt(45, 75)}px"></span>`;
      bush.addEventListener("click", () => this.flip(bush, c));
      sea.appendChild(bush);
    }
    wrap.appendChild(sea);
    this.root.appendChild(wrap);
  }

  private flip(bush: HTMLButtonElement, c: Creature): void {
    if (this.busy || bush.classList.contains("oxe-bush--flipped")) return;
    bush.classList.add("oxe-bush--flipped");
    bush.disabled = true;
    sfxPop();

    /* 揭示生物 */
    const rev = document.createElement("span");
    rev.className = "oxe-bush__creature";
    rev.textContent = c.emoji;
    bush.appendChild(rev);

    /* 判断是否是目标 */
    const isTarget = this.targets.some((t) => t.emoji === c.emoji);
    if (isTarget && !this.collected.has(c.emoji)) {
      this.collected.add(c.emoji);
      /* 收集栏高亮 */
      const slot = this.root.querySelector(
        `.oxe-tray__slot[data-emoji="${c.emoji}"]`,
      );
      slot?.classList.add("oxe-tray__slot--got");
      const r = bush.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();

      /* 全部收集完成 */
      if (this.collected.size >= this.targets.length) {
        this.busy = true;
        this.trackTimeout(() => this.roundClear(), 800);
      }
    } else if (!isTarget) {
      /* 不是目标：温柔提示"再找找"，不计错（探索容错） */
      rev.classList.add("oxe-bush__creature--other");
    }
  }

  private roundClear(): void {
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const ov = new Overlay({
      title: "全部找到啦！",
      emoji: "🐬",
      variant: "default",
      body: `<div style="font-size:2.4rem;text-align:center;">${this.targets.map((t) => t.emoji).join(" ")}</div>`,
      primary: {
        text: "继续探险",
        icon: "🌊",
        onClick: () => {
          ov.destroy();
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        },
      },
    });
    ov.show();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "海草后面还有好多生物，慢慢找～",
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
    if (document.getElementById("oxe-style")) return;
    const st = document.createElement("style");
    st.id = "oxe-style";
    st.textContent = OXE_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function OXE_CSS(theme: string): string {
  return `
.oxe-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(560px,100%);}
.oxe-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;}
.oxe-tray{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;background:#fff;padding:10px 16px;border-radius:16px;box-shadow:var(--shadow);min-height:52px;align-items:center;}
.oxe-tray__slot{display:inline-flex;flex-direction:column;align-items:center;gap:2px;padding:6px 12px;border-radius:12px;background:#eef4ff;border:2px dashed ${theme};opacity:.6;transition:all .3s;}
.oxe-tray__slot--got{opacity:1;border-style:solid;background:#fff;animation:oxe-bounce .4s ease;}
@keyframes oxe-bounce{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.oxe-tray__emoji{font-size:1.5rem;}
.oxe-tray__name{font-size:.75rem;font-weight:700;color:#4a6fa5;}
.oxe-sea{position:relative;width:min(480px,100%);height:min(52vh,400px);background:linear-gradient(180deg,#4d96ff,#2e5cb8 70%,#1a3d7a);border-radius:24px;box-shadow:var(--shadow),inset 0 4px 12px rgba(255,255,255,.15);overflow:hidden;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:6px;padding:16px 14px 20px;}
.oxe-bubble{position:absolute;bottom:-20px;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.9),rgba(255,255,255,.2));animation:oxe-rise linear infinite;pointer-events:none;}
@keyframes oxe-rise{0%{transform:translateY(0);opacity:0}10%{opacity:.8}90%{opacity:.6}100%{transform:translateY(-420px);opacity:0}}
.oxe-bush{position:relative;background:transparent;border:none;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;gap:3px;padding:0;width:56px;height:90px;transition:transform .2s;}
.oxe-bush:hover{transform:translateY(-4px);}
.oxe-bush:active{transform:scale(.92);}
.oxe-bush__leaf{display:inline-block;width:14px;background:linear-gradient(180deg,#6bcf7f,#3a9d4a);border-radius:50% 50% 8px 8px;transform-origin:bottom center;animation:oxe-sway 3s ease-in-out infinite;}
.oxe-bush__leaf:nth-child(2){animation-delay:.4s;}
.oxe-bush__leaf:nth-child(3){animation-delay:.8s;}
@keyframes oxe-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.oxe-bush--flipped{cursor:default;animation:oxe-flip .4s ease;}
.oxe-bush--flipped .oxe-bush__leaf{opacity:0;transform:translateY(20px) scale(.6);transition:all .35s;}
@keyframes oxe-flip{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
.oxe-bush__creature{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0);font-size:2.4rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));animation:oxe-reveal .5s cubic-bezier(.3,1.6,.4,1) forwards;z-index:2;}
@keyframes oxe-reveal{0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg);opacity:0}60%{transform:translate(-50%,-60%) scale(1.3) rotate(8deg);opacity:1}100%{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1}}
.oxe-bush__creature--other{filter:grayscale(.3);opacity:.7;}
@media (max-width:380px){.oxe-bush{width:46px;height:76px;}.oxe-bush__creature{font-size:2rem;}.oxe-tray__slot{padding:5px 8px;}}
`;
}

export function create(): OceanExploreGame {
  return new OceanExploreGame();
}
