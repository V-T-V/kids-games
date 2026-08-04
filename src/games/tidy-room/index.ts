/* 收拾房间2 Tidy Room —— 把散落的物品按类别拖到对应的收纳箱：
   玩具/书/衣服/文具/鞋子。独特点：多类别分类 + 精细拖拽（比 tidy-up 更多类）。
   视觉：房间场景 + 五个彩色收纳箱 + 散落物品 emoji。
   巧思：每类物品配一个颜色箱；拖错弹回并提示。难度=类别数。前缀 tdr-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Category {
  id: string;
  name: string;
  color: string;
  items: { emoji: string; name: string }[];
}

const CATEGORIES: Category[] = [
  {
    id: "toy",
    name: "玩具",
    color: "#ff5252",
    items: [
      { emoji: "🚗", name: "小汽车" },
      { emoji: "🧸", name: "小熊" },
      { emoji: "⚽", name: "皮球" },
    ],
  },
  {
    id: "book",
    name: "书",
    color: "#4d96ff",
    items: [
      { emoji: "📕", name: "故事书" },
      { emoji: "📘", name: "图画书" },
    ],
  },
  {
    id: "clothes",
    name: "衣服",
    color: "#6bcf7f",
    items: [
      { emoji: "👕", name: "上衣" },
      { emoji: "👖", name: "裤子" },
    ],
  },
  {
    id: "stationery",
    name: "文具",
    color: "#a55eea",
    items: [
      { emoji: "✏️", name: "铅笔" },
      { emoji: "✂️", name: "剪刀" },
      { emoji: "📐", name: "尺子" },
    ],
  },
  {
    id: "shoes",
    name: "鞋子",
    color: "#ff9f43",
    items: [
      { emoji: "👟", name: "运动鞋" },
      { emoji: "🥿", name: "皮鞋" },
    ],
  },
];

export class TidyRoomGame extends BaseGame {
  constructor() {
    super("tidy-room");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private boxes: HTMLDivElement[] = [];
  private remaining = 0;

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

  /** 难度=类别数。easy=3，medium=4，hard=5。 */
  private catCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.boxes = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.catCount();
    const cats = shuffle(CATEGORIES).slice(0, n);
    // 每类选 1-2 个物品
    const items: { catId: string; emoji: string; name: string }[] = [];
    cats.forEach((c) => {
      const picks = shuffle(c.items).slice(
        0,
        this.difficulty === "easy" ? 1 : 2,
      );
      picks.forEach((p) =>
        items.push({ catId: c.id, emoji: p.emoji, name: p.name }),
      );
    });
    this.remaining = items.length;
    const shuffledItems = shuffle(items);

    const wrap = document.createElement("div");
    wrap.className = "tdr-wrap";
    const task = document.createElement("div");
    task.className = "tdr-task";
    task.innerHTML = `把房间里的东西<b>分类</b>放到对应的箱子里～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 房间区（散落物品）
    const room = document.createElement("div");
    room.className = "tdr-room";
    shuffledItems.forEach((it) => {
      const el = document.createElement("div");
      el.className = "tdr-item";
      el.textContent = it.emoji;
      el.title = it.name;
      // 随机散布位置
      el.style.left = `${15 + Math.random() * 70}%`;
      el.style.top = `${15 + Math.random() * 65}%`;
      room.appendChild(el);
      this.enableDrag({ item: it, el, room });
    });
    wrap.appendChild(room);

    // 收纳箱区
    const boxArea = document.createElement("div");
    boxArea.className = "tdr-boxes";
    cats.forEach((c) => {
      const box = document.createElement("div");
      box.className = "tdr-box";
      box.style.setProperty("--tdr-color", c.color);
      box.dataset.cat = c.id;
      box.innerHTML = `<div class="tdr-box__label">${c.name}箱</div><div class="tdr-box__items"></div>`;
      boxArea.appendChild(box);
      this.boxes.push(box);
    });
    wrap.appendChild(boxArea);
    this.root.appendChild(wrap);
  }

  private enableDrag(d: {
    item: { catId: string; emoji: string; name: string };
    el: HTMLDivElement;
    room: HTMLElement;
  }): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    let placed = false;
    const u = bindPointer(d.el, {
      down: (p) => {
        if (placed) return;
        dragging = true;
        const r = d.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        d.el.classList.add("tdr-item--drag");
        d.el.style.position = "fixed";
        d.el.style.left = `${p.x - ox}px`;
        d.el.style.top = `${p.y - oy}px`;
        d.el.style.width = `${r.width}px`;
        d.el.style.height = `${r.height}px`;
        document.body.appendChild(d.el);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        d.el.style.left = `${p.x - ox}px`;
        d.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        d.el.classList.remove("tdr-item--drag");
        const box = this.boxes.find((b) => {
          const r = b.getBoundingClientRect();
          return (
            p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
          );
        });
        if (box && box.dataset.cat === d.item.catId) {
          // 放对
          placed = true;
          const itemsEl = box.querySelector(".tdr-box__items");
          if (itemsEl) {
            itemsEl.appendChild(d.el);
            d.el.style.position = "absolute";
            d.el.style.left = `${10 + Math.random() * 60}%`;
            d.el.style.top = `${30 + Math.random() * 30}%`;
            d.el.style.width = "";
            d.el.style.height = "";
            d.el.classList.add("tdr-item--in");
          }
          box.classList.add("tdr-box--happy");
          this.trackTimeout(() => box.classList.remove("tdr-box--happy"), 500);
          const r = box.getBoundingClientRect();
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
            }, 900);
          }
        } else {
          // 放错或没放箱：弹回房间原位
          d.room.appendChild(d.el);
          d.el.style.position = "absolute";
          d.el.style.left = `${15 + Math.random() * 70}%`;
          d.el.style.top = `${15 + Math.random() * 65}%`;
          d.el.style.width = "";
          d.el.style.height = "";
          if (box) {
            const paused = this.onWrong();
            if (paused) this.showRest();
          }
        }
      },
    });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧹",
      variant: "rest",
      body: "看看箱子上写的是什么（玩具/书/衣服…），把一样的东西放进去～",
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
    if (document.getElementById("tdr-style")) return;
    const st = document.createElement("style");
    st.id = "tdr-style";
    st.textContent = TDR_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function TDR_CSS(_theme: string): string {
  return `
