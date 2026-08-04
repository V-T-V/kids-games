/* 龟赛跑2 Turtle Race 2 —— 与 snail-race 类似但用乌龟，且选最快的那只。
   独特点：正面思维——找爬得最快的乌龟（与 snail-race 找最慢相反）。
   玩法：开始后乌龟按各自速度爬行，孩子观察后点"我觉得最快的乌龟"。
   解保证：每只乌龟分配不同速度，最快者（速度值最大）唯一确定。
   视觉：乌龟赛道（沙地）。难度 = 乌龟数。通关 = 选对目标轮数。
   前缀 tr2-（tractor-park 用 trp-，treasure-hunt 用 th-，不冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Turtle {
  emoji: string;
  pos: number; // 0~1 赛道进度
  speed: number; // 越大越快
  el: HTMLButtonElement;
}

const TURTLE_EMOJI = ["🐢", "🐢", "🐢", "🐢", "🐢"] as const;
/** 给不同乌龟不同壳色，便于区分。 */
const SHELL_COLORS = ["#6b8e3a", "#c08a3e", "#8a5a2a", "#4a7a8a", "#7a5a8a"];

function turtleCount(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 4 : 5;
}
function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 3 : 4;
}

/** 生成 n 个互不相同的速度，保证最大值唯一。返回 [速度数组, 最快者索引]。 */
function genSpeeds(
  n: number,
  diff: "easy" | "medium" | "hard",
): { speeds: number[]; fastIdx: number } {
  // easy：速度差异大，好认；hard：差异小，更难
  const base = diff === "easy" ? 0.05 : diff === "medium" ? 0.06 : 0.065;
  const spread = diff === "easy" ? 0.07 : diff === "medium" ? 0.05 : 0.04;
  const set = new Set<number>();
  const speeds: number[] = [];
  while (speeds.length < n) {
    const v = base + Math.random() * spread;
    const rounded = Math.round(v * 1000) / 1000;
    if (!set.has(rounded)) {
      set.add(rounded);
      speeds.push(rounded);
    }
  }
  let fastIdx = 0;
  for (let i = 1; i < speeds.length; i++) {
    if (speeds[i]! > speeds[fastIdx]!) fastIdx = i;
  }
  return { speeds, fastIdx };
}

export class TurtleRaceGame extends BaseGame {
  constructor() {
    super("turtle-race");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private turtles: Turtle[] = [];
  private fastIdx = -1;
  private raceOver = false;
  private answered = false;
  private stop?: () => void;

  protected mount(): void {
    this.roundTotal = roundTotal(this.difficulty);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.stop?.();
    this.stop = undefined;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.raceOver = false;
    this.answered = false;

    const n = turtleCount(this.difficulty);
    const { speeds, fastIdx } = genSpeeds(n, this.difficulty);
    this.fastIdx = fastIdx;
    this.turtles = [];

    const wrap = document.createElement("div");
    wrap.className = "tr2-wrap";

    const task = document.createElement("div");
    task.className = "tr2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 谁爬得最<b>快</b>？点它！🐢`;
    wrap.appendChild(task);

    const track = document.createElement("div");
    track.className = "tr2-track";
    const shellOrder = shuffle(SHELL_COLORS).slice(0, n);
    for (let i = 0; i < n; i++) {
      const lane = document.createElement("div");
      lane.className = "tr2-lane";
      const finish = document.createElement("div");
      finish.className = "tr2-finish";
      finish.textContent = "🏁";
      lane.appendChild(finish);
      const tEl = document.createElement("button");
      tEl.type = "button";
      tEl.className = "tr2-turtle";
      tEl.dataset.idx = String(i);
      tEl.style.setProperty("--tr2-shell", shellOrder[i]!);
      tEl.innerHTML = `<span class="tr2-turtle-emoji">${TURTLE_EMOJI[i]!}</span>`;
      tEl.addEventListener("click", () => this.pick(i));
      lane.appendChild(tEl);
      track.appendChild(lane);
      this.turtles.push({
        emoji: TURTLE_EMOJI[i]!,
        pos: 0,
        speed: speeds[i]!,
        el: tEl,
      });
    }
    wrap.appendChild(track);

    const hint = document.createElement("div");
    hint.className = "tr2-hint";
    hint.id = "tr2-hint";
    hint.textContent = "看清楚谁最快，再点它～";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);

    this.stop = createRafLoop(() => this.tick());
  }

