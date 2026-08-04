/* 土壤层次 Soil Layers —— 地下有不同的土层，孩子按从上到下的顺序排列。
   难度=层数 + 干扰层：easy 3 层、medium 4 层、hard 5 层。
   增加趣味问题：化石🦴在哪个层、蚯蚓🪱住哪层等。
   巧思：用彩色横条展示地层剖面，每层有专属颜色与 emoji；
         答对一层则该层「填入」剖面坑位（从上到下逐层点亮）。
         培养地球科学认知：地表→表土→沙→黏土→岩石的层序。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Layer {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** 从上到下的正确顺序索引（0=最上） */
  order: number;
}
// 地层从上到下（真实层序：表土→沙→黏土→岩石→更深）
const ALL_LAYERS: Layer[] = [
  { id: "topsoil", name: "表土", emoji: "🌱", color: "#6b4b2a", order: 0 },
  { id: "sand", name: "沙子", emoji: "🟡", color: "#e8c87a", order: 1 },
  { id: "clay", name: "黏土", emoji: "🟤", color: "#b5651d", order: 2 },
  { id: "rock", name: "岩石", emoji: "🪨", color: "#7d7d8c", order: 3 },
  { id: "deep", name: "深岩", emoji: "⛏️", color: "#4a4a55", order: 4 },
];

// 趣味问答（附加轮）
interface Trivia {
  q: string;
  /** 正确层的 id */
  answer: string;
}
const TRIVIA: Trivia[] = [
  { q: "蚯蚓 🪱 住在哪一层？", answer: "topsoil" },
  { q: "小草 🌱 的根扎在哪一层？", answer: "topsoil" },
  { q: "恐龙化石 🦴 埋在哪一层？", answer: "rock" },
  { q: "挖沙子建城堡 🏰 用哪一层？", answer: "sand" },
  { q: "捏泥人的泥 🏺 是哪一层？", answer: "clay" },
];

