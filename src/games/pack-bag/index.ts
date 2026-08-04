/* 收书包 Pack Bag —— 课程表显示今天要上的课，孩子把<b>对应的书</b>拖进书包。
   独特点：课程匹配 + 拖拽收纳。视觉：课程表 + 书本 + 书包。
   巧思：课程表上每门课有一个对应颜色的书；只拖今天要上的课的书，干扰书不拖。
   难度=今天课程数。通关=完成目标轮数。前缀 pkbg-（避免与 pkb- 冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Subject {
  name: string;
  emoji: string;
  color: string;
}

const SUBJECTS: Subject[] = [
  { name: "语文", emoji: "📕", color: "#ff5252" },
  { name: "数学", emoji: "📘", color: "#4d96ff" },
  { name: "英语", emoji: "📗", color: "#6bcf7f" },
  { name: "美术", emoji: "📙", color: "#ff9f43" },
  { name: "音乐", emoji: "📓", color: "#a55eea" },
  { name: "科学", emoji: "📔", color: "#00d2d3" },
];

export class PackBagGame extends BaseGame {
  constructor() {
    super("pack-bag");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private today: Subject[] = [];
  private packedNames = new Set<string>();
  private bag!: HTMLDivElement;
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

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.packedNames.clear();
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    // 今天的课程
    this.today = shuffle(SUBJECTS).slice(0, n);
    this.remaining = n;
    // 书本池：今天的书 + 干扰书（保证书池比今天课程多）
    const distract = shuffle(
      SUBJECTS.filter((s) => !this.today.includes(s)),
    ).slice(0, Math.min(3, SUBJECTS.length - n));
    const books = shuffle([...this.today, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "pkbg-wrap";
    const task = document.createElement("div");
    task.className = "pkbg-task";
    task.innerHTML = `看<b>课程表</b>，把今天要上的书拖进书包～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 课程表
    const table = document.createElement("div");
    table.className = "pkbg-table";
    const tableTitle = document.createElement("div");
    tableTitle.className = "pkbg-table__title";
    tableTitle.textContent = "📋 今日课程表";
    table.appendChild(tableTitle);
    const tableItems = document.createElement("div");
    tableItems.className = "pkbg-table__items";
    this.today.forEach((s) => {
      const item = document.createElement("div");
      item.className = "pkbg-table__item";
      item.style.setProperty("--pkbg-color", s.color);
      item.innerHTML = `<span>${s.emoji}</span><span>${s.name}</span>`;
      item.dataset.name = s.name;
      tableItems.appendChild(item);
    });
    table.appendChild(tableItems);
    wrap.appendChild(table);

    // 主区：书本 + 书包
    const main = document.createElement("div");
    main.className = "pkbg-main";

    const shelf = document.createElement("div");
    shelf.className = "pkbg-shelf";
    books.forEach((s) => {
      const el = document.createElement("div");
      el.className = "pkbg-book";
      el.style.setProperty("--pkbg-color", s.color);
      el.innerHTML = `<div class="pkbg-book__emoji">${s.emoji}</div><div class="pkbg-book__name">${s.name}</div>`;
      shelf.appendChild(el);
      this.enableDrag({ subject: s, el, shelf });
    });
    main.appendChild(shelf);

    this.bag = document.createElement("div");
    this.bag.className = "pkbg-bag";
    this.bag.innerHTML = `<div class="pkbg-bag__emoji">🎒</div><div class="pkbg-bag__items"></div>`;
    main.appendChild(this.bag);

    wrap.appendChild(main);
    this.root.appendChild(wrap);
  }

  private enableDrag(item: {
    subject: Subject;
    el: HTMLDivElement;
    shelf: HTMLElement;
  }): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    let placed = false;
    const u = bindPointer(item.el, {
      down: (p) => {
        if (placed) return;
        dragging = true;
        const r = item.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        item.el.classList.add("pkbg-book--drag");
        item.el.style.position = "fixed";
        item.el.style.left = `${p.x - ox}px`;
        item.el.style.top = `${p.y - oy}px`;
        item.el.style.width = `${r.width}px`;
        item.el.style.height = `${r.height}px`;
        document.body.appendChild(item.el);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        item.el.style.left = `${p.x - ox}px`;
        item.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        item.el.classList.remove("pkbg-book--drag");
        const r = this.bag.getBoundingClientRect();
        const inBag =
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
        // 判断是否是今天课程
        const isToday = this.today.some((s) => s.name === item.subject.name);
        if (inBag && isToday && !this.packedNames.has(item.subject.name)) {
          // 装对
          placed = true;
          this.packedNames.add(item.subject.name);
          // 课程表项打勾
          const tableItem = this.root.querySelector(
            `.pkbg-table__item[data-name="${item.subject.name}"]`,
          );
          tableItem?.classList.add("pkbg-table__item--done");
          // 书进书包
          const itemsEl = this.bag.querySelector(".pkbg-bag__items");
          if (itemsEl) {
            itemsEl.appendChild(item.el);
            item.el.style.position = "";
            item.el.style.left = "";
            item.el.style.top = "";
            item.el.style.width = "";
            item.el.style.height = "";
            item.el.classList.add("pkbg-book--in");
          }
          const r2 = this.bag.getBoundingClientRect();
          this.onCorrect(r2.left + r2.width / 2, r2.top + r2.height / 2);
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
          // 弹回书架
          item.shelf.appendChild(item.el);
          item.el.style.position = "";
          item.el.style.left = "";
          item.el.style.top = "";
          item.el.style.width = "";
          item.el.style.height = "";
          if (inBag) {
            // 装进书包但不是今天的课，才算错
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
      emoji: "🎒",
      variant: "rest",
      body: "先看<b>课程表</b>上今天有哪些课，只把对应的<b>书</b>装进书包～",
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
    if (document.getElementById("pkbg-style")) return;
    const st = document.createElement("style");
    st.id = "pkbg-style";
    st.textContent = PKBG_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function PKBG_CSS(_theme: string): string {
  return `
.pkbg-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.pkbg-task{font-size:1rem;font-weight:800;text-align:center;line-height:1.4;}
.pkbg-table{width:100%;max-width:420px;background:#fff;border-radius:16px;box-shadow:var(--shadow);padding:12px 14px;}
.pkbg-table__title{font-size:.95rem;font-weight:800;color:var(--ink);margin-bottom:8px;text-align:center;}
.pkbg-table__items{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.pkbg-table__item{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:var(--pkbg-color,#888);color:#fff;font-size:.85rem;font-weight:700;}
.pkbg-table__item--done{opacity:.45;text-decoration:line-through;}
.pkbg-table__item--done::after{content:" ✓";}
.pkbg-main{display:flex;gap:18px;align-items:center;justify-content:center;width:100%;flex-wrap:wrap;}
.pkbg-shelf{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(139,90,43,.12);border-radius:14px;min-height:80px;flex:1;max-width:280px;}
.pkbg-book{width:54px;background:#fff;border-radius:8px 8px 4px 4px;padding:8px 4px 6px;display:flex;flex-direction:column;align-items:center;gap:3px;box-shadow:0 2px 4px rgba(0,0,0,.2);border-top:6px solid var(--pkbg-color,#888);cursor:grab;touch-action:none;}
.pkbg-book__emoji{font-size:1.6rem;line-height:1;}
.pkbg-book__name{font-size:.66rem;font-weight:700;color:var(--ink);}
.pkbg-book--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
.pkbg-book--in{animation:pkbg-drop .4s ease;}
.pkbg-bag{position:relative;width:100px;height:110px;display:flex;align-items:flex-end;justify-content:center;}
.pkbg-bag__emoji{font-size:4rem;line-height:1;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3));}
.pkbg-bag__items{position:absolute;bottom:18px;display:flex;gap:1px;}
@keyframes pkbg-drop{0%{transform:scale(1.3) translateY(-10px)}60%{transform:scale(.8)}100%{transform:scale(1)}}
@media (max-width:380px){.pkbg-book{width:46px;}.pkbg-bag{width:84px;height:96px;}.pkbg-bag__emoji{font-size:3.4rem;}}
`;
}

export function create(): PackBagGame {
  return new PackBagGame();
}
