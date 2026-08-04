/* 彩虹复原 Rainbow Order —— 7 色彩虹被打乱成一行，孩子按
   红→橙→黄→绿→青→蓝→紫的正确顺序点击色块复原。
   巧思：点击正确顺序的下一个颜色，色块飞入彩虹桥归位；点错温柔提示。
   难度=打乱程度（始终 7 色）。通关=复原目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Color {
  id: number; // 正确序号 0-6
  name: string;
  hex: string;
}

const RAINBOW: Color[] = [
  { id: 0, name: "红", hex: "#ff5252" },
  { id: 1, name: "橙", hex: "#ff9f43" },
  { id: 2, name: "黄", hex: "#ffd93d" },
  { id: 3, name: "绿", hex: "#6bcf7f" },
  { id: 4, name: "青", hex: "#22d3ee" },
  { id: 5, name: "蓝", hex: "#4d96ff" },
  { id: 6, name: "紫", hex: "#a55eea" },
];

export class RainbowOrderGame extends BaseGame {
  constructor() {
    super("rainbow-order");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private nextId = 0; // 下一个该点的颜色序号
  private placed = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.nextId = 0;
    this.placed = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 打乱顺序，保证至少有 3 个色块不在原位（避免开局已接近正确）
    let scrambled = shuffle(RAINBOW);
    let inPlace = scrambled.filter((c, i) => c.id === i).length;
    let guard = 0;
    while (inPlace > 4 && guard < 20) {
      scrambled = shuffle(RAINBOW);
      inPlace = scrambled.filter((c, i) => c.id === i).length;
      guard += 1;
    }

    const wrap = document.createElement("div");
    wrap.className = "rbo-wrap";

    const task = document.createElement("div");
    task.className = "rbo-task";
    task.textContent = `按 红橙黄绿青蓝紫 的顺序点色块复原（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 目标顺序提示（小色条）
    const ref = document.createElement("div");
    ref.className = "rbo-ref";
    ref.innerHTML = `<span class="rbo-ref__label">正确顺序：</span>`;
    RAINBOW.forEach((c) => {
      const d = document.createElement("span");
      d.className = "rbo-ref__dot";
      d.style.background = c.hex;
      d.title = c.name;
      ref.appendChild(d);
    });
    wrap.appendChild(ref);

    // 彩虹桥（已复原，从左到右逐个亮起）
    const arc = document.createElement("div");
    arc.className = "rbo-arc";
    const arcSlots: HTMLDivElement[] = [];
    RAINBOW.forEach((c, i) => {
      const s = document.createElement("div");
      s.className = "rbo-arc__slot";
      s.style.background = c.hex;
      s.dataset.idx = String(i);
      const lbl = document.createElement("span");
      lbl.className = "rbo-arc__lbl";
      lbl.textContent = c.name;
      s.appendChild(lbl);
      arc.appendChild(s);
      arcSlots.push(s);
    });
    wrap.appendChild(arc);

    // 打乱的色块（待点）
    const tray = document.createElement("div");
    tray.className = "rbo-tray";
    const chips: HTMLButtonElement[] = [];
    scrambled.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rbo-chip";
      b.style.background = c.hex;
      b.dataset.id = String(c.id);
      b.dataset.pos = String(i);
      const lbl = document.createElement("span");
      lbl.className = "rbo-chip__lbl";
      lbl.textContent = c.name;
      b.appendChild(lbl);
      b.addEventListener("click", () => this.tap(c, b, arcSlots[c.id]!));
      tray.appendChild(b);
      chips.push(b);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private tap(c: Color, btn: HTMLButtonElement, slot: HTMLDivElement): void {
    if (btn.disabled) return;
    if (c.id === this.nextId) {
      // 正确：归位
      btn.disabled = true;
      btn.classList.add("rbo-chip--used");
      slot.classList.add("rbo-arc__slot--on");
      sfxPop();
      const r = slot.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.nextId += 1;
      this.placed += 1;
      if (this.placed >= RAINBOW.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 900);
      }
    } else {
      btn.classList.add("rbo-chip--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("rbo-chip--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "彩虹从外到内：红橙黄绿青蓝紫～",
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
    if (document.getElementById("rbo-style")) return;
    const st = document.createElement("style");
    st.id = "rbo-style";
    st.textContent = RBO_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function RBO_CSS(_theme: string): string {
  return `
.rbo-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.rbo-task{font-size:1.08rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.rbo-ref{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;background:rgba(255,255,255,.6);padding:6px 14px;border-radius:999px;}
.rbo-ref__label{font-size:.85rem;font-weight:800;color:var(--ink-soft);}
.rbo-ref__dot{width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2);}
.rbo-arc{display:flex;gap:6px;}
.rbo-arc__slot{position:relative;width:54px;height:64px;border-radius:14px 14px 36px 36px;opacity:.28;filter:grayscale(.5);transition:all .3s cubic-bezier(.34,1.56,.64,1);box-shadow:var(--shadow);}
.rbo-arc__slot--on{opacity:1;filter:none;transform:translateY(-4px);box-shadow:0 8px 14px rgba(0,0,0,.2);}
.rbo-arc__lbl{position:absolute;bottom:-22px;left:0;right:0;text-align:center;font-size:.85rem;font-weight:800;color:var(--ink);}
.rbo-tray{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:14px;min-height:80px;align-items:center;}
.rbo-chip{position:relative;width:62px;height:62px;border-radius:50%;border:4px solid #fff;box-shadow:0 4px 8px rgba(0,0,0,.2);cursor:pointer;transition:transform .1s ease;}
.rbo-chip:active{transform:scale(.92);}
.rbo-chip__lbl{position:absolute;bottom:-22px;left:0;right:0;text-align:center;font-size:.85rem;font-weight:800;color:var(--ink);}
.rbo-chip--used{opacity:.3;cursor:default;transform:scale(.85);}
.rbo-chip--wrong{animation:rbo-shake .4s ease;}
@keyframes rbo-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:400px){.rbo-arc__slot{width:42px;height:52px;}.rbo-chip{width:50px;height:50px;}}
`;
}

export function create(): RainbowOrderGame {
  return new RainbowOrderGame();
}
