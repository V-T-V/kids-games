/* 彩虹桥 Rainbow Bridge —— 按红橙黄绿青蓝紫顺序点击散落的彩虹块。
   独特点：弧形排列的彩虹块，点对位置亮起并升起到桥上，完成搭出完整彩虹。
   巧思：颜色打乱程度随难度增加（easy 接近有序，hard 完全乱序）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface RainbowBand {
  key: string;
  name: string;
  hex: string;
  order: number;
}

// 红→橙→黄→绿→青→蓝→紫
const RAINBOW: RainbowBand[] = [
  { key: "red", name: "红", hex: "#ff5a5a", order: 0 },
  { key: "orange", name: "橙", hex: "#ff9f43", order: 1 },
  { key: "yellow", name: "黄", hex: "#ffd93d", order: 2 },
  { key: "green", name: "绿", hex: "#6bcf7f", order: 3 },
  { key: "cyan", name: "青", hex: "#22d3ee", order: 4 },
  { key: "blue", name: "蓝", hex: "#4d96ff", order: 5 },
  { key: "purple", name: "紫", hex: "#a55eea", order: 6 },
];

export class RainbowBridgeGame extends BaseGame {
  constructor() {
    super("rainbow-bridge");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private nextOrder = 0;
  private placed = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.nextOrder = 0;
    this.placed = 0;

    const wrap = document.createElement("div");
    wrap.className = "rb-wrap";

    const task = document.createElement("div");
    task.className = "rb-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 按<b>红→橙→黄→绿→青→蓝→紫</b>顺序点`;
    wrap.appendChild(task);

    // 彩虹桥容器（弧形）
    const bridge = document.createElement("div");
    bridge.className = "rb-bridge";

    // 桥上已点亮的位置（弧形排列）
    const placed = document.createElement("div");
    placed.className = "rb-bridge-placed";
    bridge.appendChild(placed);

    // 散落区：底部打乱的颜色块
    const scatter = document.createElement("div");
    scatter.className = "rb-scatter";

    // 难度决定打乱程度
    let order = RAINBOW.slice();
    if (this.difficulty === "easy") {
      // 只做一次相邻交换，接近有序
      order = mildShuffle(RAINBOW);
    } else {
      order = shuffle(RAINBOW);
    }

    for (const band of order) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rb-band";
      b.dataset.order = String(band.order);
      b.style.setProperty("--rb-color", band.hex);
      b.innerHTML = `<span class="rb-band-name">${band.name}</span>`;
      b.addEventListener("click", () => this.pick(b, band, placed));
      scatter.appendChild(b);
    }
    bridge.appendChild(scatter);
    wrap.appendChild(bridge);

    this.root.appendChild(wrap);
  }

  private pick(
    btn: HTMLButtonElement,
    band: RainbowBand,
    placed: HTMLElement,
  ): void {
    if (btn.classList.contains("rb-band--used")) return;
    if (band.order === this.nextOrder) {
      sfxPop();
      btn.classList.add("rb-band--used");
      // 升起到桥上
      const chip = document.createElement("div");
      chip.className = "rb-placed-chip";
      chip.style.setProperty("--rb-color", band.hex);
      chip.style.setProperty("--rb-i", String(band.order));
      chip.textContent = band.name;
      placed.appendChild(chip);
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.nextOrder += 1;
      this.placed += 1;
      if (this.placed >= RAINBOW.length) {
        this.root.querySelector(".rb-bridge")?.classList.add("rb-bridge--done");
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      }
    } else {
      btn.classList.add("rb-shake");
      this.trackTimeout(() => btn.classList.remove("rb-shake"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "彩虹是从红色开始搭的，先找红色哦～",
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
    if (document.getElementById("rb-style")) return;
    const st = document.createElement("style");
    st.id = "rb-style";
    st.textContent = RB_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

/** 轻度打乱：只交换相邻元素，顺序接近原序（easy 难度用）。 */
function mildShuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  const times = 2;
  for (let k = 0; k < times; k++) {
    const i = Math.floor(Math.random() * (a.length - 1));
    [a[i], a[i + 1]] = [a[i + 1]!, a[i]!];
  }
  return a;
}

function RB_CSS(theme: string): string {
  return `
.rb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.rb-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 18px;border-radius:999px;box-shadow:var(--shadow);}
.rb-bridge{display:flex;flex-direction:column;align-items:center;gap:24px;width:100%;position:relative;padding:8px;}
.rb-bridge-placed{position:relative;width:min(360px,90vw);height:140px;}
.rb-placed-chip{position:absolute;bottom:0;left:calc(50% + (var(--rb-i,0) - 3) * 12% );width:44px;height:36px;border-radius:22px 22px 6px 6px;background:var(--rb-color);color:#fff;font-weight:800;font-size:1rem;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);animation:rb-rise .6s cubic-bezier(.3,1.4,.5,1);}
@keyframes rb-rise{0%{transform:translateY(40px) scale(.6);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
.rb-bridge--done{animation:rb-celebrate 1.1s ease;}
@keyframes rb-celebrate{0%{transform:scale(1)}40%{transform:scale(1.05)}100%{transform:scale(1)}}
.rb-scatter{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:18px;background:rgba(255,255,255,.55);border-radius:22px;box-shadow:var(--shadow);max-width:480px;}
.rb-band{width:60px;height:60px;border:none;cursor:pointer;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,var(--rb-color,${theme}));box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 4px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;transition:transform .12s;}
.rb-band:active{transform:scale(.88);}
.rb-band--used{transform:scale(.4);opacity:0;pointer-events:none;}
.rb-band-name{color:#fff;font-weight:800;font-size:1.1rem;text-shadow:0 1px 2px rgba(0,0,0,.3);}
.rb-shake{animation:rb-shake .5s ease;}
@keyframes rb-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}
@media (max-width:380px){.rb-band{width:48px;height:48px;}.rb-band-name{font-size:.95rem;}.rb-placed-chip{width:36px;height:30px;}}
`;
}

export function create(): RainbowBridgeGame {
  return new RainbowBridgeGame();
}