  private tick = (): void => {
    if (this.raceOver) return;
    for (const t of this.turtles) {
      if (t.pos >= 1) continue;
      t.pos += t.speed;
      if (t.pos > 1) t.pos = 1;
      t.el.style.left = `${t.pos * 88}%`;
    }
    // 任一乌龟到终点即结束竞速，进入判定
    if (this.turtles.some((t) => t.pos >= 1)) {
      this.raceOver = true;
      const hint = this.root.querySelector("#tr2-hint");
      if (hint) {
        (hint as HTMLElement).textContent = "比赛结束！点你猜最快的那只～";
      }
    }
  };

  private pick(i: number): void {
    if (this.answered) return;
    this.answered = true;
    if (i === this.fastIdx) {
      sfxPop();
      const el = this.turtles[i]!.el;
      const r = el.getBoundingClientRect();
      el.classList.add("tr2-turtle--win");
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      const paused = this.onWrong();
      // 标出正确答案
      this.turtles[this.fastIdx]!.el.classList.add("tr2-turtle--win");
      this.turtles[i]!.el.classList.add("tr2-turtle--miss");
      this.answered = false; // 允许再猜，但已计错
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🐢",
      variant: "rest",
      body: "找爬在最前面、最先到终点的那只乌龟，就是最快的～",
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
    if (document.getElementById("tr2-style")) return;
    const st = document.createElement("style");
    st.id = "tr2-style";
    st.textContent = TR2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function TR2_CSS(theme: string): string {
  return `
.tr2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.tr2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.tr2-task b{color:${theme};}
.tr2-track{width:min(420px,94%);background:linear-gradient(180deg,#f5e6c8,#e8d09a);border-radius:20px;padding:14px 16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px;}
.tr2-lane{position:relative;height:54px;background:repeating-linear-gradient(90deg,rgba(180,140,80,.18) 0 18px,rgba(180,140,80,.06) 18px 36px);border-radius:12px;overflow:hidden;}
.tr2-finish{position:absolute;right:2px;top:0;bottom:0;width:6px;background:repeating-linear-gradient(0deg,#fff 0 6px,#222 6px 12px);font-size:0;display:flex;}
.tr2-turtle{position:absolute;left:0;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));transition:transform .12s;padding:0;will-change:left;}
.tr2-turtle-emoji{font-size:2.3rem;line-height:1;display:block;filter:drop-shadow(0 0 6px var(--tr2-shell,${theme}));}
.tr2-turtle:hover{transform:translateY(-50%) scale(1.1);}
.tr2-turtle--win{animation:tr2-bounce .5s ease infinite;}
.tr2-turtle--win .tr2-turtle-emoji{filter:drop-shadow(0 0 12px ${theme}) drop-shadow(0 0 6px var(--tr2-shell));}
@keyframes tr2-bounce{0%,100%{transform:translateY(-50%) scale(1.15)}50%{transform:translateY(-65%) scale(1.15)}}
.tr2-turtle--miss .tr2-turtle-emoji{filter:grayscale(.7) drop-shadow(0 2px 2px rgba(0,0,0,.2));}
.tr2-turtle--miss{animation:tr2-shake .4s ease;}
@keyframes tr2-shake{0%,100%{transform:translateY(-50%) rotate(0)}25%{transform:translateY(-50%) rotate(-10deg)}75%{transform:translateY(-50%) rotate(10deg)}}
.tr2-hint{font-size:.95rem;font-weight:700;color:var(--ink-soft,#666);background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
@media (max-width:380px){.tr2-turtle-emoji{font-size:1.9rem;}.tr2-lane{height:46px;}}
`;
}

export function create(): TurtleRaceGame {
  return new TurtleRaceGame();
}
