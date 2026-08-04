/* 垃圾分类2 Sort-Trash —— 垃圾分类扩展版，更多类别与物品
   （电池→有害 / 果皮→厨余 / 纸→可回收 / 烟头→其他）。环保认知。
   独特点：在 recycle 基础上扩展更多物品，更丰富的分类练习。
   用 bindPointer 拖拽。每轮每类桶至少 1 件对应垃圾（保证有解）。
   前缀 str2-。 */

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
  可回收: ["📰", "📦", "🥫", "🧴", "👕", "🪣"],
  厨余: ["🍌", "🍎", "🥬", "🐟", "🥚", "🌽"],
  有害: ["🔋", "💊", "💡", "💉", "🌡️", "🎨"],
  其他: ["🦴", "🧻", "🥡", "🚬", "🪥", "🧷"],
};

interface Trash {
  bin: string;
  emoji: string;
  el: HTMLElement;
  placed: boolean;
}

export class SortTrashGame extends BaseGame {
  constructor() {
    super("sort-trash");
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

  private binCount(): number {
    return this.difficulty === "easy" ? 3 : 4;
  }
  private trashCount(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 8
        : 12;
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

    // 每个桶至少 1 件对应垃圾（保证可解），再随机补足
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
    wrap.className = "str2-wrap";

    const task = document.createElement("div");
    task.className = "str2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把垃圾拖到<b>对应的垃圾桶</b> ♻️`;
    wrap.appendChild(task);

    const cans = document.createElement("div");
    cans.className = "str2-cans";
    this.activeBins.forEach((b) => {
      const c = document.createElement("div");
      c.className = "str2-can";
      c.dataset.bin = b.name;
      c.style.setProperty("--str2-c", b.color);
      c.innerHTML = `<div class="str2-can__lid">${b.icon}</div><div class="str2-can__label">${b.name}</div>`;
      cans.appendChild(c);
      this.cans[b.name] = c;
    });
    wrap.appendChild(cans);

    const tray = document.createElement("div");
    tray.className = "str2-tray";
    list.forEach((t) => {
      const el = document.createElement("div");
      el.className = "str2-trash";
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
    const onDown = (pt: { x: number; y: number }) => {
      if (tr.placed || this.locked) return;
      dragging = true;
      const r = tr.el.getBoundingClientRect();
      offX = pt.x - r.left;
      offY = pt.y - r.top;
      origin = tr.el.parentElement;
      tr.el.classList.add("str2-trash--drag");
      tr.el.style.position = "fixed";
      tr.el.style.left = `${pt.x - offX}px`;
      tr.el.style.top = `${pt.y - offY}px`;
      tr.el.style.zIndex = "1000";
      document.body.appendChild(tr.el);
      sfxPop();
    };
    const onMove = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      tr.el.style.left = `${pt.x - offX}px`;
      tr.el.style.top = `${pt.y - offY}px`;
    };
    const onUp = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      tr.el.classList.remove("str2-trash--drag");
      let hit: string | null = null;
      for (const name of Object.keys(this.cans)) {
        const c = this.cans[name]!;
        const r = c.getBoundingClientRect();
        if (
          pt.x >= r.left &&
          pt.x <= r.right &&
          pt.y >= r.top &&
          pt.y <= r.bottom
        ) {
          hit = name;
          break;
        }
      }
      if (hit === tr.bin) {
        tr.placed = true;
        const c = this.cans[hit]!;
        const r = c.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        c.classList.add("str2-can--eat");
        this.trackTimeout(() => c.classList.remove("str2-can--eat"), 400);
        tr.el.classList.add("str2-trash--drop");
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
        tr.el.style.zIndex = "";
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
      body: "想想它是什么垃圾：可回收、厨余、有害还是其他？",
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
    if (document.getElementById("str2-style")) return;
    const st = document.createElement("style");
    st.id = "str2-style";
    st.textContent = STR2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function STR2_CSS(theme: string): string {
  return `
.str2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.str2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.str2-task b{color:${theme};}
.str2-cans{display:flex;gap:14px;justify-content:center;width:100%;flex-wrap:wrap;}
.str2-can{position:relative;width:96px;height:120px;background:linear-gradient(180deg,var(--str2-c,#616161) 0%,var(--str2-c,#616161) 100%);border-radius:10px 10px 16px 16px;box-shadow:inset 0 0 0 3px rgba(255,255,255,.3),0 4px 8px rgba(0,0,0,.2);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:10px;transition:transform .2s;}
.str2-can--eat{transform:translateY(-6px) scale(1.08);}
.str2-can__lid{position:absolute;top:-12px;left:50%;transform:translateX(-50%);width:106px;height:22px;background:var(--str2-c,#616161);border-radius:8px;box-shadow:inset 0 0 0 3px rgba(255,255,255,.3),0 2px 4px rgba(0,0,0,.2);font-size:1.3rem;line-height:22px;text-align:center;}
.str2-can__label{font-size:.95rem;font-weight:900;color:#fff;background:rgba(0,0,0,.25);padding:2px 10px;border-radius:999px;}
.str2-tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:20px;box-shadow:var(--shadow);width:100%;box-sizing:border-box;min-height:60px;}
.str2-trash{width:54px;height:54px;border-radius:50%;background:#fff;box-shadow:var(--shadow);font-size:1.9rem;display:flex;align-items:center;justify-content:center;cursor:grab;user-select:none;touch-action:none;}
.str2-trash--drag{cursor:grabbing;transform:scale(1.15);box-shadow:0 10px 20px rgba(0,0,0,.3);}
.str2-trash--drop{animation:str2-drop .45s ease forwards;}
@keyframes str2-drop{0%{transform:scale(1)}60%{transform:scale(.6)}100%{transform:scale(.1) translateY(20px);opacity:0}}
`;
}

export function create(): SortTrashGame {
  return new SortTrashGame();
}
