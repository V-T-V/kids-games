/* 蜗牛赛跑 Snail Race —— 几只蜗牛一起爬，谁最慢谁赢（逆向思维）。
   独特点：反直觉玩法——不是抢第一，而是要找出最慢的蜗牛。
   玩法：开始后蜗牛按各自速度爬行，孩子观察后点"我觉得最慢的蜗牛"。
   解保证：每只蜗牛分配不同速度，最慢者（速度值最小）唯一确定。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Snail {
  emoji: string;
  /** 当前位置 0~1（赛道进度）。 */
  pos: number;
  /** 速度（越小越慢）。 */
  speed: number;
  el: HTMLButtonElement;
}

const SNAIL_EMOJI = ["🐌", "🐢", "🐛", "🦥", "🪲"] as const;

function snailCount(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 4 : 5;
}
function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 3 : 4;
}

/** 生成 n 个互不相同的速度，保证最小值唯一。返回 [速度数组, 最慢者索引]。 */
function genSpeeds(
  n: number,
  diff: "easy" | "medium" | "hard",
): { speeds: number[]; slowIdx: number } {
  // easy：速度差异大，好认；hard：差异小，更难
  const base = diff === "easy" ? 0.05 : diff === "medium" ? 0.04 : 0.035;
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
  let slowIdx = 0;
  for (let i = 1; i < speeds.length; i++) {
    if (speeds[i]! < speeds[slowIdx]!) slowIdx = i;
  }
  return { speeds, slowIdx };
}

export class SnailRaceGame extends BaseGame {
  constructor() {
    super("snail-race");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private snails: Snail[] = [];
  private slowIdx = -1;
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

    const n = snailCount(this.difficulty);
    const { speeds, slowIdx } = genSpeeds(n, this.difficulty);
    this.slowIdx = slowIdx;
    this.snails = [];

    const wrap = document.createElement("div");
    wrap.className = "sr-wrap";

    const task = document.createElement("div");
    task.className = "sr-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 谁爬得最<b>慢</b>？点它！🐌`;
    wrap.appendChild(task);

    const track = document.createElement("div");
    track.className = "sr-track";
    track.id = "sr-track";
    const emojis = shuffle([...SNAIL_EMOJI]).slice(0, n);
    for (let i = 0; i < n; i++) {
      const lane = document.createElement("div");
      lane.className = "sr-lane";
      const finish = document.createElement("div");
      finish.className = "sr-finish";
      finish.textContent = "🏁";
      lane.appendChild(finish);
      const snailEl = document.createElement("button");
      snailEl.type = "button";
      snailEl.className = "sr-snail";
      snailEl.dataset.idx = String(i);
      snailEl.textContent = emojis[i]!;
      snailEl.addEventListener("click", () => this.pick(i));
      lane.appendChild(snailEl);
      track.appendChild(lane);
      this.snails.push({
        emoji: emojis[i]!,
        pos: 0,
        speed: speeds[i]!,
        el: snailEl,
      });
    }
    wrap.appendChild(track);

    const hint = document.createElement("div");
    hint.className = "sr-hint";
    hint.id = "sr-hint";
    hint.textContent = "看清楚谁最慢，再点它～";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);

    this.stop = createRafLoop(() => this.tick());
  }

  private tick = (): void => {
    if (this.raceOver) return;
    for (const s of this.snails) {
      if (s.pos >= 1) continue;
      s.pos += s.speed;
      if (s.pos > 1) s.pos = 1;
      s.el.style.left = `${s.pos * 88}%`;
    }
    // 任一蜗牛到终点即结束竞速，进入判定
    if (this.snails.some((s) => s.pos >= 1)) {
      this.raceOver = true;
      const hint = this.root.querySelector("#sr-hint");
      if (hint) {
        (hint as HTMLElement).textContent = "比赛结束！点你猜最慢的那只～";
      }
    }
  };

  private pick(i: number): void {
    if (this.answered) return;
    // 必须等比赛结束（或允许中途猜——这里要求至少爬一会儿）
    this.answered = true;
    if (i === this.slowIdx) {
      sfxPop();
      const el = this.snails[i]!.el;
      const r = el.getBoundingClientRect();
      el.classList.add("sr-snail--win");
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
      this.snails[this.slowIdx]!.el.classList.add("sr-snail--win");
      this.snails[i]!.el.classList.add("sr-snail--miss");
      this.answered = false; // 允许再猜，但已计错
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "找找哪只蜗牛落在最后面，就是最慢的哦～",
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
    if (document.getElementById("sr-style")) return;
    const st = document.createElement("style");
    st.id = "sr-style";
    st.textContent = SR_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SR_CSS(theme: string): string {
  return `
.sr-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.sr-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sr-track{width:min(420px,94%);background:linear-gradient(180deg,#bff0c1,#8fdb93);border-radius:20px;padding:14px 16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px;}
.sr-lane{position:relative;height:50px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.3) 0 18px,rgba(255,255,255,.1) 18px 36px);border-radius:12px;overflow:hidden;}
.sr-finish{position:absolute;right:2px;top:0;bottom:0;width:6px;background:repeating-linear-gradient(0deg,#fff 0 6px,#222 6px 12px);font-size:0;display:flex;}
.sr-snail{position:absolute;left:0;top:50%;transform:translateY(-50%);font-size:2.1rem;background:none;border:none;cursor:pointer;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));transition:transform .12s;padding:0;will-change:left;}
.sr-snail:hover{transform:translateY(-50%) scale(1.1);}
.sr-snail--win{animation:sr-bounce .5s ease infinite;filter:drop-shadow(0 0 10px ${theme}) drop-shadow(0 2px 2px rgba(0,0,0,.2));}
@keyframes sr-bounce{0%,100%{transform:translateY(-50%) scale(1.15)}50%{transform:translateY(-65%) scale(1.15)}}
.sr-snail--miss{filter:grayscale(.7) drop-shadow(0 2px 2px rgba(0,0,0,.2));animation:sr-shake .4s ease;}
@keyframes sr-shake{0%,100%{transform:translateY(-50%) rotate(0)}25%{transform:translateY(-50%) rotate(-10deg)}75%{transform:translateY(-50%) rotate(10deg)}}
.sr-hint{font-size:.95rem;font-weight:700;color:var(--ink-soft);background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
@media (max-width:380px){.sr-snail{font-size:1.7rem;}.sr-lane{height:42px;}}
`;
}

export function create(): SnailRaceGame {
  return new SnailRaceGame();
}
