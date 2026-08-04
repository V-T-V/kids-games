/* 爬树赛 Tree Climber —— 树干两侧交替出现手印，孩子按 左→右→左→右 顺序点击往上爬。
   独特点：交替节奏训练（左右手协调），点错顺序不动；每点对一步小猴往上爬一格。
   视觉：高树干 + 两侧手印（左🫲 右🫱），小猴 climbs up。难度=目标高度轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

export class TreeClimberGame extends BaseGame {
  constructor() {
    super("tree-climber");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private busy = false;
  /** 下一步该点哪一侧：0=左，1=右 */
  private nextSide = 0;
  /** 本关已爬步数 / 目标步数 */
  private climbed = 0;
  private stepTarget = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* trackTimeout 自动清理 */
  }

  private stepsPerRound(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    this.nextSide = 0;
    this.climbed = 0;
    this.stepTarget = this.stepsPerRound();
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "tc3-wrap";

    const task = document.createElement("div");
    task.className = "tc3-task";
    task.innerHTML =
      `按 <b>左 → 右 → 左 → 右</b> 点手印，帮小猴爬到顶！<br>` +
      `<span class="tc3-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 棵树</span>`;
    wrap.appendChild(task);

    const meter = document.createElement("div");
    meter.className = "tc3-meter";
    meter.innerHTML = `已爬 <b id="tc3-climbed">0</b> / ${this.stepTarget} 步`;
    wrap.appendChild(meter);

    const tree = document.createElement("div");
    tree.className = "tc3-tree";

    // 小猴（随 climbed 上移）
    const monkey = document.createElement("div");
    monkey.className = "tc3-monkey";
    monkey.id = "tc3-monkey";
    monkey.textContent = "🐵";
    monkey.style.setProperty("--step", "0");
    tree.appendChild(monkey);

    // 两侧手印按从下到上排，每步交替
    const hands = document.createElement("div");
    hands.className = "tc3-hands";
    hands.id = "tc3-hands";
    for (let i = 0; i < this.stepTarget; i++) {
      const side = i % 2; // 0 左，1 右 —— 保证交替
      const hand = document.createElement("button");
      hand.type = "button";
      hand.className = `tc3-hand tc3-hand--${side === 0 ? "left" : "right"}`;
      hand.dataset.index = String(i);
      hand.dataset.side = String(side);
      // 越往上位置越高
      hand.style.setProperty("--idx", String(this.stepTarget - 1 - i));
      hand.textContent = side === 0 ? "🫲" : "🫱";
      hand.addEventListener("click", () => this.tap(hand));
      hands.appendChild(hand);
    }
    tree.appendChild(hands);

    // 顶部终点旗帜
    const flag = document.createElement("div");
    flag.className = "tc3-flag";
    flag.textContent = "🏁";
    tree.appendChild(flag);

    wrap.appendChild(tree);
    this.root.appendChild(wrap);
    this.highlightNext();
  }

  /** 高亮下一个该点的手印。 */
  private highlightNext(): void {
    const hands = this.root.querySelectorAll<HTMLButtonElement>(".tc3-hand");
    hands.forEach((h) => h.classList.remove("tc3-hand--next"));
    const target = hands[this.climbed];
    if (target) target.classList.add("tc3-hand--next");
  }

  private tap(hand: HTMLButtonElement): void {
    if (this.busy) return;
    const side = Number(hand.dataset.side);
    const idx = Number(hand.dataset.index);
    if (idx !== this.climbed) {
      // 顺序错（点了不是当前这一步的）
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    if (side !== this.nextSide) {
      // 交替方向错（比如该点左却点右）—— 不动
      const paused = this.onWrong();
      hand.classList.add("tc3-hand--shake");
      this.trackTimeout(() => hand.classList.remove("tc3-hand--shake"), 400);
      if (paused) this.showRest();
      return;
    }
    // 答对
    this.busy = true;
    hand.classList.add("tc3-hand--done");
    hand.disabled = true;
    sfxPop();
    const r = hand.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.climbed += 1;
    this.nextSide = this.nextSide === 0 ? 1 : 0;
    const monkey = this.root.querySelector<HTMLElement>("#tc3-monkey");
    if (monkey) monkey.style.setProperty("--step", String(this.climbed));
    const cl = this.root.querySelector("#tc3-climbed");
    if (cl) cl.textContent = String(this.climbed);
    this.highlightNext();
    this.trackTimeout(() => {
      this.busy = false;
      if (this.climbed >= this.stepTarget) {
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
    }, 220);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看清楚下一个该点哪只手哦～",
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
    if (document.getElementById("tc3-style")) return;
    const st = document.createElement("style");
    st.id = "tc3-style";
    st.textContent = TC3_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function TC3_CSS(theme: string): string {
  return `
.tc3-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(420px,100%);}
.tc3-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;}
.tc3-sub{font-size:.85rem;font-weight:600;color:var(--ink-soft,#888);}
.tc3-meter{font-size:.95rem;font-weight:700;background:#fff;padding:6px 18px;border-radius:999px;box-shadow:var(--shadow);}
.tc3-tree{position:relative;width:100%;height:60vh;min-height:360px;background:linear-gradient(180deg,#e3f6e3,#fff);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
/* 树干 */
.tc3-tree::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:46px;transform:translateX(-50%);background:repeating-linear-gradient(180deg,#b08968,#b08968 14px,#a07a5a 14px,#a07a5a 28px);border-radius:8px;box-shadow:inset 0 0 0 3px rgba(0,0,0,.06);}
/* 小猴，根据 --step 上移 */
.tc3-monkey{position:absolute;left:50%;bottom:8px;font-size:2.2rem;transform:translate(-50%,calc(var(--step,0) * -42px));transition:transform .3s cubic-bezier(.4,1.6,.5,1);z-index:4;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.tc3-flag{position:absolute;left:50%;top:6px;transform:translateX(-50%);font-size:1.8rem;z-index:3;}
.tc3-hands{position:absolute;inset:0;}
/* 手印定位：用 --idx 控制垂直高度 */
.tc3-hand{position:absolute;left:50%;bottom:18px;border:none;background:transparent;font-size:2.2rem;cursor:pointer;transform:translate(calc(var(--off,0)),calc(var(--idx,0) * -42px)) scale(1);transition:transform .12s ease,filter .2s;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));z-index:5;line-height:1;}
.tc3-hand--left{margin-left:-78px;--off:-50%;}
.tc3-hand--right{margin-left:78px;--off:-50%;}
.tc3-hand--next{filter:drop-shadow(0 0 8px ${theme}) drop-shadow(0 2px 2px rgba(0,0,0,.2));animation:tc3-pulse 1s ease-in-out infinite;}
.tc3-hand:active{transform:translate(calc(var(--off,0)),calc(var(--idx,0) * -42px)) scale(.85);}
.tc3-hand--done{opacity:.25;pointer-events:none;filter:grayscale(.6);}
.tc3-hand--shake{animation:tc3-shake .4s;}
@keyframes tc3-pulse{0%,100%{filter:drop-shadow(0 0 6px ${theme}) drop-shadow(0 2px 2px rgba(0,0,0,.2));}50%{filter:drop-shadow(0 0 14px ${theme}) drop-shadow(0 2px 2px rgba(0,0,0,.2));}}
@keyframes tc3-shake{0%,100%{transform:translate(calc(var(--off,0)),calc(var(--idx,0) * -42px));}25%{transform:translate(calc(var(--off,0) - 8px),calc(var(--idx,0) * -42px));}75%{transform:translate(calc(var(--off,0) + 8px),calc(var(--idx,0) * -42px));}}
@media (max-width:380px){.tc3-monkey{font-size:1.9rem;}.tc3-hand{font-size:1.9rem;}.tc3-hand--left{margin-left:-66px;}.tc3-hand--right{margin-left:66px;}}
`;
}

export function create(): TreeClimberGame {
  return new TreeClimberGame();
}
