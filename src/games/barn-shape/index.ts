/* 谷仓形状 Barn Shape —— 谷仓门有不同形状标记（圆/方/三角/星），
   把对应形状的物品拖进对应谷仓。
   独特点：形状归类 + 拖拽精细动作。
   视觉：三角屋顶的谷仓 + 形状门 + 物品 emoji。
   巧思：放对后物品缩进门里冒出星光；放错弹回原位。
   难度 = 形状数。通关 = 归仓目标轮数。前缀 bsh-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Shape {
  id: string;
  /** 门上画的几何形状 */
  mark: string;
  name: string;
  /** 形状对应的物品 emoji */
  items: string[];
}

const SHAPES: Shape[] = [
  { id: "circle", mark: "●", name: "圆形", items: ["⚽", "🏀", "🍊", "🍪"] },
  { id: "square", mark: "■", name: "方形", items: ["📦", "🍞", "🎁", "🧀"] },
  {
    id: "triangle",
    mark: "▲",
    name: "三角形",
    items: ["🍕", "🖍️", "📍", "🍉"],
  },
  { id: "star", mark: "★", name: "星形", items: ["⭐", "🌟", "✨", "🚀"] },
];

interface Token {
  shape: Shape;
  el: HTMLElement;
  placed: boolean;
}

