/* 火箭发射 Rocket Launch —— 从大到小倒着点数字（5,4,3,2,1），全按对火箭升空。
   独特点：倒数顺序点击，训练数字逆序 + 大小概念（区别于 ladder-step 的正序跳）。
   视觉：夜空 + 火箭 + 倒计时数字按钮。难度=倒数起始数。通关=发射成功目标轮数。
   巧思：数字按钮打乱位置，孩子须找出"最大的"先点，逐次递减。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const ENCOURAGE = [
  "发射成功！",
  "倒数得真准！",
  "你是小小宇航员！",
  "从大数往小数点哦～",
];

export class RocketLaunchGame extends BaseGame {
  constructor() {
    super("rocket-launch");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private startFrom = 0;
  private expect = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private from(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 7
        : 10;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    this.startFrom = this.from();
    this.expect = this.startFrom;

    const wrap = document.createElement("div");
    wrap.className = "rl2-wrap";

    const task = document.createElement("div");
    task.className = "rl2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 从 <b>${this.startFrom}</b> 倒着点到 <b>1</b>！下一个是 <b id="rl2-next">${this.expect}</b>`;
    wrap.appendChild(task);

    // 夜空 + 火箭
    const sky = document.createElement("div");
    sky.className = "rl2-sky";
    const rocket = document.createElement("div");
    rocket.className = "rl2-rocket";
    rocket.id = "rl2-rocket";
    rocket.innerHTML = `<span class="rl2-flame" id="rl2-flame"></span>🚀`;
    sky.appendChild(rocket);
    wrap.appendChild(sky);

    // 数字按钮（打乱顺序）
    const nums: number[] = [];
    for (let n = this.startFrom; n >= 1; n--) nums.push(n);
    const tray = document.createElement("div");
    tray.className = "rl2-tray";
    shuffle(nums).forEach((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rl2-num";
      b.textContent = String(n);
      b.dataset.n = String(n);
      b.addEventListener("click", () => this.tap(n, b));
      tray.appendChild(b);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private tap(n: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (n === this.expect) {
      btn.classList.add("rl2-num--done");
      btn.disabled = true;
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.expect -= 1;
      const next = this.root.querySelector("#rl2-next");
      if (next)
        next.textContent = this.expect >= 1 ? String(this.expect) : "🚀";
      // 倒数到 0 -> 火箭升空
      if (this.expect <= 0) {
        this.launch();
      }
    } else {
      btn.classList.add("rl2-num--wrong");
      this.trackTimeout(() => btn.classList.remove("rl2-num--wrong"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private launch(): void {
    this.locked = true;
    const rocket = this.root.querySelector("#rl2-rocket");
    if (rocket) rocket.classList.add("rl2-rocket--up");
    this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 1500);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🚀",
      variant: "rest",
      body: `找最大的数先点，再点小一点的～ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("rl2-style")) return;
    const st = document.createElement("style");
    st.id = "rl2-style";
    st.textContent = RL2_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function RL2_CSS(theme: string): string {
  return `
.rl2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.rl2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.rl2-task b{color:${theme};font-size:1.25rem;}
.rl2-sky{position:relative;width:100%;height:42vh;min-height:220px;background:radial-gradient(circle at 50% 120%,#1b3a6b,#0d1b3e 60%,#060b1f);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.rl2-sky::before{content:"✨";position:absolute;top:14px;left:20%;font-size:1rem;opacity:.8;}
.rl2-sky::after{content:"⭐";position:absolute;top:30px;right:18%;font-size:.9rem;opacity:.7;}
.rl2-rocket{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);font-size:3.2rem;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));transition:none;}
.rl2-rocket--up{animation:rl2-up 1.4s cubic-bezier(.5,0,.8,.2) forwards;}
.rl2-flame{position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);width:18px;height:0;background:linear-gradient(180deg,#ffd93d,#ff6348);border-radius:50%;opacity:0;}
.rl2-rocket--up .rl2-flame{height:46px;opacity:1;animation:rl2-flick .1s linear infinite;}
@keyframes rl2-up{0%{transform:translateX(-50%) translateY(0)}100%{transform:translateX(-50%) translateY(-360px) scale(.6);opacity:.5}}
@keyframes rl2-flick{0%{height:40px}100%{height:54px}}
.rl2-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.rl2-num{min-width:64px;height:64px;border:none;border-radius:16px;background:linear-gradient(180deg,#fff,${theme}33);font-size:1.8rem;font-weight:900;color:#333;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.12);transition:transform .1s;}
.rl2-num:active{transform:translateY(3px);}
.rl2-num--done{background:linear-gradient(180deg,#bff0c1,#6bcf7f);color:#1d6b2c;animation:rl2-pop .4s ease;}
.rl2-num--wrong{background:linear-gradient(180deg,#ffd0c4,#ff8a72);animation:rl2-shake .45s ease;}
@keyframes rl2-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes rl2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.rl2-num{min-width:54px;height:54px;font-size:1.5rem;}.rl2-rocket{font-size:2.6rem;}}
`;
}

export function create(): RocketLaunchGame {
  return new RocketLaunchGame();
}
