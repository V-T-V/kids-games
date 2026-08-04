/* 考拉爬树 Koala Climb —— 树干两侧交替出现手印/脚印，
   孩子按 左→右→左→右 顺序点击，帮考拉往上爬。
   独特点：考拉慢悠悠的形象 + 交替节奏训练（左右协调），点错不动。
   难度=目标高度（步数）。通关=爬到目标轮数。
   视觉：桉树树干 + 考拉 + 两侧手脚印（🫱🫲）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

export class KoalaClimbGame extends BaseGame {
  constructor() {
    super("koala-climb");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private busy = false;
  /** 下一步该点哪一侧：0=左，1=右 */
  private nextSide = 0;
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
    wrap.className = "kc-wrap";

    const task = document.createElement("div");
    task.className = "kc-task";
    task.innerHTML =
      `按 <b>左 → 右 → 左 → 右</b> 点手脚印，帮考拉爬到顶！<br>` +
      `<span class="kc-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 棵树</span>`;
    wrap.appendChild(task);

    const meter = document.createElement("div");
    meter.className = "kc-meter";
    meter.innerHTML = `已爬 <b id="kc-climbed">0</b> / ${this.stepTarget} 步`;
    wrap.appendChild(meter);

    const tree = document.createElement("div");
    tree.className = "kc-tree";

    const koala = document.createElement("div");
    koala.className = "kc-koala";
    koala.id = "kc-koala";
    koala.textContent = "🐨";
    koala.style.setProperty("--step", "0");
    tree.appendChild(koala);

    const hands = document.createElement("div");
    hands.className = "kc-hands";
    hands.id = "kc-hands";
    for (let i = 0; i < this.stepTarget; i++) {
      const side = i % 2; // 0 左，1 右 —— 严格交替
      const hand = document.createElement("button");
      hand.type = "button";
      hand.className = `kc-hand kc-hand--${side === 0 ? "left" : "right"}`;
      hand.dataset.index = String(i);
      hand.dataset.side = String(side);
      hand.style.setProperty("--idx", String(this.stepTarget - 1 - i));
      hand.textContent = side === 0 ? "🫲" : "🫱";
      hand.addEventListener("click", () => this.tap(hand));
      hands.appendChild(hand);
    }
    tree.appendChild(hands);

    const flag = document.createElement("div");
    flag.className = "kc-flag";
    flag.textContent = "🌿";
    tree.appendChild(flag);

    wrap.appendChild(tree);
    this.root.appendChild(wrap);
    this.highlightNext();
  }

  private highlightNext(): void {
    const hands = this.root.querySelectorAll<HTMLButtonElement>(".kc-hand");
    hands.forEach((h) => h.classList.remove("kc-hand--next"));
    const target = hands[this.climbed];
    if (target) target.classList.add("kc-hand--next");
  }

  private tap(hand: HTMLButtonElement): void {
    if (this.busy) return;
    const side = Number(hand.dataset.side);
    const idx = Number(hand.dataset.index);
    if (idx !== this.climbed) {
      // 点了不是当前这一步
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    if (side !== this.nextSide) {
      // 交替方向错（该点左却点右）—— 不动
      const paused = this.onWrong();
      hand.classList.add("kc-hand--shake");
      this.trackTimeout(() => hand.classList.remove("kc-hand--shake"), 400);
      if (paused) this.showRest();
      return;
    }
    // 答对
    this.busy = true;
    hand.classList.add("kc-hand--done");
    hand.disabled = true;
    sfxPop();
    const r = hand.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.climbed += 1;
    this.nextSide = this.nextSide === 0 ? 1 : 0;
    const koala = this.root.querySelector<HTMLElement>("#kc-koala");
    if (koala) koala.style.setProperty("--step", String(this.climbed));
    const cl = this.root.querySelector("#kc-climbed");
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
    if (document.getElementById("kc-style")) return;
    const st = document.createElement("style");
    st.id = "kc-style";
    st.textContent = KC_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function KC_CSS(theme: string): string {
  return `
.kc-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(420px,100%);}
.kc-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;}
.kc-task b{color:${theme};}
.kc-sub{font-size:.85rem;font-weight:600;color:var(--ink-soft,#888);}
.kc-meter{font-size:.95rem;font-weight:700;background:#fff;padding:6px 18px;border-radius:999px;box-shadow:var(--shadow);}
.kc-tree{position:relative;width:100%;height:60vh;min-height:360px;background:linear-gradient(180deg,#e3f6e3,#fff);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
.kc-tree::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:46px;transform:translateX(-50%);background:repeating-linear-gradient(180deg,#9b7b5a,#9b7b5a 14px,#8a6a4a 14px,#8a6a4a 28px);border-radius:8px;box-shadow:inset 0 0 0 3px rgba(0,0,0,.06);}
.kc-koala{position:absolute;left:50%;bottom:8px;font-size:2.2rem;transform:translate(-50%,calc(var(--step,0) * -42px));transition:transform .35s cubic-bezier(.4,1.6,.5,1);z-index:4;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.kc-flag{position:absolute;left:50%;top:6px;transform:translateX(-50%);font-size:1.8rem;z-index:3;}
.kc-hands{position:absolute;inset:0;}
.kc-hand{position:absolute;left:50%;bottom:18px;border:none;background:transparent;font-size:2.2rem;cursor:pointer;transform:translate(calc(var(--off,0)),calc(var(--idx,0) * -42px)) scale(1);transition:transform .12s ease,filter .2s;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));z-index:5;line-height:1;}
.kc-hand--left{margin-left:-78px;--off:-50%;}
.kc-hand--right{margin-left:78px;--off:-50%;}
.kc-hand--next{filter:drop-shadow(0 0 8px ${theme}) drop-shadow(0 2px 2px rgba(0,0,0,.2));animation:kc-pulse 1s ease-in-out infinite;}
.kc-hand:active{transform:translate(calc(var(--off,0)),calc(var(--idx,0) * -42px)) scale(.85);}
.kc-hand--done{opacity:.25;pointer-events:none;filter:grayscale(.6);}
.kc-hand--shake{animation:kc-shake .4s;}
@keyframes kc-pulse{0%,100%{filter:drop-shadow(0 0 6px ${theme}) drop-shadow(0 2px 2px rgba(0,0,0,.2));}50%{filter:drop-shadow(0 0 14px ${theme}) drop-shadow(0 2px 2px rgba(0,0,0,.2));}}
@keyframes kc-shake{0%,100%{transform:translate(calc(var(--off,0)),calc(var(--idx,0) * -42px));}25%{transform:translate(calc(var(--off,0) - 8px),calc(var(--idx,0) * -42px));}75%{transform:translate(calc(var(--off,0) + 8px),calc(var(--idx,0) * -42px));}}
@media (max-width:380px){.kc-koala{font-size:1.9rem;}.kc-hand{font-size:1.9rem;}.kc-hand--left{margin-left:-66px;}.kc-hand--right{margin-left:66px;}}
`;
}

export function create(): KoalaClimbGame {
  return new KoalaClimbGame();
}
