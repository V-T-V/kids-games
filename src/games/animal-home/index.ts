/* 动物的家 Animal Home —— 把动物拖到它们自己的家。
   鱼-水/鸟-树洞/兔-洞穴/狗-狗窝 …… 用 bindPointer 拖拽。
   独特点：动物+居所的常识认知 + 拖拽精细动作。
   巧思：放对后动物缩进家里冒出笑脸；放错弹回原位。
   难度=动物数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Pair {
  id: string;
  animal: string; // emoji
  home: string; // emoji
  homeName: string;
}

const PAIRS: Pair[] = [
  { id: "fish", animal: "🐟", home: "🌊", homeName: "水里" },
  { id: "bird", animal: "🐦", home: "🪺", homeName: "鸟巢" },
  { id: "rabbit", animal: "🐰", home: "🕳️", homeName: "洞穴" },
  { id: "dog", animal: "🐶", home: "🏠", homeName: "狗窝" },
  { id: "bee", animal: "🐝", home: "🍯", homeName: "蜂巢" },
  { id: "frog", animal: "🐸", home: "🌿", homeName: "池塘" },
  { id: "cow", animal: "🐄", home: "🏚️", homeName: "牛棚" },
  { id: "sheep", animal: "🐑", home: "🌾", homeName: "羊圈" },
  { id: "chicken", animal: "🐔", home: "🪺", homeName: "鸡窝" },
  { id: "spider", animal: "🕷️", home: "🕸️", homeName: "蛛网" },
  { id: "ant", animal: "🐜", home: "🕳️", homeName: "蚁穴" },
  { id: "squirrel", animal: "🐿️", home: "🌳", homeName: "树洞" },
  { id: "swallow", animal: "🐦‍⬛", home: "🏗️", homeName: "燕巢" },
  { id: "horse", animal: "🐴", home: "🎪", homeName: "马厩" },
  { id: "pig", animal: "🐷", home: "🛖", homeName: "猪圈" },
];

interface AnimalToken {
  pair: Pair;
  el: HTMLElement;
  placed: boolean;
}

export class AnimalHomeGame extends BaseGame {
  constructor() {
    super("animal-home");
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
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    const n = this.count();
    this.remaining = n;
    const picked = shuffle(PAIRS).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "ah-wrap";
    const task = document.createElement("div");
    task.className = "ah-task";
    task.innerHTML = `把小动物拖回它们自己的家（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "ah-board";
    // 上排：家
    const homes = document.createElement("div");
    homes.className = "ah-homes";
    const homeEls: HTMLDivElement[] = [];
    shuffle(picked).forEach((p) => {
      const h = document.createElement("div");
      h.className = "ah-home";
      h.dataset.id = p.id;
      h.innerHTML = `<span class="ah-home__icon">${p.home}</span><span class="ah-home__name">${p.homeName}</span>`;
      homes.appendChild(h);
      homeEls.push(h);
    });
    board.appendChild(homes);

    // 下排：动物（拖拽源）
    const tray = document.createElement("div");
    tray.className = "ah-tray";
    const animals: AnimalToken[] = [];
    shuffle(picked).forEach((p) => {
      const a = document.createElement("div");
      a.className = "ah-animal";
      a.textContent = p.animal;
      tray.appendChild(a);
      animals.push({ pair: p, el: a, placed: false });
    });
    board.appendChild(tray);
    wrap.appendChild(board);
    this.root.appendChild(wrap);

    animals.forEach((tok) => this.enableDrag(tok, homeEls));
  }

  private enableDrag(tok: AnimalToken, homes: HTMLDivElement[]): void {
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
        tok.el.classList.add("ah-animal--drag");
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
        tok.el.classList.remove("ah-animal--drag");
        const home = homes.find((h) => {
          const r = h.getBoundingClientRect();
          return (
            p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
          );
        });
        if (home && home.dataset.id === tok.pair.id) {
          // 放对
          tok.placed = true;
          tok.el.remove();
          home.classList.add("ah-home--happy");
          // 在家里显示动物
          const face = document.createElement("span");
          face.className = "ah-home__animal";
          face.textContent = tok.pair.animal;
          home.appendChild(face);
          const r = home.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.remaining -= 1;
          if (this.remaining <= 0) {
            this.roundsDone += 1;
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal) {
                this.finishClear(starsByAccuracy(this.wrongCount));
              } else {
                this.startRound();
              }
            }, 1000);
          }
        } else {
          // 放错或没放家：弹回
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
      emoji: "🌙",
      variant: "rest",
      body: "想想它住在哪里～",
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
    if (document.getElementById("ah-style")) return;
    const st = document.createElement("style");
    st.id = "ah-style";
    st.textContent = AH_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function AH_CSS(theme: string): string {
  return `
.ah-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.ah-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ah-board{display:flex;flex-direction:column;gap:24px;width:100%;align-items:center;}
.ah-homes{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.ah-home{
  width:92px;height:96px;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  background:color-mix(in srgb,${theme} 14%,#fff);border:3px solid ${theme};position:relative;transition:transform .2s;
}
.ah-home__icon{font-size:2.4rem;line-height:1;}
.ah-home__name{font-size:.75rem;font-weight:800;color:${theme};}
.ah-home--happy{background:${theme};animation:ah-bounce .4s ease;}
.ah-home--happy .ah-home__name{color:#fff;}
@keyframes ah-bounce{0%{transform:scale(1);}40%{transform:scale(1.18);}100%{transform:scale(1);}}
.ah-home__animal{position:absolute;font-size:1.8rem;animation:ah-in .4s ease;}
@keyframes ah-in{0%{transform:scale(.2);opacity:0;}60%{transform:scale(1.3);opacity:1;}100%{transform:scale(1);}}
.ah-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:14px 18px;background:rgba(255,255,255,.5);border-radius:18px;min-height:72px;width:100%;max-width:420px;}
.ah-animal{font-size:2.6rem;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));transition:transform .1s;}
.ah-animal--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
@media (max-width:380px){.ah-home{width:78px;height:84px;}.ah-animal{font-size:2.2rem;}}
`;
}

export function create(): AnimalHomeGame {
  return new AnimalHomeGame();
}
