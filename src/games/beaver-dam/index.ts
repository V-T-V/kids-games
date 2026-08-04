/* 海狸筑坝 Beaver Dam —— 屏幕上方显示一个目标坝体图案（彩色木头按大小从大到小
   堆叠），孩子从下方木头条里按顺序点选对应大小的木头，放到坝上对应位置。
   独特点：大小排序 + 配对拼图。视觉：河岸 + 坝体空槽 + 可选木头条。
   难度 = 木头数。通关 = 筑完目标轮数。前缀 bvd-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const WOOD_COLORS = ["#b08968", "#9c6b4a", "#c89a6a", "#8a5a2b", "#a87848"];

interface Slot {
  /** 期望的大小档位（1=最大 ... max=最小） */
  size: number;
  filled: boolean;
  el: HTMLDivElement;
}

export class BeaverDamGame extends BaseGame {
  constructor() {
    super("beaver-dam");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private slots: Slot[] = [];
  private nextSize = 0;
  /** 当前轮最大档位 */
  private maxLevel = 0;
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

  private count(): number {
    if (this.difficulty === "easy") return 3;
    if (this.difficulty === "medium") return 4;
    return 5;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    this.maxLevel = n;
    // 目标顺序：从下到上 大 → 小（slot[0] 在最底部 = 最大 = n）
    this.slots = [];
    this.nextSize = n; // 先放最大的

    const wrap = document.createElement("div");
    wrap.className = "bvd-wrap";

    const task = document.createElement("div");
    task.className = "bvd-task";
    task.innerHTML = `先搬最粗的 🪵，一根根搭上去！第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    // 河流场景
    const scene = document.createElement("div");
    scene.className = "bvd-scene";

    // 海狸
    const beaver = document.createElement("div");
    beaver.className = "bvd-beaver";
    beaver.textContent = "🦫";
    scene.appendChild(beaver);

    // 坝体（从下到上堆叠；第一个子元素在最上方）
    const dam = document.createElement("div");
    dam.className = "bvd-dam";
    // slots: 底部最大(size=n)，顶部最小(size=1)
    const sizesTopDown: number[] = [];
    for (let s = 1; s <= n; s++) sizesTopDown.push(s); // 1..n 顶部到底部
    sizesTopDown.forEach((size) => {
      const slotEl = document.createElement("div");
      slotEl.className = "bvd-slot";
      slotEl.dataset.size = String(size);
      // 宽度按大小：最大最宽
      const widthPct = 50 + (size / n) * 45;
      slotEl.style.setProperty("--bvd-w", `${widthPct}%`);
      dam.appendChild(slotEl);
      this.slots.push({ size, filled: false, el: slotEl });
    });
    scene.appendChild(dam);

    // 目标提示图案（半透明，显示在坝后作为"图纸"）
    const hint = document.createElement("div");
    hint.className = "bvd-hint";
    hint.textContent = "📋 图纸";
    scene.appendChild(hint);

    wrap.appendChild(scene);

    // 可选木头条：打乱后展示
    const tray = document.createElement("div");
    tray.className = "bvd-tray";
    const trayLabel = document.createElement("div");
    trayLabel.className = "bvd-tray-label";
    trayLabel.textContent = "点最大的那根木头开始～";
    tray.appendChild(trayLabel);

    const woods: { size: number }[] = [];
    for (let s = 1; s <= n; s++) woods.push({ size: s });
    shuffle(woods).forEach((w, idx) => {
      const wood = document.createElement("button");
      wood.type = "button";
      wood.className = "bvd-wood";
      wood.dataset.size = String(w.size);
      const widthPct = 30 + (w.size / n) * 65;
      wood.style.setProperty("--bvd-ww", `${widthPct}%`);
      wood.style.setProperty(
        "--bvd-wc",
        WOOD_COLORS[idx % WOOD_COLORS.length]!,
      );
      wood.textContent = "🪵";
      wood.addEventListener("click", () => this.pick(wood, w.size));
      tray.appendChild(wood);
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);
  }

  private pick(btn: HTMLButtonElement, size: number): void {
    if (this.locked || btn.classList.contains("bvd-wood--used")) return;
    if (size === this.nextSize) {
      // 正确：找到对应 slot 填入
      this.locked = true;
      btn.classList.add("bvd-wood--used");
      const slot = this.slots.find((s) => s.size === size && !s.filled);
      if (slot) {
        slot.filled = true;
        slot.el.classList.add("bvd-slot--filled");
      }
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.nextSize -= 1;
      this.trackTimeout(() => {
        this.locked = false;
        if (this.nextSize <= 0) {
          // 本轮完成
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 700);
        }
      }, 350);
    } else {
      // 错了：抖一下
      btn.classList.add("bvd-wood--shake");
      this.trackTimeout(() => btn.classList.remove("bvd-wood--shake"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    this.locked = true;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🦫",
      variant: "rest",
      body: "先找最长（最大）的那根木头，放到坝的最下面～",
      primary: {
        text: "继续",
        icon: "🪵",
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
    if (document.getElementById("bvd-style")) return;
    const st = document.createElement("style");
    st.id = "bvd-style";
    st.textContent = BVD_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function BVD_CSS(theme: string): string {
  return `
.bvd-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.bvd-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.bvd-task b{color:${theme};}
.bvd-scene{position:relative;width:100%;max-width:440px;background:linear-gradient(180deg,#b3e5fc 0%,#4fc3f7 60%,#29b6f6 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);min-height:240px;padding:18px 16px 14px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;}
.bvd-scene::before{content:"";position:absolute;left:0;right:0;bottom:0;height:46px;background:linear-gradient(180deg,#4fc3f7,#0277bd);}
.bvd-beaver{position:absolute;right:14px;bottom:8px;font-size:2.4rem;z-index:6;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));animation:bvd-bob 1.6s ease-in-out infinite alternate;}
@keyframes bvd-bob{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-4px) rotate(4deg)}}
.bvd-hint{position:absolute;left:12px;top:10px;font-size:.85rem;font-weight:800;color:#fff;background:rgba(0,0,0,.28);padding:4px 10px;border-radius:999px;}
.bvd-dam{position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;padding-bottom:40px;}
.bvd-slot{width:var(--bvd-w,80%);height:22px;border-radius:8px;background:repeating-linear-gradient(90deg,rgba(176,137,104,.35) 0 14px,rgba(140,90,43,.35) 14px 28px);border:2px dashed rgba(255,255,255,.7);transition:all .25s ease;}
.bvd-slot--filled{background:repeating-linear-gradient(90deg,#c89a6a 0 14px,#8a5a2b 14px 28px);border:2px solid #5a3a1a;box-shadow:0 2px 0 rgba(0,0,0,.15);animation:bvd-drop .3s ease;}
@keyframes bvd-drop{0%{transform:translateY(-18px) scale(1.1);opacity:.4}100%{transform:translateY(0) scale(1);opacity:1}}
.bvd-tray{width:100%;max-width:440px;background:linear-gradient(180deg,#d7b88f,#b89868);border-radius:16px;padding:12px;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;gap:10px;border:3px solid #8a5a2b;}
.bvd-tray-label{font-size:.95rem;font-weight:800;color:#3a2a1a;}
.bvd-wood{width:var(--bvd-ww,60%);height:40px;border:none;border-radius:10px;background:linear-gradient(180deg,var(--bvd-wc,#b08968),rgba(0,0,0,.15));font-size:1.4rem;line-height:1;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.18),inset 0 2px 0 rgba(255,255,255,.3);transition:transform .1s;position:relative;}
.bvd-wood::after{content:"";position:absolute;inset:0;border-radius:10px;background:repeating-linear-gradient(90deg,transparent 0 18px,rgba(0,0,0,.12) 18px 20px);}
.bvd-wood:active{transform:translateY(3px);}
.bvd-wood--used{opacity:.25;pointer-events:none;filter:grayscale(.7);}
.bvd-wood--shake{animation:bvd-shake .45s ease;}
@keyframes bvd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.bvd-scene{min-height:210px;}.bvd-slot{height:20px;}.bvd-wood{height:36px;font-size:1.2rem;}}
`;
}

export function create(): BeaverDamGame {
  return new BeaverDamGame();
}
