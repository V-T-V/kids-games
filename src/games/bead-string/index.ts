/* 串珠子 Bead String —— 绳子上有规律的空位（如红蓝红蓝红?），孩子从选项选
   缺的那颗穿进去。独特点：颜色规律识别 + 视觉延续。类似 candy-pattern。
   视觉：横向绳子 + 已穿的彩色珠子 + 问号空位 + 下方候选珠子。
   巧思：每轮规律不同（AB/ABC/AAB），干扰项保证唯一解。前缀 bds-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface BeadType {
  color: string;
  emoji: string;
  name: string;
}

const BEADS: BeadType[] = [
  { color: "#ff5252", emoji: "🔴", name: "红" },
  { color: "#4d96ff", emoji: "🔵", name: "蓝" },
  { color: "#6bcf7f", emoji: "🟢", name: "绿" },
  { color: "#ffd93d", emoji: "🟡", name: "黄" },
  { color: "#a55eea", emoji: "🟣", name: "紫" },
];

interface Puzzle {
  display: { color: string; emoji: string; isQ: boolean }[];
  answer: BeadType;
  choices: BeadType[];
}

/** 生成一道规律题：周期为 period，挖空让规律唯一可解。 */
function genPuzzle(diff: string): Puzzle {
  const period = diff === "easy" ? 4 : diff === "medium" ? 2 : 3;
  const total = diff === "easy" ? 5 : diff === "medium" ? 6 : 7;
  const pool = shuffle(BEADS).slice(0, period);
  const full: BeadType[] = [];
  for (let i = 0; i < total; i++) full.push(pool[i % period]!);
  // 挖空位置：后半段，且保证挖空后规律可推断（前至少一个完整周期）
  const qIdx = Math.max(period, Math.floor(total / 2));
  const answer = full[qIdx]!;
  const display = full.map((b, i) =>
    i === qIdx
      ? { color: "#ccc", emoji: "?", isQ: true }
      : { color: b.color, emoji: b.emoji, isQ: false },
  );
  // 干扰项：2-3 个不同颜色的珠子
  const distract: BeadType[] = [];
  const others = shuffle(BEADS.filter((b) => !pool.includes(b)));
  for (const o of others) {
    if (distract.length >= 3) break;
    distract.push(o);
  }
  const choices = shuffle([answer, ...distract.slice(0, 3)]);
  return { display, answer, choices };
}

export class BeadStringGame extends BaseGame {
  constructor() {
    super("bead-string");
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

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const puzzle = genPuzzle(this.difficulty);

    const wrap = document.createElement("div");
    wrap.className = "bds-wrap";
    const task = document.createElement("div");
    task.className = "bds-task";
    task.innerHTML = `问号处该穿哪颗珠子？找找颜色<b>重复的规律</b>～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 绳子
    const rope = document.createElement("div");
    rope.className = "bds-rope";
    puzzle.display.forEach((b, i) => {
      const slot = document.createElement("div");
      slot.className = "bds-slot";
      if (b.isQ) {
        slot.classList.add("bds-slot--q");
        slot.id = "bds-q";
        slot.textContent = "？";
      } else {
        slot.classList.add("bds-slot--bead");
        slot.style.setProperty("--bds-color", b.color);
        slot.textContent = b.emoji;
      }
      // 每 period 个加分组高亮强调周期
      if (i > 0 && i % puzzle.display.length >= 3 && !b.isQ) {
        slot.classList.add("bds-slot--group");
      }
      rope.appendChild(slot);
    });
    wrap.appendChild(rope);

    // 候选珠子
    const opts = document.createElement("div");
    opts.className = "bds-opts";
    puzzle.choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bds-choice";
      b.style.setProperty("--bds-color", c.color);
      b.textContent = c.emoji;
      b.addEventListener("click", () => this.choose(c, puzzle.answer, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(c: BeadType, answer: BeadType, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (c.name === answer.name) {
      this.answered = true;
      const q = this.root.querySelector("#bds-q");
      if (q) {
        const el = q as HTMLElement;
        el.textContent = answer.emoji;
        el.classList.remove("bds-slot--q");
        el.classList.add("bds-slot--bead", "bds-slot--done");
        el.style.setProperty("--bds-color", answer.color);
      }
      sfxPop();
      const r = btn.getBoundingClientRect();
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
      }, 1000);
    } else {
      btn.classList.add("bds-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("bds-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "📿",
      variant: "rest",
      body: "看看珠子是按什么颜色<b>顺序重复</b>的，找出下一个～",
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
    if (document.getElementById("bds-style")) return;
    const st = document.createElement("style");
    st.id = "bds-style";
    st.textContent = BDS_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function BDS_CSS(theme: string): string {
  return `
.bds-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(540px,100%);}
.bds-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.bds-rope{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:center;background:linear-gradient(180deg,#fff,#fff8f0);padding:16px 14px 22px;border-radius:22px;box-shadow:var(--shadow);position:relative;}
.bds-rope::after{content:'';position:absolute;left:10px;right:10px;bottom:10px;height:4px;background:${theme};border-radius:2px;opacity:.5;}
.bds-slot{width:50px;height:56px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.8rem;box-shadow:0 2px 5px rgba(0,0,0,.15);margin-bottom:6px;}
.bds-slot--bead{background:radial-gradient(circle at 35% 30%,#fff8,var(--bds-color,#888));animation:bds-drop .4s ease;}
.bds-slot--q{background:#fff3c4;font-size:2rem;font-weight:900;color:${theme};border:3px dashed ${theme};}
.bds-slot--done{background:radial-gradient(circle at 35% 30%,#fff8,var(--bds-color,#888));border:none;animation:bds-pop .4s ease;}
.bds-slot--group{outline:2px dashed #ddd;outline-offset:2px;}
.bds-opts{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.bds-choice{width:66px;height:66px;font-size:2rem;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,var(--bds-color,#888));box-shadow:var(--shadow);border:none;transition:transform .12s ease;cursor:pointer;}
.bds-choice:active{transform:scale(.92);}
.bds-choice--wrong{animation:bds-shake .4s ease;}
@keyframes bds-drop{0%{transform:translateY(-14px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes bds-pop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes bds-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.bds-slot{width:42px;height:48px;font-size:1.5rem;}.bds-choice{width:58px;height:58px;font-size:1.7rem;}}
`;
}

export function create(): BeadStringGame {
  return new BeadStringGame();
}
