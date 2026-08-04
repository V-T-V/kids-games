/* 数字桥 Number Bridge —— 河面上有一座断桥，每段标着数字
   （1,2,3...）中间有空缺。孩子从下面的数字桥板里选正确的数字，
   点空缺处把桥板放进去，让数字按顺序连起来。
   独特点：数字顺序认知 + 空间摆放（点空缺 → 选数字）。
   巧思：缺口随机生成且互不相邻（避免歧义）；
   下方的候选桥板含正确数字 + 干扰数字；放对桥连通，放错弹回。
   难度=空缺数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Segment {
  value: number | null; // null = 空缺
  correct: number; // 正确数字
  el: HTMLDivElement;
  filled: boolean;
}

export class NumberBridgeGame extends BaseGame {
  constructor() {
    super("number-bridge");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private segments: Segment[] = [];
  /** 当前选中的候选数字（点空缺前需先选一个候选）。 */
  private selected: number | null = null;
  private remaining = 0;
  /** 候选区 DOM。 */
  private bankBtns: HTMLButtonElement[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  /** 桥总段数与空缺数随难度。 */
  private config(): { len: number; gaps: number } {
    if (this.difficulty === "easy") return { len: 5, gaps: 2 };
    if (this.difficulty === "medium") return { len: 7, gaps: 3 };
    return { len: 9, gaps: 4 };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.selected = null;

    const { len, gaps } = this.config();
    // 桥板数字从 1 到 len
    const values = Array.from({ length: len }, (_, i) => i + 1);
    // 选互不相邻的位置作为空缺，避免歧义
    const candidates = shuffle(values.map((_, i) => i)).filter(
      (i) => i !== 0 && i !== len - 1,
    ); // 首尾不缺
    const gapSet = new Set<number>();
    for (const c of candidates) {
      if (gapSet.size >= gaps) break;
      // 不与已有空缺相邻
      let ok = true;
      for (const g of gapSet) {
        if (Math.abs(g - c) <= 1) {
          ok = false;
          break;
        }
      }
      if (ok) gapSet.add(c);
    }
    // 若没选够（小桥），放宽相邻约束再补
    for (const c of candidates) {
      if (gapSet.size >= gaps) break;
      gapSet.add(c);
    }

    this.segments = values.map((v, i) => {
      const isGap = gapSet.has(i);
      const el = document.createElement("div");
      el.className = "nb-plank";
      if (isGap) {
        el.classList.add("nb-plank--gap");
        el.innerHTML = `<span class="nb-plank__q">?</span>`;
        el.addEventListener("click", () => this.placeGap(i));
      } else {
        el.classList.add("nb-plank--filled");
        el.innerHTML = `<span class="nb-plank__num">${v}</span>`;
      }
      return {
        value: isGap ? null : v,
        correct: v,
        el,
        filled: !isGap,
      };
    });
    this.remaining = gapSet.size;

    // 候选区：所有空缺的正确数字 + 1-2 个干扰
    const correctNums = [...gapSet].map((i) => values[i]!);
    const distractPool = values.filter((v) => !correctNums.includes(v));
    const distractN =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    const distract = shuffle(distractPool).slice(
      0,
      Math.min(distractN, distractPool.length),
    );
    const bankNums = shuffle([...correctNums, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "nb-wrap";
    const task = document.createElement("div");
    task.className = "nb-task";
    task.innerHTML = `桥断了！选数字放到 <b>?</b> 处，让数字 <b>1→${len}</b> 连起来（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "nb-scene";
    // 河面
    const river = document.createElement("div");
    river.className = "nb-river";
    // 桥
    const bridge = document.createElement("div");
    bridge.className = "nb-bridge";
    bridge.style.setProperty("--len", String(len));
    this.segments.forEach((s) => bridge.appendChild(s.el));
    river.appendChild(bridge);
    scene.appendChild(river);
    wrap.appendChild(scene);

    // 候选桥板仓库
    const bankWrap = document.createElement("div");
    bankWrap.className = "nb-bank-wrap";
    const bankLabel = document.createElement("div");
    bankLabel.className = "nb-bank-label";
    bankLabel.textContent = "先点一个数字，再点桥上的 ?";
    bankWrap.appendChild(bankLabel);
    const bank = document.createElement("div");
    bank.className = "nb-bank";
    this.bankBtns = [];
    bankNums.forEach((num) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nb-bank-plank";
      b.textContent = String(num);
      b.addEventListener("click", () => this.selectNum(num, b));
      bank.appendChild(b);
      this.bankBtns.push(b);
    });
    bankWrap.appendChild(bank);
    wrap.appendChild(bankWrap);

    this.root.appendChild(wrap);
  }

  private selectNum(num: number, btn: HTMLButtonElement): void {
    if (!btn.dataset.used) {
      sfxPop();
      this.selected = num;
      this.bankBtns.forEach((b) => b.classList.remove("nb-bank-plank--sel"));
      btn.classList.add("nb-bank-plank--sel");
    }
  }

  private placeGap(idx: number): void {
    const seg = this.segments[idx];
    if (!seg || seg.filled) return;
    if (this.selected == null) {
      // 提示先选数字
      const label = this.root.querySelector(".nb-bank-label");
      if (label) {
        const old = label.textContent;
        label.textContent = "👆 先点下面的数字，再点 ?";
        this.trackTimeout(() => {
          if (label) label.textContent = old;
        }, 1400);
      }
      return;
    }
    const guess = this.selected;
    if (guess === seg.correct) {
      // 放对
      seg.filled = true;
      seg.value = guess;
      seg.el.classList.remove("nb-plank--gap");
      seg.el.classList.add("nb-plank--filled");
      seg.el.innerHTML = `<span class="nb-plank__num">${guess}</span>`;
      // 候选区移除该数字
      const usedBtn = this.bankBtns.find(
        (b) => !b.dataset.used && b.textContent === String(guess),
      );
      if (usedBtn) {
        usedBtn.dataset.used = "1";
        usedBtn.classList.remove("nb-bank-plank--sel");
        usedBtn.classList.add("nb-bank-plank--used");
      }
      this.selected = null;
      this.remaining -= 1;
      const r = seg.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      if (this.remaining <= 0) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      }
    } else {
      // 放错
      const paused = this.onWrong();
      // 取消选中
      this.selected = null;
      this.bankBtns.forEach((b) => b.classList.remove("nb-bank-plank--sel"));
      seg.el.classList.add("nb-plank--shake");
      this.trackTimeout(() => seg.el.classList.remove("nb-plank--shake"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "数一数：缺的地方前面是几、后面是几？",
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
    if (document.getElementById("nb-style")) return;
    const st = document.createElement("style");
    st.id = "nb-style";
    st.textContent = NB_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function NB_CSS(theme: string): string {
  return `
.nb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.nb-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 16px;border-radius:16px;box-shadow:var(--shadow);line-height:1.5;}
.nb-scene{width:100%;max-width:520px;}
.nb-river{position:relative;background:linear-gradient(180deg,#aee5ff,#7cc7f5);border-radius:18px;padding:30px 8px;overflow:hidden;box-shadow:var(--shadow);}
.nb-river::before,.nb-river::after{content:'';position:absolute;left:0;right:0;height:6px;background:rgba(255,255,255,.5);}
.nb-river::before{top:8px;}
.nb-river::after{bottom:8px;}
.nb-bridge{display:flex;gap:4px;justify-content:center;align-items:stretch;}
.nb-plank{
  flex:1;min-width:0;max-width:64px;height:64px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;font-weight:900;color:#5a3a1a;
  background:linear-gradient(180deg,#e8b87a,#d49a55);box-shadow:0 4px 0 #b07a3a,inset 0 2px 0 rgba(255,255,255,.4);
  cursor:default;transition:transform .15s ease;
}
.nb-plank__num{font-size:1.5rem;}
.nb-plank--gap{background:rgba(255,255,255,.25);box-shadow:inset 0 3px 8px rgba(0,0,0,.25);cursor:pointer;border:3px dashed #fff;}
.nb-plank--gap:hover{transform:translateY(-2px);}
.nb-plank__q{font-size:1.6rem;color:#fff;font-weight:900;}
.nb-plank--filled{cursor:default;}
.nb-plank--shake{animation:nb-shake .4s ease;}
@keyframes nb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.nb-bank-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;}
.nb-bank-label{font-size:.9rem;font-weight:700;color:var(--ink-soft);}
.nb-bank{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.nb-bank-plank{
  width:56px;height:56px;border-radius:10px;border:none;font-size:1.4rem;font-weight:900;color:#5a3a1a;
  background:linear-gradient(180deg,#f0c98a,#dba866);box-shadow:0 4px 0 #b07a3a,inset 0 2px 0 rgba(255,255,255,.4);
  cursor:pointer;transition:transform .1s ease;
}
.nb-bank-plank:active{transform:translateY(3px);box-shadow:0 1px 0 #b07a3a;}
.nb-bank-plank--sel{outline:4px solid ${theme};outline-offset:2px;transform:translateY(-3px);}
.nb-bank-plank--used{opacity:.3;pointer-events:none;}
@media (max-width:380px){.nb-plank{height:54px;}.nb-plank__num{font-size:1.2rem;}.nb-bank-plank{width:48px;height:48px;font-size:1.2rem;}}
`;
}

export function create(): NumberBridgeGame {
  return new NumberBridgeGame();
}
