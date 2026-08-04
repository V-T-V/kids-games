/* 动物园长 Zoo Keeper —— 把动物拖到对应类别的笼子（水里游/地上跑/天上飞）。
   独特点：拖拽分类，训练类别归属概念（区别于 word-classify 的文字分类）。
   视觉：动物 emoji + 分类笼子。难度=动物数。通关=归笼目标轮数。
   用 bindPointer 拖拽。巧思：每轮动物类别分布保证可解，笼子数固定 3 类。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

type Category = "water" | "land" | "sky";

interface Animal {
  emoji: string;
  cat: Category;
  el: HTMLElement;
  placed: boolean;
}

const CAT_META: Record<
  Category,
  { name: string; icon: string; color: string }
> = {
  water: { name: "水里游的", icon: "🌊", color: "#4d96ff" },
  land: { name: "地上跑的", icon: "🌳", color: "#6bcf7f" },
  sky: { name: "天上飞的", icon: "☁️", color: "#a55eea" },
};

const POOL: Record<Category, string[]> = {
  water: ["🐟", "🐬", "🐙", "🦈", "🐠", "🐳"],
  land: ["🐘", "🦁", "🐶", "🐰", "🐮", "🐎"],
  sky: ["🐦", "🦅", "🦋", "🕊️", "🦉", "🐝"],
};

const ENCOURAGE = [
  "归笼正确！",
  "你真是个好园长！",
  "动物回家啦！",
  "看看它住哪里哦～",
];

export class ZooKeeperGame extends BaseGame {
  constructor() {
    super("zoo-keeper");
  }

  private unbinds: (() => void)[] = [];
  private cages: Record<Category, HTMLElement> = {
    water: null as unknown as HTMLElement,
    land: null as unknown as HTMLElement,
    sky: null as unknown as HTMLElement,
  };
  private animals: Animal[] = [];
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

  private count(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 7;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.animals = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    this.remaining = n;

    // 生成动物：保证每类至少 1 只（可解），其余随机
    const cats: Category[] = shuffle<Category>(["water", "land", "sky"]);
    const list: { emoji: string; cat: Category }[] = [];
    cats.forEach((c) => list.push({ emoji: sample(POOL[c]), cat: c }));
    for (let i = 3; i < n; i++) {
      const c = sample(cats);
      list.push({ emoji: sample(POOL[c]), cat: c });
    }
    const animals = shuffle(list);

    const wrap = document.createElement("div");
    wrap.className = "zk-wrap";

    const task = document.createElement("div");
    task.className = "zk-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把动物拖回它住的笼子 🏠`;
    wrap.appendChild(task);

    // 笼子（3 类）
    const cageRow = document.createElement("div");
    cageRow.className = "zk-cages";
    (["water", "land", "sky"] as Category[]).forEach((c) => {
      const m = CAT_META[c];
      const cage = document.createElement("div");
      cage.className = "zk-cage";
      cage.dataset.cat = c;
      cage.style.setProperty("--zk-color", m.color);
      cage.innerHTML = `<div class="zk-cage-head">${m.icon} ${m.name}</div><div class="zk-cage-body" id="zk-body-${c}"></div>`;
      cageRow.appendChild(cage);
      this.cages[c] = cage;
    });
    wrap.appendChild(cageRow);

    // 动物托盘
    const tray = document.createElement("div");
    tray.className = "zk-tray";
    tray.id = "zk-tray";
    animals.forEach((a, i) => {
      const el = document.createElement("div");
      el.className = "zk-animal";
      el.textContent = a.emoji;
      el.dataset.cat = a.cat;
      el.dataset.i = String(i);
      tray.appendChild(el);
      const an: Animal = { emoji: a.emoji, cat: a.cat, el, placed: false };
      this.animals.push(an);
      this.enableDrag(an);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(an: Animal): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (an.placed || this.locked) return;
      dragging = true;
      const r = an.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = an.el.parentElement;
      an.el.classList.add("zk-animal--drag");
      an.el.style.position = "fixed";
      an.el.style.left = `${p.x - offX}px`;
      an.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(an.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      an.el.style.left = `${p.x - offX}px`;
      an.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      an.el.classList.remove("zk-animal--drag");
      // 命中检测：指针是否落在某笼子内
      let hit: Category | null = null;
      for (const c of ["water", "land", "sky"] as Category[]) {
        const r = this.cages[c].getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hit = c;
          break;
        }
      }
      if (hit === an.cat) {
        an.placed = true;
        an.el.style.position = "";
        an.el.style.left = "";
        an.el.style.top = "";
        an.el.classList.add("zk-animal--in");
        const body = this.root.querySelector(`#zk-body-${hit}`);
        if (body) body.appendChild(an.el);
        this.remaining -= 1;
        const r = this.cages[hit].getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
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
        // 归位
        an.el.style.position = "";
        an.el.style.left = "";
        an.el.style.top = "";
        origin?.appendChild(an.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(an.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🦁",
      variant: "rest",
      body: `想想它平时住在哪儿：水里、陆地还是天上？ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("zk-style")) return;
    const st = document.createElement("style");
    st.id = "zk-style";
    st.textContent = ZK_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function ZK_CSS(_theme: string): string {
  return `
.zk-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.zk-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.zk-cages{display:flex;gap:12px;justify-content:center;width:100%;}
.zk-cage{flex:1;min-width:96px;background:linear-gradient(180deg,rgba(255,255,255,.7),var(--zk-color,#6bcf7f)22);border:3px solid var(--zk-color,#6bcf7f);border-radius:20px;padding:8px;box-shadow:var(--shadow);}
.zk-cage-head{font-size:.85rem;font-weight:900;color:var(--zk-color,#6bcf7f);text-align:center;margin-bottom:6px;background:#fff;border-radius:999px;padding:3px 4px;}
.zk-cage-body{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;min-height:120px;align-content:flex-start;padding:6px;border-radius:12px;background:rgba(255,255,255,.35);}
.zk-tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:480px;min-height:72px;}
.zk-animal{font-size:2.4rem;cursor:grab;touch-action:none;user-select:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.2));transition:transform .12s;}
.zk-animal:active{transform:scale(1.1);}
.zk-animal--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
.zk-animal--in{animation:zk-pop .4s ease;cursor:default;}
@keyframes zk-pop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@media (max-width:380px){.zk-animal{font-size:2rem;}.zk-cage{min-width:84px;}.zk-cage-head{font-size:.75rem;}}
`;
}

export function create(): ZooKeeperGame {
  return new ZooKeeperGame();
}
