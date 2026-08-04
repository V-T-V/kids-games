/* 垃圾分类 Recycle —— 几个垃圾物品（瓶子/纸/果皮/电池），
   4 个垃圾桶（可回收/厨余/有害/其他），孩子拖垃圾到对应桶。
   独特点：环保分类认知 + 4 类桶（标准中国分类色），投桶动画。
   视觉：垃圾 emoji + 彩色分类桶。难度=垃圾数。通关=分对目标轮数。
   用 bindPointer 实现拖拽。巧思：每轮每类桶至少有 1 件对应垃圾（可解）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Bin {
  name: string;
  color: string;
  icon: string;
}

const BINS: Bin[] = [
  { name: "可回收", color: "#1976d2", icon: "♻️" },
  { name: "厨余", color: "#43a047", icon: "🍃" },
  { name: "有害", color: "#c62828", icon: "☣️" },
  { name: "其他", color: "#616161", icon: "🗑️" },
];

const ITEMS: Record<string, string[]> = {
  可回收: ["🥤", "📰", "📦", "🥫", "🧴"],
  厨余: ["🍌", "🍎", "🥬", "🐟", "🥚"],
  有害: ["🔋", "💊", "💡", "💉", "🧯"],
  其他: ["🚬", "🦴", "🪣", "🧻", "🥡"],
};

interface Trash {
  bin: string;
  emoji: string;
  el: HTMLElement;
  placed: boolean;
}

const ENCOURAGE = ["分类正确！", "环保小卫士！", "扔对啦！", "再扔一个～"];

export class RecycleGame extends BaseGame {
  constructor() {
    super("recycle");
  }

  private unbinds: (() => void)[] = [];
  private cans: Record<string, HTMLElement> = {};
  private trashes: Trash[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private activeBins: Bin[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  /** 本关用到的桶数（easy 先用 3 类，medium/hard 用全 4 类） */
  private binCount(): number {
    return this.difficulty === "easy" ? 3 : 4;
  }
  /** 垃圾总数 */
  private trashCount(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 8
        : 11;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.trashes = [];
    this.cans = {};
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const binN = this.binCount();
    this.activeBins = shuffle([...BINS]).slice(0, binN);
    const total = this.trashCount();

    // 先给每个桶配 1 件对应垃圾（保证可解），再随机补足
    const plan: { bin: string; emoji: string }[] = this.activeBins.map((b) => ({
      bin: b.name,
      emoji: sample(ITEMS[b.name]!),
    }));
    for (let i = this.activeBins.length; i < total; i++) {
      const b = sample(this.activeBins);
      plan.push({ bin: b.name, emoji: sample(ITEMS[b.name]!) });
    }
    const list = shuffle(plan);

    const wrap = document.createElement("div");
    wrap.className = "rc2-wrap";

    const task = document.createElement("div");
    task.className = "rc2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把垃圾拖到对应的垃圾桶 ♻️`;
    wrap.appendChild(task);

    // 桶区
    const cans = document.createElement("div");
    cans.className = "rc2-cans";
    this.activeBins.forEach((b) => {
      const c = document.createElement("div");
      c.className = "rc2-can";
      c.dataset.bin = b.name;
      c.style.setProperty("--rc2-c", b.color);
      c.innerHTML = `<div class="rc2-can__lid">${b.icon}</div><div class="rc2-can__label">${b.name}</div><div class="rc2-can__mouth" id="rc2-mouth-${b.name}"></div>`;
      cans.appendChild(c);
      this.cans[b.name] = c;
    });
    wrap.appendChild(cans);

    // 垃圾托盘
    const tray = document.createElement("div");
    tray.className = "rc2-tray";
    list.forEach((t) => {
      const el = document.createElement("div");
      el.className = "rc2-trash";
      el.textContent = t.emoji;
      el.dataset.bin = t.bin;
      tray.appendChild(el);
      const tr: Trash = { bin: t.bin, emoji: t.emoji, el, placed: false };
      this.trashes.push(tr);
      this.enableDrag(tr);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
    this.remaining = this.trashes.length;
  }

  private enableDrag(tr: Trash): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (tr.placed || this.locked) return;
      dragging = true;
      const r = tr.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = tr.el.parentElement;
      tr.el.classList.add("rc2-trash--drag");
      tr.el.style.position = "fixed";
      tr.el.style.left = `${p.x - offX}px`;
      tr.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(tr.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      tr.el.style.left = `${p.x - offX}px`;
      tr.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      tr.el.classList.remove("rc2-trash--drag");
      let hit: string | null = null;
      for (const name of Object.keys(this.cans)) {
        const c = this.cans[name]!;
        const r = c.getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hit = name;
          break;
        }
      }
      if (hit === tr.bin) {
        tr.placed = true;
        const r = this.cans[hit]!.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        // 投入动画后移除
        tr.el.classList.add("rc2-trash--drop");
        this.trackTimeout(() => tr.el.remove(), 450);
        this.remaining -= 1;
        if (this.remaining <= 0) {
          this.locked = true;
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 800);
        }
      } else {
        tr.el.style.position = "";
        tr.el.style.left = "";
        tr.el.style.top = "";
        origin?.appendChild(tr.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(tr.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "♻️",
      variant: "rest",
      body: `想想它是什么垃圾：可回收、厨余、有害还是其他？ ${sample(ENCOURAGE)}`,
      primary: { text: "继续", icon: "🗑️", onClick: () => ov.destroy() },
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
    if (document.getElementById("rc2-style")) return;
    const st = document.createElement("style");
    st.id = "rc2-style";
    st.textContent = RC2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function RC2_CSS(theme: string): string {
  return `
.rc2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.rc2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.rc2-cans{display:flex;gap:14px;justify-content:center;width:100%;flex-wrap:wrap;}
.rc2-can{position:relative;width:96px;height:120px;background:linear-gradient(180deg,var(--rc2-c,#616161) 0%,var(--rc2-c,#616161) 100%);border-radius:10px 10px 16px 16px;box-shadow:inset 0 0 0 3px rgba(255,255,255,.3),0 4px 8px rgba(0,0,0,.2);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:10px;}
.rc2-can__lid{position:absolute;top:-12px;left:50%;transform:translateX(-50%);width:106px;height:16px;background:var(--rc2-c,#616161);border-radius:8px;box-shadow:inset 0 0 0 3px rgba(255,255,255,.3),0 2px 4px rgba(0,0,0,.2);}
.rc2-can__lid{font-size:1.4rem;line-height:16px;text-align:center;color:#fff;}
.rc2-can__label{color:#fff;font-size:.85rem;font-weight:900;padding:3px 10px;background:rgba(255,255,255,.25);border-radius:999px;text-shadow:0 1px 2px rgba(0,0,0,.3);z-index:2;}
.rc2-can__mouth{display:none;}
.rc2-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.65);border-radius:22px;box-shadow:var(--shadow);max-width:480px;min-height:72px;}
.rc2-trash{font-size:2.2rem;cursor:grab;touch-action:none;user-select:none;width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,.15);transition:transform .12s;}
.rc2-trash:active{transform:scale(1.12);}
.rc2-trash--drag{cursor:grabbing;transform:scale(1.25);z-index:100;}
.rc2-trash--drop{animation:rc2-drop .45s ease forwards;}
@keyframes rc2-drop{0%{transform:scale(1)}50%{transform:scale(.7) translateY(20px)}100%{transform:scale(0) translateY(40px);opacity:0}}
@media (max-width:380px){.rc2-can{width:78px;height:104px;}.rc2-can__lid{width:88px;}.rc2-trash{font-size:1.9rem;width:44px;height:44px;}.rc2-task{font-size:.95rem;}}
.rc2-theme{color:${theme};}
`;
}

export function create(): RecycleGame {
  return new RecycleGame();
}
