/* 摆餐具 Table-Setting —— 饭前把餐具拖到餐桌上对应的位置
   （碗/筷/杯/勺各放对应的位置）。生活家务启蒙。
   独特点：一张餐桌有几个空位（轮廓提示），孩子把餐具拖到正确的轮廓里。
   用 bindPointer 实现拖拽。难度=餐具种类数。前缀 tst-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Item {
  kind: string;
  emoji: string;
  name: string;
}

const ITEMS: Item[] = [
  { kind: "bowl", emoji: "🥣", name: "碗" },
  { kind: "chopsticks", emoji: "🥢", name: "筷子" },
  { kind: "cup", emoji: "🥛", name: "杯子" },
  { kind: "spoon", emoji: "🥄", name: "勺子" },
  { kind: "plate", emoji: "🍽️", name: "盘子" },
  { kind: "napkin", emoji: "🧻", name: "纸巾" },
  { kind: "fork", emoji: "🍴", name: "叉子" },
  { kind: "knife", emoji: "🔪", name: "刀" },
  { kind: "pot", emoji: "🍲", name: "锅" },
  { kind: "teapot", emoji: "🫖", name: "茶壶" },
  { kind: "tray", emoji: "🍱", name: "餐盒" },
];

interface Piece {
  item: Item;
  el: HTMLElement;
  placed: boolean;
}

export class TableSettingGame extends BaseGame {
  constructor() {
    super("table-setting");
  }

  private unbinds: (() => void)[] = [];
  private slots: Record<string, HTMLElement> = {};
  private pieces: Piece[] = [];
  private remaining = 0;
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
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  /** 本关要摆的餐具种类数 */
  private kindCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 6;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.pieces = [];
    this.slots = {};
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.kindCount();
    const set = shuffle([...ITEMS]).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "tst-wrap";

    const task = document.createElement("div");
    task.className = "tst-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把餐具拖到桌上<b>对应的轮廓</b>里`;
    wrap.appendChild(task);

    // 餐桌：每个餐具一个轮廓槽
    const table = document.createElement("div");
    table.className = "tst-table";
    set.forEach((it) => {
      const slot = document.createElement("div");
      slot.className = "tst-slot";
      slot.dataset.kind = it.kind;
      slot.innerHTML =
        `<div class="tst-slot__ghost">${it.emoji}</div>` +
        `<div class="tst-slot__name">${it.name}</div>`;
      table.appendChild(slot);
      this.slots[it.kind] = slot;
    });
    wrap.appendChild(table);

    // 餐具托盘
    const tray = document.createElement("div");
    tray.className = "tst-tray";
    shuffle(set).forEach((it) => {
      const el = document.createElement("div");
      el.className = "tst-item";
      el.textContent = it.emoji;
      el.dataset.kind = it.kind;
      tray.appendChild(el);
      const p: Piece = { item: it, el, placed: false };
      this.pieces.push(p);
      this.enableDrag(p);
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);
    this.remaining = this.pieces.length;
  }

  private enableDrag(p: Piece): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (pt: { x: number; y: number }) => {
      if (p.placed || this.locked) return;
      dragging = true;
      const r = p.el.getBoundingClientRect();
      offX = pt.x - r.left;
      offY = pt.y - r.top;
      origin = p.el.parentElement;
      p.el.classList.add("tst-item--drag");
      p.el.style.position = "fixed";
      p.el.style.left = `${pt.x - offX}px`;
      p.el.style.top = `${pt.y - offY}px`;
      p.el.style.zIndex = "1000";
      document.body.appendChild(p.el);
      sfxPop();
    };
    const onMove = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      p.el.style.left = `${pt.x - offX}px`;
      p.el.style.top = `${pt.y - offY}px`;
    };
    const onUp = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      p.el.classList.remove("tst-item--drag");
      let hit: string | null = null;
      for (const kind of Object.keys(this.slots)) {
        const s = this.slots[kind]!;
        const r = s.getBoundingClientRect();
        if (
          pt.x >= r.left &&
          pt.x <= r.right &&
          pt.y >= r.top &&
          pt.y <= r.bottom
        ) {
          hit = kind;
          break;
        }
      }
      if (hit === p.item.kind) {
        p.placed = true;
        const slot = this.slots[hit]!;
        slot.classList.add("tst-slot--filled");
        const r = slot.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        // 放置后移除拖动元素，槽位显示实心餐具
        p.el.remove();
        slot
          .querySelector(".tst-slot__ghost")
          ?.classList.add("tst-slot__ghost--on");
        this.remaining -= 1;
        if (this.remaining <= 0) {
          this.locked = true;
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 900);
        }
      } else {
        p.el.style.position = "";
        p.el.style.left = "";
        p.el.style.top = "";
        p.el.style.zIndex = "";
        origin?.appendChild(p.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(p.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍽️",
      variant: "rest",
      body: "看清楚轮廓的样子，把一样的餐具拖过去～",
      primary: { text: "继续", icon: "🍽️", onClick: () => ov.destroy() },
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
    if (document.getElementById("tst-style")) return;
    const st = document.createElement("style");
    st.id = "tst-style";
    st.textContent = TST_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function TST_CSS(theme: string): string {
  return `
.tst-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.tst-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.tst-task b{color:${theme};}
.tst-table{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:22px 16px;background:linear-gradient(180deg,#e8c9a0,#d4a96a);border-radius:26px;box-shadow:var(--shadow),inset 0 0 0 4px #b88a4a;width:100%;box-sizing:border-box;}
.tst-slot{width:84px;height:96px;border-radius:18px;background:rgba(255,255,255,.35);border:3px dashed rgba(255,255,255,.7);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:all .25s;}
.tst-slot--filled{border:3px solid #6bcf7f;background:rgba(212,244,221,.6);animation:tst-fill .35s ease;}
.tst-slot__ghost{font-size:2.6rem;opacity:.35;filter:grayscale(.6);}
.tst-slot__ghost--on{opacity:1;filter:none;animation:tst-drop .35s ease;}
.tst-slot__name{font-size:.78rem;font-weight:800;color:#5a3a1a;background:rgba(255,255,255,.7);padding:1px 8px;border-radius:999px;}
.tst-tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:20px;box-shadow:var(--shadow);width:100%;box-sizing:border-box;}
.tst-item{width:56px;height:56px;border-radius:14px;background:#fff;box-shadow:var(--shadow);font-size:2rem;display:flex;align-items:center;justify-content:center;cursor:grab;user-select:none;touch-action:none;}
.tst-item--drag{cursor:grabbing;transform:scale(1.15);box-shadow:0 10px 20px rgba(0,0,0,.3);}
@keyframes tst-fill{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes tst-drop{0%{transform:translateY(-14px) scale(.5)}100%{transform:translateY(0) scale(1)}}
`;
}

export function create(): TableSettingGame {
  return new TableSettingGame();
}
