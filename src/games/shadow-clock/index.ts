/* 日晷 Shadow Clock —— 看太阳位置与影子方向，判断现在是什么时间。
   巧思：太阳东升西落，影子始终在物体的反方向。早晨太阳在东(左)，影子朝西(右)；
   中午太阳在头顶/南，影子朝北(短/下)；傍晚太阳在西(右)，影子朝东(左)。
   太阳位置 + 影子方向 + 时间选项。难度=选项数。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 时间场景：太阳方位 + 影子方向 + 标签 + emoji */
const SCENES: {
  id: string;
  label: string;
  /** 太阳水平位置(0左~1右) + 垂直(0地平~1高空) */
  sunX: number;
  sunY: number;
  /** 影子方向：'left' / 'right' / 'down'，及长度 */
  shadowDir: "left" | "right" | "down";
  shadowLen: number;
  sky: string;
}[] = [
  {
    id: "morning",
    label: "早晨",
    sunX: 0.15,
    sunY: 0.35,
    shadowDir: "right",
    shadowLen: 70,
    sky: "linear-gradient(180deg,#ffd9a0,#a3d9ff)",
  },
  {
    id: "noon",
    label: "中午",
    sunX: 0.5,
    sunY: 0.12,
    shadowDir: "down",
    shadowLen: 22,
    sky: "linear-gradient(180deg,#a3d9ff,#cdeaff)",
  },
  {
    id: "forenoon",
    label: "上午",
    sunX: 0.32,
    sunY: 0.22,
    shadowDir: "right",
    shadowLen: 48,
    sky: "linear-gradient(180deg,#bfe3ff,#d9f0ff)",
  },
  {
    id: "afternoon",
    label: "下午",
    sunX: 0.68,
    sunY: 0.24,
    shadowDir: "left",
    shadowLen: 48,
    sky: "linear-gradient(180deg,#cfe8ff,#ffe9c9)",
  },
  {
    id: "evening",
    label: "傍晚",
    sunX: 0.85,
    sunY: 0.35,
    shadowDir: "left",
    shadowLen: 70,
    sky: "linear-gradient(180deg,#ffb38a,#ffd9a0)",
  },
  {
    id: "dusk",
    label: "黄昏",
    sunX: 0.95,
    sunY: 0.5,
    shadowDir: "left",
    shadowLen: 92,
    sky: "linear-gradient(180deg,#ff8a5c,#ffb38a)",
  },
];

export class ShadowClockGame extends BaseGame {
  constructor() {
    super("shadow-clock");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const scene = sample(SCENES);
    // 选项 = 全部场景标签（最多3个），保证正确项在其中
    const opts = shuffle(SCENES.map((s) => ({ id: s.id, label: s.label })));

    const wrap = document.createElement("div");
    wrap.className = "shc2-wrap";

    const task = document.createElement("div");
    task.className = "shc2-task";
    task.textContent = `看太阳和影子，现在是什么时间？（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = this.buildScene(scene);
    wrap.appendChild(stage);

    const optsEl = document.createElement("div");
    optsEl.className = "shc2-opts";
    opts.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "shc2-opt";
      b.textContent = o.label;
      b.addEventListener("click", () => this.choose(o.id === scene.id, b));
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    this.root.appendChild(wrap);
  }

  /** 构建日晷场景 DOM：太阳 + 小树 + 影子 */
  private buildScene(scene: (typeof SCENES)[number]): HTMLDivElement {
    const stage = document.createElement("div");
    stage.className = "shc2-stage";
    stage.style.background = scene.sky;

    // 太阳
    const sun = document.createElement("div");
    sun.className = "shc2-sun";
    sun.style.left = `${scene.sunX * 100}%`;
    sun.style.top = `${scene.sunY * 100}%`;
    stage.appendChild(sun);

    // 地面
    const ground = document.createElement("div");
    ground.className = "shc2-ground";
    stage.appendChild(ground);

    // 树（中心）
    const treeWrap = document.createElement("div");
    treeWrap.className = "shc2-tree-wrap";
    const shadow = document.createElement("div");
    shadow.className = `shc2-shadow shc2-shadow--${scene.shadowDir}`;
    shadow.style.setProperty("--shc2-len", `${scene.shadowLen}px`);
    treeWrap.appendChild(shadow);
    const tree = document.createElement("div");
    tree.className = "shc2-tree";
    tree.innerHTML = `<div class="shc2-tree__leaf">🌳</div><div class="shc2-tree__trunk"></div>`;
    treeWrap.appendChild(tree);
    stage.appendChild(treeWrap);

    return stage;
  }

  private choose(correct: boolean, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (correct) {
      this.locked = true;
      sfxPop();
      btn.classList.add("shc2-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("shc2-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("shc2-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "影子总在太阳的对面～想想太阳在哪边？",
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
    if (document.getElementById("shc2-style")) return;
    const st = document.createElement("style");
    st.id = "shc2-style";
    st.textContent = SHC2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SHC2_CSS(theme: string): string {
  return `
.shc2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.shc2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.shc2-stage{position:relative;width:100%;height:280px;border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.shc2-sun{position:absolute;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#fff6,#ffd93d 60%,#ff9f43);box-shadow:0 0 30px rgba(255,217,61,.7);transform:translate(-50%,-50%);}
.shc2-ground{position:absolute;left:0;right:0;bottom:0;height:40px;background:repeating-linear-gradient(90deg,#8bc34a 0 24px,#9ccc65 24px 48px);box-shadow:inset 0 3px 0 rgba(255,255,255,.25);}
.shc2-tree-wrap{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;}
.shc2-tree{display:flex;flex-direction:column;align-items:center;position:relative;z-index:3;}
.shc2-tree__leaf{font-size:3.4rem;line-height:1;filter:drop-shadow(0 3px 2px rgba(0,0,0,.2));}
.shc2-tree__trunk{width:14px;height:18px;background:#8d5524;border-radius:0 0 4px 4px;}
.shc2-shadow{position:absolute;bottom:8px;left:50%;height:14px;border-radius:50%;background:rgba(60,40,20,.4);transform-origin:left center;z-index:2;filter:blur(1px);}
/* 影子方向：以树底为原点 */
.shc2-shadow--right{width:var(--shc2-len);transform:translateX(0) rotate(-8deg);}
.shc2-shadow--left{width:var(--shc2-len);transform:translateX(calc(-1 * var(--shc2-len))) rotate(8deg);}
.shc2-shadow--down{width:46px;height:10px;transform:translateX(-50%);}
.shc2-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.shc2-opt{min-width:100px;min-height:56px;padding:0 22px;font-size:1.3rem;font-weight:800;border-radius:18px;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .1s ease;border:none;cursor:pointer;}
.shc2-opt:active{transform:scale(.94);}
.shc2-opt--done{background:${theme};color:#fff;animation:shc2-pop .4s ease;}
.shc2-opt--wrong{animation:shc2-shake .4s ease;}
@keyframes shc2-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes shc2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.shc2-stage{height:230px;}.shc2-tree__leaf{font-size:2.8rem;}.shc2-opt{min-width:80px;font-size:1.1rem;}}
`;
}

export function create(): ShadowClockGame {
  return new ShadowClockGame();
}
