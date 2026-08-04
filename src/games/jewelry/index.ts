/* 串珠子 Jewelry —— 一条项链的珠子按规律排（如红蓝红蓝红?），缺一颗，
   孩子从选项里选出对的那颗补上。
   独特点：环形项链视觉 + 颜色/形状规律推理（区别于 candy-pattern 的直线排列）。
   视觉：项链弧线 + 彩色珠子 + 问号缺位 + 选项珠子。难度=规律复杂度。
   通关=选对目标轮数。前缀 jw-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Bead {
  name: string;
  hex: string;
  emoji: string;
}

const BEADS: Bead[] = [
  { name: "红", hex: "#ef5350", emoji: "🔴" },
  { name: "蓝", hex: "#42a5f5", emoji: "🔵" },
  { name: "黄", hex: "#ffca28", emoji: "🟡" },
  { name: "绿", hex: "#66bb6a", emoji: "🟢" },
  { name: "紫", hex: "#ab47bc", emoji: "🟣" },
  { name: "橙", hex: "#ff9f43", emoji: "🟠" },
];

interface Puzzle {
  /** 显示序列（emoji，缺位用 '?'） */
  display: string[];
  /** 缺位在 display 的索引 */
  qIdx: number;
  /** 正确答案 name */
  answerName: string;
  /** 选项 Bead */
  choices: Bead[];
}

/** 生成一道规律题：周期 period，总长 total，挖一个能由规律推出的空。 */
function genPuzzle(diff: string): Puzzle {
  const period = diff === "easy" ? 4 : diff === "medium" ? 2 : 3;
  const total = diff === "easy" ? 5 : diff === "medium" ? 7 : 9;
  const pool = shuffle(BEADS).slice(0, period);
  const full: Bead[] = [];
  for (let i = 0; i < total; i++) full.push(pool[i % period]!);
  // 挖空：取后半段某位，保证可由前面的周期推出
  const qIdx = Math.min(total - 1, Math.floor(total / 2) + 1);
  const answer = full[qIdx]!;
  const display: string[] = full.map((b, i) => (i === qIdx ? "?" : b.emoji));
  // 干扰项：非答案、且不在周期内的珠子优先（避免歧义）
  const distract = shuffle(
    BEADS.filter(
      (b) => b.name !== answer.name && !pool.some((p) => p.name === b.name),
    ),
  );
  const picks: Bead[] = [answer];
  let di = 0;
  while (picks.length < 4 && di < distract.length) {
    picks.push(distract[di]!);
    di += 1;
  }
  // 兜底：干扰不够则从所有非答案珠子里补
  let fi = 0;
  const fallback = shuffle(BEADS.filter((b) => b.name !== answer.name));
  while (picks.length < 4 && fi < fallback.length) {
    const b = fallback[fi]!;
    if (!picks.some((p) => p.name === b.name)) picks.push(b);
    fi += 1;
  }
  return { display, qIdx, answerName: answer.name, choices: shuffle(picks) };
}

export class JewelryGame extends BaseGame {
  constructor() {
    super("jewelry");
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
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    const puzzle = genPuzzle(this.difficulty);

    const wrap = document.createElement("div");
    wrap.className = "jw-wrap";

    const task = document.createElement("div");
    task.className = "jw-task";
    task.textContent = `项链上少了一颗珠子，找找规律选对的～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 项链
    const necklace = document.createElement("div");
    necklace.className = "jw-necklace";
    puzzle.display.forEach((emoji, i) => {
      const bead = document.createElement("div");
      bead.className = "jw-bead";
      if (emoji === "?") {
        bead.classList.add("jw-bead--q");
        bead.id = "jw-q";
        bead.textContent = "？";
      } else {
        bead.textContent = emoji;
      }
      // 给每个周期起点加圈强调
      if (i > 0 && i % 3 === 0) bead.classList.add("jw-bead--group");
      necklace.appendChild(bead);
    });
    wrap.appendChild(necklace);

    // 选项
    const opts = document.createElement("div");
    opts.className = "jw-opts";
    puzzle.choices.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "jw-choice";
      btn.style.setProperty("--jw-c", b.hex);
      btn.innerHTML = `${b.emoji}<span class="jw-choice__name">${b.name}</span>`;
      btn.addEventListener("click", () => this.choose(b, puzzle, btn));
      opts.appendChild(btn);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(b: Bead, puzzle: Puzzle, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (b.name === puzzle.answerName) {
      this.answered = true;
      const q = this.root.querySelector("#jw-q");
      if (q) {
        const answer = puzzle.choices.find(
          (c) => c.name === puzzle.answerName,
        )!;
        q.textContent = answer.emoji;
        (q as HTMLElement).style.setProperty("--jw-c", answer.hex);
        q.classList.remove("jw-bead--q");
        q.classList.add("jw-bead--done");
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
      }, 1100);
    } else {
      btn.classList.add("jw-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("jw-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "📿",
      variant: "rest",
      body: "看看珠子是按什么颜色顺序重复的，猜猜缺的那颗～",
      primary: { text: "继续", icon: "💎", onClick: () => ov.destroy() },
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
    if (document.getElementById("jw-style")) return;
    const st = document.createElement("style");
    st.id = "jw-style";
    st.textContent = JW_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function JW_CSS(theme: string): string {
  return `
.jw-wrap{display:flex;flex-direction:column;align-items:center;gap:26px;width:min(560px,100%);}
.jw-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.jw-necklace{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;padding:20px 18px 26px;background:linear-gradient(180deg,#fffbe6,#fff3c4);border-radius:50% 50% 22px 22px / 32% 32% 22px 22px;box-shadow:var(--shadow);max-width:520px;position:relative;}
.jw-necklace::before{content:'';position:absolute;inset:6px 10px auto 10px;height:54%;border:2px solid rgba(165,94,234,.25);border-radius:50% 50% 0 0 / 100% 100% 0 0;border-bottom:none;pointer-events:none;}
.jw-bead{width:50px;height:50px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,#fff0);box-shadow:inset 0 -3px 5px rgba(0,0,0,.18),0 2px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:1.7rem;z-index:1;}
.jw-bead--q{background:#fff3c4;border:3px dashed ${theme};color:${theme};font-size:1.8rem;font-weight:900;box-shadow:0 2px 4px rgba(0,0,0,.15);animation:jw-pulse 1.2s ease-in-out infinite;}
.jw-bead--group{outline:2px dotted rgba(165,94,234,.35);outline-offset:3px;}
.jw-bead--done{background:var(--jw-c,#fff);border:none;animation:jw-pop .4s ease;}
@keyframes jw-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@keyframes jw-pop{0%{transform:scale(.5) translateY(-8px)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.jw-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.jw-choice{width:72px;height:84px;border-radius:20px;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:2rem;cursor:pointer;transition:transform .12s;}
.jw-choice:active{transform:scale(.92);}
.jw-choice__name{font-size:.8rem;font-weight:900;color:var(--jw-c,#333);}
.jw-choice--wrong{animation:jw-shake .4s ease;}
@keyframes jw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.jw-bead{width:42px;height:42px;font-size:1.4rem;}.jw-choice{width:60px;height:72px;font-size:1.7rem;}}
`;
}

export function create(): JewelryGame {
  return new JewelryGame();
}
