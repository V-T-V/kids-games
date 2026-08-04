/* 声音高低 Sound Wave —— 用 Web Audio 播放两个音，孩子判断哪个「更高」或「更低」。
   高音用小快的波浪线，低音用大慢的波浪线（CSS 动画）。
   难度=音高差距：easy 差距大（八度）、medium 中等、hard 差距小（相邻音）。
   巧思：两段固定波形视觉化高/低；复用 audio.ts 的 playNote 播放音高；
         培养音高感知（科学认知：声音有高低，振动快=高音）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, playNote } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

type AskKind = "higher" | "lower";

export class SoundWaveGame extends BaseGame {
  constructor() {
    super("sound-wave");
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

  /** 难度→可选音名（C4 低 到 C6 高）+ 两音之间的最小间距。 */
  private pickPair(): { low: string; high: string; gap: number } {
    const scale = [
      "C4", "D4", "E4", "F4", "G4", "A4", "B4",
      "C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6",
    ];
    // easy: 间距 ≥6（几乎一个八度）；medium: ≥3；hard: =1 或 2（相邻）
    const minGap = this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 3 : 1;
    let lo = 0;
    let hi = 0;
    let tries = 0;
    do {
      lo = Math.floor(Math.random() * (scale.length - 1));
      hi = Math.floor(Math.random() * (scale.length - 1));
      tries++;
    } while (Math.abs(hi - lo) < minGap && tries < 50);
    if (hi < lo) [lo, hi] = [hi, lo];
    return { low: scale[lo]!, high: scale[hi]!, gap: hi - lo };
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const { low, high } = this.pickPair();
    // 随机决定「找高音」还是「找低音」
    const ask: AskKind = sample<AskKind>(["higher", "lower"]);
    // 两个按钮的展示（左/右随机）
    const leftIsHigh = Math.random() < 0.5;
    const left = leftIsHigh ? high : low;
    const right = leftIsHigh ? low : high;
    // 正确答案对应的名字
    const answer = ask === "higher" ? high : low;

    const wrap = document.createElement("div");
    wrap.className = "sdw-wrap";

    const task = document.createElement("div");
    task.className = "sdw-task";
    task.innerHTML = `听两个声音，点出 <b>${ask === "higher" ? "更高" : "更低"}</b> 的那个！<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    // 两个声波卡
    const board = document.createElement("div");
    board.className = "sdw-board";
    const makeCard = (note: string, side: "left" | "right"): HTMLButtonElement => {
      const isHigh = note === high;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `sdw-card sdw-card--${isHigh ? "high" : "low"}`;
      btn.dataset.note = note;
      btn.innerHTML = `
        <div class="sdw-wave"><span></span><span></span><span></span><span></span><span></span></div>
        <div class="sdw-play">🔊 再听一次</div>`;
      btn.addEventListener("click", () => this.choose(note, answer, btn, side));
      // 点击波形容器也播放
      btn.querySelector(".sdw-play")!.addEventListener("click", (e) => {
        e.stopPropagation();
        this.playOne(note, btn);
      });
      board.appendChild(btn);
      return btn;
    };
    const leftBtn = makeCard(left, "left");
    const rightBtn = makeCard(right, "right");
    // 保证 DOM 顺序与 left/right 一致
    board.innerHTML = "";
    board.appendChild(leftBtn);
    board.appendChild(rightBtn);
    wrap.appendChild(board);

    this.root.appendChild(wrap);

    // 依次播放两个音，并点亮对应卡片
    this.trackTimeout(() => this.playOne(left, leftBtn), 400);
    this.trackTimeout(() => this.playOne(right, rightBtn), 1300);
  }

  private playOne(note: string, btn: HTMLButtonElement): void {
    playNote(note, 0.45);
    btn.classList.remove("sdw-card--playing");
    void btn.offsetWidth;
    btn.classList.add("sdw-card--playing");
    this.trackTimeout(() => btn.classList.remove("sdw-card--playing"), 600);
  }

  private choose(
    note: string,
    answer: string,
    btn: HTMLButtonElement,
    _side: "left" | "right",
  ): void {
    void _side;
    if (this.answered) return;
    // 点卡片即播放 + 判定
    this.playOne(note, btn);
    if (note === answer) {
      this.answered = true;
      sfxPop();
      btn.classList.add("sdw-card--done");
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
      btn.classList.add("sdw-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("sdw-card--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🎵",
      variant: "rest",
      body: "再点卡片听一遍声音～",
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
    if (document.getElementById("sdw-style")) return;
    const st = document.createElement("style");
    st.id = "sdw-style";
    st.textContent = SDW_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SDW_CSS(theme: string): string {
  return `
.sdw-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(480px,100%);}
.sdw-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);}
.sdw-task b{color:${theme};}
.sdw-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.sdw-board{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;}
.sdw-card{width:170px;height:190px;border-radius:24px;border:none;box-shadow:var(--shadow-lg);background:linear-gradient(180deg,#fff,#eef1ff);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;cursor:pointer;}
.sdw-card:active{transform:scale(.96);}
.sdw-card--high{background:linear-gradient(180deg,#fff7e6,#ffe0b3);}
.sdw-card--low{background:linear-gradient(180deg,#e7f0ff,#cfe0ff);}
.sdw-wave{display:flex;gap:3px;align-items:center;height:50px;}
.sdw-wave span{width:7px;background:${theme};border-radius:4px;}
/* 高音：小快波浪（振幅小、频率快） */
.sdw-card--high .sdw-wave span{height:14px;}
.sdw-card--high.sdw-card--playing .sdw-wave span{animation:sdw-fast .3s ease infinite;}
.sdw-card--high .sdw-wave span:nth-child(2){animation-delay:.04s}
.sdw-card--high .sdw-wave span:nth-child(3){animation-delay:.08s}
.sdw-card--high .sdw-wave span:nth-child(4){animation-delay:.12s}
.sdw-card--high .sdw-wave span:nth-child(5){animation-delay:.16s}
@keyframes sdw-fast{0%,100%{height:10px}50%{height:22px}}
/* 低音：大慢波浪（振幅大、频率慢） */
.sdw-card--low .sdw-wave span{height:30px;}
.sdw-card--low.sdw-card--playing .sdw-wave span{animation:sdw-slow .7s ease infinite;}
.sdw-card--low .sdw-wave span:nth-child(2){animation-delay:.08s}
.sdw-card--low .sdw-wave span:nth-child(3){animation-delay:.16s}
.sdw-card--low .sdw-wave span:nth-child(4){animation-delay:.24s}
.sdw-card--low .sdw-wave span:nth-child(5){animation-delay:.32s}
@keyframes sdw-slow{0%,100%{height:36px}50%{height:10px}}
.sdw-play{font-size:.95rem;font-weight:800;color:var(--ink-soft);background:rgba(0,0,0,.05);padding:6px 14px;border-radius:14px;}
.sdw-card--done{background:linear-gradient(180deg,#d4f4dd,#b6e9c6)!important;animation:sdw-pop .4s ease;}
.sdw-card--wrong{animation:sdw-shake .4s ease;}
@keyframes sdw-pop{0%{transform:scale(.6)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes sdw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SoundWaveGame {
  return new SoundWaveGame();
}
