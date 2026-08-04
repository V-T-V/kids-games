/* 图书馆 Library —— 几本书封面标了类别（故事/科普/漫画/儿歌），
   书架分几层，每层标类别，孩子把书拖到对应层归架。
   独特点：分类概念 + 书本立式视觉，归架时书"立"到架上。
   视觉：书脊色块 + 书架。难度=书数。通关=归架目标轮数。
   用 bindPointer 实现拖拽。巧思：每轮每类至少 1 本书（可解）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Cat {
  name: string;
  color: string;
  icon: string;
}

const CATS: Cat[] = [
  { name: "故事", color: "#ef5350", icon: "📖" },
  { name: "科普", color: "#42a5f5", icon: "🔬" },
  { name: "漫画", color: "#ffca28", icon: "💬" },
  { name: "儿歌", color: "#66bb6a", icon: "🎵" },
];

interface Book {
  cat: Cat;
  el: HTMLElement;
  placed: boolean;
}

const ENCOURAGE = [
  "归架正确！",
  "小小图书管理员！",
  "书回家啦！",
  "再放一本～",
];

export class LibraryGame extends BaseGame {
  constructor() {
    super("library");
  }

  private unbinds: (() => void)[] = [];
  private shelves: Record<string, HTMLElement> = {};
  private books: Book[] = [];
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

  /** 书架层数（类别数） */
  private catCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 4;
  }
  /** 书本总数 */
  private bookCount(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 7
        : 9;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.books = [];
    this.shelves = {};
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const catN = this.catCount();
    const cats = shuffle([...CATS]).slice(0, catN);
    const total = this.bookCount();

    // 先给每类配 1 本（保证可解），再随机补足
    const plan: Cat[] = cats.map((c) => c);
    for (let i = cats.length; i < total; i++) {
      plan.push(sample(cats));
    }
    const bookList = shuffle(plan);

    const wrap = document.createElement("div");
    wrap.className = "lb2-wrap";

    const task = document.createElement("div");
    task.className = "lb2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把书拖到对应类别的书架层 📚`;
    wrap.appendChild(task);

    // 书架
    const shelf = document.createElement("div");
    shelf.className = "lb2-shelf";
    cats.forEach((c) => {
      const row = document.createElement("div");
      row.className = "lb2-row";
      row.dataset.cat = c.name;
      row.style.setProperty("--lb2-c", c.color);
      row.innerHTML = `<div class="lb2-row__label">${c.icon} ${c.name}</div><div class="lb2-row__rack" id="lb2-rack-${c.name}"></div>`;
      shelf.appendChild(row);
      this.shelves[c.name] = row;
    });
    wrap.appendChild(shelf);

    // 书本托盘
    const tray = document.createElement("div");
    tray.className = "lb2-tray";
    bookList.forEach((cat) => {
      const el = document.createElement("div");
      el.className = "lb2-book";
      el.style.setProperty("--lb2-c", cat.color);
      el.dataset.cat = cat.name;
      el.innerHTML = `<span class="lb2-book__spine">${cat.icon}</span>`;
      tray.appendChild(el);
      const bk: Book = { cat, el, placed: false };
      this.books.push(bk);
      this.enableDrag(bk);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
    this.remaining = this.books.length;
  }

  private enableDrag(bk: Book): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (bk.placed || this.locked) return;
      dragging = true;
      const r = bk.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = bk.el.parentElement;
      bk.el.classList.add("lb2-book--drag");
      bk.el.style.position = "fixed";
      bk.el.style.left = `${p.x - offX}px`;
      bk.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(bk.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      bk.el.style.left = `${p.x - offX}px`;
      bk.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      bk.el.classList.remove("lb2-book--drag");
      let hit: string | null = null;
      for (const name of Object.keys(this.shelves)) {
        const row = this.shelves[name]!;
        const r = row.getBoundingClientRect();
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
      if (hit === bk.cat.name) {
        bk.placed = true;
        bk.el.style.position = "";
        bk.el.style.left = "";
        bk.el.style.top = "";
        bk.el.classList.add("lb2-book--in");
        const rack = this.root.querySelector(`#lb2-rack-${hit}`);
        if (rack) rack.appendChild(bk.el);
        this.remaining -= 1;
        const r = this.shelves[hit]!.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
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
        bk.el.style.position = "";
        bk.el.style.left = "";
        bk.el.style.top = "";
        origin?.appendChild(bk.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(bk.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "📚",
      variant: "rest",
      body: `看看封面是什么类别，找对应的书架层哦～ ${sample(ENCOURAGE)}`,
      primary: { text: "继续", icon: "📖", onClick: () => ov.destroy() },
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
    if (document.getElementById("lb2-style")) return;
    const st = document.createElement("style");
    st.id = "lb2-style";
    st.textContent = LB2_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function LB2_CSS(theme: string): string {
  return `
.lb2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(540px,100%);}
.lb2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.lb2-shelf{display:flex;flex-direction:column;gap:10px;width:100%;max-width:460px;padding:14px;background:linear-gradient(180deg,#a1887f,#8d6e63);border-radius:20px;box-shadow:var(--shadow);}
.lb2-row{position:relative;background:#fff;border-radius:10px;box-shadow:inset 0 0 0 3px var(--lb2-c,#42a5f5),0 2px 4px rgba(0,0,0,.15);}
.lb2-row__label{position:absolute;top:-10px;left:12px;background:var(--lb2-c,#42a5f5);color:#fff;font-size:.8rem;font-weight:900;padding:2px 12px;border-radius:999px;z-index:2;text-shadow:0 1px 2px rgba(0,0,0,.25);}
.lb2-row__rack{display:flex;gap:4px;align-items:flex-end;min-height:64px;padding:14px 10px 8px;}
.lb2-tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:16px;background:rgba(255,255,255,.65);border-radius:22px;box-shadow:var(--shadow);max-width:460px;min-height:72px;}
.lb2-book{width:38px;height:60px;border-radius:4px 8px 8px 4px;background:linear-gradient(90deg,rgba(0,0,0,.2) 0 6px,var(--lb2-c,#42a5f5) 6px);box-shadow:0 2px 4px rgba(0,0,0,.2),inset 0 0 0 2px rgba(255,255,255,.25);cursor:grab;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center;transition:transform .12s;}
.lb2-book:active{transform:scale(1.1);}
.lb2-book--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
.lb2-book__spine{font-size:1.1rem;filter:drop-shadow(0 1px 1px rgba(0,0,0,.3));}
.lb2-book--in{animation:lb2-place .4s ease;cursor:default;}
@keyframes lb2-place{0%{transform:translateY(-12px) scale(1.1)}60%{transform:translateY(2px) scale(.95)}100%{transform:translateY(0) scale(1)}}
@media (max-width:380px){.lb2-book{width:32px;height:52px;}.lb2-book__spine{font-size:.95rem;}.lb2-task{font-size:.95rem;}}
.lb2-theme{color:${theme};}
`;
}

export function create(): LibraryGame {
  return new LibraryGame();
}