.tdr-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(500px,100%);}
.tdr-task{font-size:1rem;font-weight:800;text-align:center;line-height:1.4;}
.tdr-room{position:relative;width:min(440px,92vw);height:min(240px,36vh);background:linear-gradient(180deg,#fff8e7 0%,#fff8e7 65%,#d7c4a3 65%);border-radius:18px;box-shadow:var(--shadow);touch-action:none;overflow:hidden;}
.tdr-item{position:absolute;font-size:2.2rem;line-height:1;cursor:grab;touch-action:none;transform:translate(-50%,-50%);filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.tdr-item--drag{cursor:grabbing;transform:translate(-50%,-50%) scale(1.3);z-index:100;}
.tdr-item--in{animation:tdr-drop .4s ease;}
.tdr-boxes{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:100%;}
.tdr-box{position:relative;width:84px;min-height:70px;background:linear-gradient(180deg,var(--tdr-color,#888),rgba(0,0,0,.1));border-radius:10px 10px 6px 6px;padding:4px;box-shadow:var(--shadow);transition:transform .2s;}
.tdr-box--happy{animation:tdr-bounce .5s ease;}
.tdr-box__label{background:rgba(255,255,255,.9);color:var(--tdr-color,#333);font-size:.7rem;font-weight:800;text-align:center;border-radius:4px;padding:2px;}
.tdr-box__items{position:relative;height:46px;}
.tdr-box__items .tdr-item{font-size:1.4rem;}
@keyframes tdr-bounce{0%{transform:scale(1)}40%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes tdr-drop{0%{transform:translate(-50%,-50%) scale(1.3)}60%{transform:translate(-50%,-50%) scale(.75)}100%{transform:translate(-50%,-50%) scale(1)}}
@media (max-width:380px){.tdr-box{width:70px;min-height:60px;}.tdr-item{font-size:1.8rem;}}
`;
}

export function create(): TidyRoomGame {
  return new TidyRoomGame();
}
