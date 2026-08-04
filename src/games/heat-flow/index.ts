/* 热传导 Heat Flow —— 三种材质（金属🔧/木头🪵/塑料🥤）放进热水里，
   问「哪个先变烫？」导热速度：金属 > 塑料 > 木头。
   难度=材质数 + 概念：easy 选最烫的、medium 选最不烫的、hard 按从烫到凉排序。
   巧思：用温度计 🌡️ + 颜色渐变动画展示三种材质的「升温速度」差异；
         点「放进水里」后材质依次升温（金属最快变红），再作答。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Material {
  emoji: string;
  name: string;
  /** 导热速度排序：越大越快变烫。正确从烫到凉的顺序按此降序。 */
  speed: number;
}
// 物理事实：金属导热最快，塑料次之，木头最慢
const MATERIALS: Material[] = [
  { emoji: "🔧", name: "金属", speed: 3 },
  { emoji: "🥤", name: "塑料", speed: 2 },
  { emoji: "🪵", name: "木头", speed: 1 },
  { emoji: "🥄", name: "银勺", speed: 3 },
  { emoji: "🧱", name: "砖头", speed: 1 },
  { emoji: "🪙", name: "硬币", speed: 3 },
];

export class HeatFlowGame extends BaseGame {
  constructor() {
    super("heat-flow");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private heated = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.answered = false;
    this.heated = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const picks = shuffle(MATERIALS).slice(0, 3);
    // 排序模式（hard）：从烫到凉
    const sortByHotDesc = (a: Material, b: Material): number => b.speed - a.speed;

    // 题目类型
    // easy: 选最烫的；medium: 选最不烫的；hard: 按从烫到凉排序
    const mode: "hottest" | "coolest" | "sort" =
      this.difficulty === "easy"
        ? "hottest"
        : this.difficulty === "medium"
          ? sample<"hottest" | "coolest">(["hottest", "coolest"])
          : "sort";

    const wrap = document.createElement("div");
    wrap.className = "hf-wrap";

    const task = document.createElement("div");
    task.className = "hf-task";
    const prompt =
      mode === "hottest"
        ? "哪个先变得 <b>最烫</b>？"
        : mode === "coolest"
          ? "哪个变得 <b>最不烫</b>？"
          : "按从 <b>烫→凉</b> 的顺序排好！";
    task.innerHTML = `把东西放进热水里，${prompt}<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    // 热水槽舞台
    const stage = document.createElement("div");
    stage.className = "hf-stage";
    stage.innerHTML = `<div class="hf-pot"><div class="hf-water"></div><div class="hf-steam"><span>💨</span><span>💨</span></div></div>`;
    wrap.appendChild(stage);

    const dropBtn = document.createElement("button");
    dropBtn.type = "button";
    dropBtn.className = "hf-drop";
    dropBtn.textContent = "🫳 放进热水";
    wrap.appendChild(dropBtn);

    // 材质卡
    const board = document.createElement("div");
    board.className = "hf-board";
    const shown = shuffle(picks);

    if (mode === "sort") {
      this.buildSortBoard(board, shown, sortByHotDesc);
    } else {
      shown.forEach((m) => {
        const btn = this.makePickCard(m, mode);
        board.appendChild(btn);
      });
    }
    wrap.appendChild(board);
    this.root.appendChild(wrap);

    // 放进热水动画
    dropBtn.addEventListener("click", () => {
      if (this.heated) return;
      this.heated = true;
      this.resetWrongStreak();
      sfxPop();
      stage.classList.add("hf-stage--hot");
      // 每张卡片按导热速度依次升温
      const cards = [...board.querySelectorAll<HTMLElement>(".hf-mat")];
      cards.forEach((c) => {
        const speed = Number(c.dataset.speed);
        // speed 越大升温越快（延迟越短）
        const delay = (4 - speed) * 350;
        this.trackTimeout(() => c.classList.add("hf-mat--hot"), delay);
      });
      // 1.6s 后允许作答（升温完成）
      this.trackTimeout(() => {
        board.classList.add("hf-board--ready");
        dropBtn.classList.add("hf-drop--done");
      }, 1700);
    });
  }

  /** 单选题卡片（hottest/coolest）。正确判定：speed 最大/最小。 */
  private makePickCard(m: Material, mode: "hottest" | "coolest"): HTMLElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hf-mat";
    btn.dataset.speed = String(m.speed);
    btn.innerHTML = `
      <div class="hf-mat__emoji">${m.emoji}</div>
      <div class="hf-mat__name">${m.name}</div>
      <div class="hf-mat__thermo">🌡️</div>`;
    btn.addEventListener("click", () => {
      if (!this.heated || this.answered) return;
      const all = Array.from(
        this.root.querySelectorAll<HTMLElement>(".hf-mat"),
      ).map((c) => Number(c.dataset.speed));
      const target = mode === "hottest" ? Math.max(...all) : Math.min(...all);
      this.judgePick(btn, m.speed === target);
    });
    return btn;
  }

  private judgePick(btn: HTMLElement, correct: boolean): void {
    if (this.answered) return;
    if (correct) {
      this.answered = true;
      sfxPop();
      btn.classList.add("hf-mat--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1200);
    } else {
      btn.classList.add("hf-mat--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("hf-mat--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  /** 排序题：点卡片按顺序点亮。 */
  private buildSortBoard(
    board: HTMLElement,
    shown: Material[],
    sortByHotDesc: (a: Material, b: Material) => number,
  ): void {
    const correctOrder = [...shown].sort(sortByHotDesc);
    let step = 0;
    shown.forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hf-mat";
      btn.dataset.speed = String(m.speed);
      btn.dataset.name = m.name;
      btn.innerHTML = `
        <div class="hf-mat__emoji">${m.emoji}</div>
        <div class="hf-mat__name">${m.name}</div>
        <div class="hf-mat__thermo">🌡️</div>`;
      btn.addEventListener("click", () => {
        if (!this.heated || this.answered) return;
        const expect = correctOrder[step];
        if (expect && expect.name === m.name) {
          sfxPop();
          btn.classList.add("hf-mat--pick");
          this.resetWrongStreak();
          step++;
          if (step >= correctOrder.length) {
            this.answered = true;
            const r = board.getBoundingClientRect();
            this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
            this.roundsDone += 1;
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal)
                this.finishClear(starsByAccuracy(this.wrongCount));
              else this.startRound();
            }, 1200);
          }
        } else {
          btn.classList.add("hf-mat--wrong");
          const paused = this.onWrong();
          this.trackTimeout(() => btn.classList.remove("hf-mat--wrong"), 400);
          if (paused) this.showRest();
        }
      });
      board.appendChild(btn);
    });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🔥",
      variant: "rest",
      body: "金属摸起来最烫哦～",
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
    if (document.getElementById("hf-style")) return;
    const st = document.createElement("style");
    st.id = "hf-style";
    st.textContent = HF_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function HF_CSS(theme: string): string {
  return `
.hf-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.hf-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);}
.hf-task b{color:${theme};}
.hf-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.hf-stage{width:220px;height:90px;position:relative;display:flex;align-items:flex-end;justify-content:center;}
.hf-pot{width:180px;height:80px;border-radius:0 0 30px 30px;border:4px solid #888;background:#cfd6e6;position:relative;overflow:hidden;}
.hf-water{position:absolute;left:0;right:0;bottom:0;height:48px;background:linear-gradient(180deg,#7fd0ff,#4d96ff);transition:all .6s;}
.hf-stage--hot .hf-water{background:linear-gradient(180deg,#ffd0a0,#ff7a4d);height:60px;animation:hf-bubble 1s ease-in-out infinite;}
@keyframes hf-bubble{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.hf-steam{position:absolute;top:-26px;left:0;right:0;display:flex;justify-content:center;gap:30px;font-size:1.6rem;opacity:0;transition:opacity .5s;}
.hf-stage--hot .hf-steam{opacity:.9;animation:hf-rise 2s ease-in-out infinite;}
.hf-steam span:nth-child(2){animation-delay:.6s;}
@keyframes hf-rise{0%{transform:translateY(6px);opacity:0}50%{opacity:.9}100%{transform:translateY(-10px);opacity:0}}
.hf-drop{font-size:1.1rem;font-weight:800;padding:12px 24px;border-radius:18px;border:none;background:${theme};color:#fff;box-shadow:var(--shadow);cursor:pointer;}
.hf-drop:active{transform:scale(.95);}
.hf-drop--done{opacity:.4;pointer-events:none;}
.hf-board{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}
.hf-mat{width:108px;background:#fff;border-radius:18px;border:3px solid #eee;box-shadow:var(--shadow);padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;position:relative;}
.hf-mat__emoji{font-size:2.6rem;transition:filter .4s;}
.hf-mat__name{font-size:.95rem;font-weight:800;}
.hf-mat__thermo{font-size:1.2rem;filter:grayscale(1);transition:all .4s;}
/* 升温：温度计变红、emoji 泛红光 */
.hf-mat--hot .hf-mat__thermo{filter:none;animation:hf-hot .8s ease-in-out infinite;}
.hf-mat--hot .hf-mat__emoji{filter:drop-shadow(0 0 8px #ff5b5b);}
@keyframes hf-hot{0%,100%{transform:scale(1)}50%{transform:scale(1.25) rotate(-8deg)}}
.hf-board--ready .hf-mat{border-color:${theme};}
.hf-mat--done{background:#d4f4dd;animation:hf-pop .4s ease;}
.hf-mat--pick{background:#fff3c0;animation:hf-pop .4s ease;}
.hf-mat--wrong{animation:hf-shake .4s ease;}
@keyframes hf-pop{0%{transform:scale(.6)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes hf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): HeatFlowGame {
  return new HeatFlowGame();
}