export class SoilLayersGame extends BaseGame {
  constructor() {
    super("soil-layers");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 排序题用的层数（easy 3 / medium 4 / hard 5）。 */
  private layerCount(): number {
    return this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 每 3 关插入 1 个趣味问答（保证排序题占多数）
    const isTrivia =
      this.roundsDone > 0 && this.roundsDone % 3 === 2 && this.difficulty !== "easy"
        ? Math.random() < 0.5
        : false;

    if (isTrivia) {
      this.buildTrivia();
    } else {
      this.buildSort();
    }
  }

  /** 排序题：从上到下点亮地层。 */
  private buildSort(): void {
    const count = this.layerCount();
    const layers = [...ALL_LAYERS]
      .sort((a, b) => a.order - b.order)
      .slice(0, count);
    const shuffled = shuffle(layers);
    let next = 0; // 下一个应填的 order

    const wrap = document.createElement("div");
    wrap.className = "sol-wrap";

    const task = document.createElement("div");
    task.className = "sol-task";
    task.innerHTML = `按 <b>从上到下</b> 的顺序，把土层点进坑里！<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    // 地层剖面（坑位从上到下排列）
    const section = document.createElement("div");
    section.className = "sol-section";
    section.id = "sol-section";
    layers.forEach((l, i) => {
      const slot = document.createElement("div");
      slot.className = "sol-slot";
      slot.id = `sol-slot-${i}`;
      slot.style.background = `${l.color}22`;
      slot.dataset.order = String(i);
      section.appendChild(slot);
    });
    wrap.appendChild(section);

    // 可点卡片（打乱）
    const pool = document.createElement("div");
    pool.className = "sol-pool";
    shuffled.forEach((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sol-card";
      b.dataset.order = String(l.order);
      b.style.setProperty("--card-color", l.color);
      b.innerHTML = `<span class="sol-card__emoji">${l.emoji}</span><span class="sol-card__name">${l.name}</span>`;
      b.addEventListener("click", () => {
        if (this.answered) return;
        if (Number(b.dataset.order) === next) {
          sfxPop();
          b.classList.add("sol-card--used");
          this.fillSlot(next, l);
          this.resetWrongStreak();
          next++;
          if (next >= layers.length) {
            this.answered = true;
            this.roundsDone += 1;
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal)
                this.finishClear(starsByAccuracy(this.wrongCount));
              else this.startRound();
            }, 1300);
          }
        } else {
          b.classList.add("sol-card--wrong");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("sol-card--wrong"), 400);
          if (paused) this.showRest();
        }
      });
      pool.appendChild(b);
    });
    wrap.appendChild(pool);
    this.root.appendChild(wrap);
  }

  /** 填入剖面坑位。 */
  private fillSlot(orderIdx: number, l: Layer): void {
    const slot = this.root.querySelector<HTMLElement>(`#sol-slot-${orderIdx}`);
    if (!slot) return;
    slot.classList.add("sol-slot--filled");
    slot.style.background = l.color;
    slot.innerHTML = `<span class="sol-slot__emoji">${l.emoji}</span><span class="sol-slot__name">${l.name}</span>`;
    const r = slot.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
  }

  /** 趣味问答题：从可选层里选答案。 */
  private buildTrivia(): void {
    const t = sample(TRIVIA);
    const count = this.layerCount();
    const layers = [...ALL_LAYERS]
      .sort((a, b) => a.order - b.order)
      .slice(0, count);
    // 确保答案在选项里
    const has = layers.some((l) => l.id === t.answer);
    let opts = layers;
    if (!has) {
      const ans = ALL_LAYERS.find((l) => l.id === t.answer)!;
      opts = [ans, ...layers.slice(0, count - 1)];
    }
    const shown = shuffle(opts);

    const wrap = document.createElement("div");
    wrap.className = "sol-wrap";
    const task = document.createElement("div");
    task.className = "sol-task";
    task.innerHTML = `${t.q}<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "sol-pool";
    shown.forEach((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sol-card";
      b.style.setProperty("--card-color", l.color);
      b.innerHTML = `<span class="sol-card__emoji">${l.emoji}</span><span class="sol-card__name">${l.name}</span>`;
      b.addEventListener("click", () => {
        if (this.answered) return;
        if (l.id === t.answer) {
          this.answered = true;
          sfxPop();
          b.classList.add("sol-card--done");
          const r = b.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 1300);
        } else {
          b.classList.add("sol-card--wrong");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("sol-card--wrong"), 400);
          if (paused) this.showRest();
        }
      });
      board.appendChild(b);
    });
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌱",
      variant: "rest",
      body: "最上面那层是表土哦～",
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
    if (document.getElementById("sol-style")) return;
    const st = document.createElement("style");
    st.id = "sol-style";
    st.textContent = SOL_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function SOL_CSS(theme: string): string {
  return `
.sol-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.sol-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);}
.sol-task b{color:${theme};}
.sol-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.sol-section{display:flex;flex-direction:column;width:240px;border-radius:18px;overflow:hidden;box-shadow:var(--shadow-lg);border:3px solid #8a7a5a;background:linear-gradient(180deg,#9acd7a 0,#9acd7a 14px,transparent 14px);}
.sol-slot{height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border-bottom:1px solid rgba(0,0,0,.1);transition:all .3s;}
.sol-slot:last-child{border-bottom:none;}
.sol-slot--filled{animation:sol-drop .35s ease;}
@keyframes sol-drop{0%{transform:scaleX(.6);opacity:.4}100%{transform:scaleX(1);opacity:1}}
.sol-slot__emoji{font-size:1.4rem;}
.sol-slot__name{font-size:.9rem;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);}
.sol-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.sol-card{min-width:78px;min-height:72px;border-radius:16px;border:none;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;position:relative;overflow:hidden;}
.sol-card::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,var(--card-color,#ccc)33,transparent 60%);}
.sol-card:active{transform:scale(.94);}
.sol-card__emoji{font-size:1.7rem;position:relative;}
.sol-card__name{font-size:.85rem;font-weight:800;color:var(--ink);position:relative;}
.sol-card--used{opacity:.32;transform:scale(.85);pointer-events:none;filter:grayscale(.4);}
.sol-card--done{background:#d4f4dd;animation:sol-pop .4s ease;}
.sol-card--wrong{animation:sol-shake .4s ease;}
@keyframes sol-pop{0%{transform:scale(.6)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes sol-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SoilLayersGame {
  return new SoilLayersGame();
}