export class BarnShapeGame extends BaseGame {
  constructor() {
    super("barn-shape");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private count(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 4;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];

    const n = this.count();
    this.remaining = n;
    const pickedShapes = shuffle(SHAPES).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "bsh-wrap";

    const task = document.createElement("div");
    task.className = "bsh-task";
    task.innerHTML = `把物品拖进<b>形状一样</b>的谷仓～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "bsh-board";

    // 上排：谷仓（每个对应一种形状）
    const barns = document.createElement("div");
    barns.className = "bsh-barns";
    const barnEls: HTMLDivElement[] = [];
    pickedShapes.forEach((s) => {
      const barn = document.createElement("div");
      barn.className = "bsh-barn";
      barn.dataset.id = s.id;
      barn.innerHTML = `
        <div class="bsh-barn__roof"></div>
        <div class="bsh-barn__body">
          <div class="bsh-barn__mark">${s.mark}</div>
          <div class="bsh-barn__name">${s.name}</div>
          <div class="bsh-barn__door"></div>
        </div>`;
      barns.appendChild(barn);
      barnEls.push(barn);
    });
    board.appendChild(barns);

    // 下排：物品（每种形状一个物品），顺序打乱后放入托盘
    const tray = document.createElement("div");
    tray.className = "bsh-tray";
    const tokens: Token[] = pickedShapes.map((s) => {
      const emoji = sample(s.items);
      const el = document.createElement("div");
      el.className = "bsh-item";
      el.textContent = emoji;
      el.setAttribute("aria-label", `${s.name}物品`);
      return { shape: s, el, placed: false };
    });
    shuffle(tokens).forEach((t) => tray.appendChild(t.el));
    board.appendChild(tray);
    wrap.appendChild(board);
    this.root.appendChild(wrap);

    tokens.forEach((tok) => this.enableDrag(tok, barnEls));
    this.reportProgress(this.roundsDone, this.roundTotal);
  }

  private enableDrag(tok: Token, barns: HTMLDivElement[]): void {
    let dragging = false,
      ox = 0,
      oy = 0,
      origin: HTMLElement | null = null;
    const u = bindPointer(tok.el, {
      down: (p) => {
        if (tok.placed) return;
        dragging = true;
        const r = tok.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        origin = tok.el.parentElement;
        tok.el.classList.add("bsh-item--drag");
        tok.el.style.position = "fixed";
        tok.el.style.left = `${p.x - ox}px`;
        tok.el.style.top = `${p.y - oy}px`;
        tok.el.style.width = `${r.width}px`;
        tok.el.style.height = `${r.height}px`;
        document.body.appendChild(tok.el);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        tok.el.style.left = `${p.x - ox}px`;
        tok.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        tok.el.classList.remove("bsh-item--drag");
        const barn = barns.find((b) => {
          const r = b.getBoundingClientRect();
          return (
            p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
          );
        });
        if (barn && barn.dataset.id === tok.shape.id) {
          // 放对
          tok.placed = true;
          tok.el.remove();
          barn.classList.add("bsh-barn--happy");
          const star = document.createElement("span");
          star.className = "bsh-barn__star";
          star.textContent = "✨";
          barn.appendChild(star);
          const r = barn.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.remaining -= 1;
          if (this.remaining <= 0) {
            this.roundsDone += 1;
            this.reportProgress(this.roundsDone, this.roundTotal);
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal) {
                this.finishClear(starsByAccuracy(this.wrongCount));
              } else {
                this.startRound();
              }
            }, 1000);
          }
        } else {
          // 放错或没放谷仓：弹回原位
          tok.el.style.position = "";
          tok.el.style.left = "";
          tok.el.style.top = "";
          tok.el.style.width = "";
          tok.el.style.height = "";
          origin?.appendChild(tok.el);
          const paused = this.onWrong();
          if (paused) this.showRest();
        }
      },
    });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌟",
      variant: "rest",
      body: "看看谷仓门上的形状，再看看物品的形状～",
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
    if (document.getElementById("bsh-style")) return;
    const st = document.createElement("style");
    st.id = "bsh-style";
    st.textContent = BSH_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function BSH_CSS(_theme: string): string {
  return `
.bsh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(540px,100%);}
.bsh-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.bsh-board{display:flex;flex-direction:column;gap:22px;width:100%;align-items:center;}
.bsh-barns{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.bsh-barn{position:relative;width:96px;height:120px;display:flex;flex-direction:column;align-items:center;transition:transform .2s;}
.bsh-barn__roof{width:0;height:0;border-left:54px solid transparent;border-right:54px solid transparent;border-bottom:34px solid #b0443a;align-self:center;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
.bsh-barn__body{position:relative;width:96px;height:96px;background:linear-gradient(180deg,#e8806f,#d96654);border:3px solid #8a3530;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:8px;gap:2px;box-shadow:var(--shadow);}
.bsh-barn__mark{font-size:2rem;line-height:1;color:#fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.3));}
.bsh-barn__name{font-size:.7rem;font-weight:800;color:#fff8;}
.bsh-barn__door{position:absolute;bottom:0;width:34px;height:42px;background:#5a2a26;border-radius:16px 16px 0 0;border:2px solid #3e1d1a;}
.bsh-barn--happy{animation:bsh-bounce .5s ease;}
.bsh-barn--happy .bsh-barn__body{background:linear-gradient(180deg,#9be36b,#5fc04a);border-color:#3a8a30;}
.bsh-barn--happy .bsh-barn__roof{border-bottom-color:#3a8a30;}
@keyframes bsh-bounce{0%{transform:scale(1);}40%{transform:scale(1.15);}100%{transform:scale(1);}}
.bsh-barn__star{position:absolute;top:-6px;font-size:1.4rem;animation:bsh-in .5s ease;}
@keyframes bsh-in{0%{transform:scale(.2) translateY(8px);opacity:0;}60%{transform:scale(1.4);opacity:1;}100%{transform:scale(1);}}
.bsh-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:14px 18px;background:rgba(255,255,255,.55);border-radius:18px;min-height:76px;width:100%;max-width:440px;}
.bsh-item{font-size:2.6rem;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));transition:transform .1s;line-height:1;}
.bsh-item--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
@media (max-width:380px){.bsh-barn,.bsh-barn__body{width:78px;}.bsh-barn__body{height:82px;}.bsh-barn__roof{border-left:44px solid transparent;border-right:44px solid transparent;border-bottom:28px solid #b0443a;}.bsh-item{font-size:2.2rem;}}
`;
}

export function create(): BarnShapeGame {
  return new BarnShapeGame();
}
