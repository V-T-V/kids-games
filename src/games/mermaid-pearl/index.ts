/* 美人鱼珍珠 Mermaid Pearl —— 一条珍珠项链按颜色规律排列（如红蓝红蓝红?），
   缺一颗珍珠，孩子从选项里挑对颜色的珍珠补上。
   独特点：颜色规律识别 + 项链视觉。难度=规律周期长度。
   视觉：弧形项链上挂彩色珍珠 + 问号占位 + 圆形珍珠选项。
   通关=补对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 珍珠：颜色名（用于无障碍） + 颜色值。 */
const PEARL_COLORS = [
  { name: "粉", color: "#ff6b9d" },
  { name: "蓝", color: "#4d96ff" },
  { name: "黄", color: "#ffd93d" },
  { name: "绿", color: "#6bcf7f" },
  { name: "紫", color: "#a55eea" },
  { name: "橙", color: "#ff9f43" },
] as const;

interface Puzzle {
  /** 序列：每个元素是 PEARL_COLORS 的下标，缺位用 -1 表示 */
  seq: number[];
  /** 缺失位的索引 */
  qIdx: number;
  /** 正确答案（PEARL_COLORS 下标） */
  answer: number;
  /** 选项（PEARL_COLORS 下标） */
  choices: number[];
}

/** 生成一道规律题：周期 period，长度 total，挖一个空。 */
function genPuzzle(diff: string): Puzzle {
  const period = diff === "easy" ? 4 : diff === "medium" ? 3 : 3;
  const total = diff === "easy" ? 5 : diff === "medium" ? 7 : 8;
  const pool = shuffle(PEARL_COLORS).slice(0, period);
  const base = pool.map((_, i) => PEARL_COLORS.indexOf(pool[i]!));
  // 拼 total 长
  const full: number[] = [];
  for (let i = 0; i < total; i++) full.push(base[i % period]!);
  // 挖空位置：选后半段保证规律可推断
  const qIdx = Math.floor(total / 2) + (diff === "easy" ? 0 : 1);
  const answer = full[qIdx]!;
  full[qIdx] = -1;
  // 干扰项：从其它颜色里取
  const distract: number[] = [];
  const others = shuffle(PEARL_COLORS.map((_, i) => i)).filter(
    (i) => !base.includes(i),
  );
  for (const d of others) {
    if (distract.length >= 3) break;
    if (d !== answer) distract.push(d);
  }
  // 兜底
  while (distract.length < 3) {
    const r = Math.floor(Math.random() * PEARL_COLORS.length);
    if (r !== answer && !distract.includes(r)!) distract.push(r);
  }
  return { seq: full, qIdx, answer, choices: shuffle([answer, ...distract]) };
}

export class MermaidPearlGame extends BaseGame {
  constructor() {
    super("mermaid-pearl");
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
    /* DOM 由基类清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const puzzle = genPuzzle(this.difficulty);

    const wrap = document.createElement("div");
    wrap.className = "mmp-wrap";

    const task = document.createElement("div");
    task.className = "mmp-task";
    task.innerHTML = `项链缺一颗珍珠，<b>？</b>处该放哪种颜色？<br><span class="mmp-hint">第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    // 美人鱼 + 项链
    const stage = document.createElement("div");
    stage.className = "mmp-stage";
    const mermaid = document.createElement("div");
    mermaid.className = "mmp-mermaid";
    mermaid.textContent = "🧜";
    stage.appendChild(mermaid);

    const necklace = document.createElement("div");
    necklace.className = "mmp-necklace";
    necklace.id = "mmp-necklace";
    puzzle.seq.forEach((c, i) => {
      const bead = document.createElement("div");
      bead.className = "mmp-bead";
      if (c === -1) {
        bead.classList.add("mmp-bead--q");
        bead.id = "mmp-q";
        bead.textContent = "？";
        bead.setAttribute("aria-label", "缺失的珍珠");
      } else {
        const pc = PEARL_COLORS[c]!;
        bead.style.setProperty("--bead", pc.color);
        bead.setAttribute("aria-label", `${pc.name}珍珠`);
        bead.style.setProperty("--delay", `${i * 0.05}s`);
      }
      necklace.appendChild(bead);
    });
    stage.appendChild(necklace);
    wrap.appendChild(stage);

    // 选项珍珠
    const opts = document.createElement("div");
    opts.className = "mmp-opts";
    puzzle.choices.forEach((c) => {
      const pc = PEARL_COLORS[c]!;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mmp-choice";
      b.style.setProperty("--bead", pc.color);
      b.setAttribute("aria-label", `${pc.name}珍珠`);
      b.addEventListener("click", () => this.choose(c, puzzle.answer, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(c: number, answer: number, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (c === answer) {
      this.answered = true;
      const q = this.root.querySelector<HTMLElement>("#mmp-q");
      if (q) {
        const pc = PEARL_COLORS[c]!;
        q.textContent = "";
        q.classList.remove("mmp-bead--q");
        q.classList.add("mmp-bead--done");
        q.style.setProperty("--bead", pc.color);
      }
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("mmp-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("mmp-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看珍珠是按什么颜色顺序重复的，找出下一个～",
      primary: { text: "继续", icon: "🧜", onClick: () => ov.destroy() },
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
    if (document.getElementById("mmp-style")) return;
    const st = document.createElement("style");
    st.id = "mmp-style";
    st.textContent = MMP_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function MMP_CSS(theme: string): string {
  return `
.mmp-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(560px,100%);}
.mmp-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.mmp-task b{color:${theme};font-size:1.4rem;}
.mmp-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.mmp-stage{position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 12px 26px;background:linear-gradient(180deg,#d6f3ff 0%,#bfe8f5 60%,#a8dde9 100%);border-radius:24px;box-shadow:var(--shadow-lg);overflow:hidden;}
.mmp-stage::before{content:"";position:absolute;inset:auto 0 0 0;height:46%;background:repeating-linear-gradient(180deg,rgba(255,255,255,.45) 0 8px,transparent 8px 16px);animation:mmp-wave 5s linear infinite;}
@keyframes mmp-wave{from{background-position:0 0}to{background-position:32px 0}}
.mmp-mermaid{position:relative;font-size:3rem;z-index:2;filter:drop-shadow(0 4px 6px rgba(0,0,0,.2));animation:mmp-float 3s ease-in-out infinite;}
@keyframes mmp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.mmp-necklace{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;padding:12px 16px;background:linear-gradient(180deg,#fff9,#ffffffd9);border-radius:22px;box-shadow:var(--shadow);max-width:100%;}
.mmp-necklace::after{content:"";position:absolute;left:12px;right:12px;top:50%;height:3px;background:linear-gradient(90deg,#d4a056,#b8893d);border-radius:2px;transform:translateY(-2px);z-index:0;}
.mmp-bead{position:relative;z-index:1;width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9,var(--bead,${theme}));box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 3px 6px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:${theme};animation:mmp-drop .4s ease backwards;animation-delay:var(--delay,0s);}
@keyframes mmp-drop{0%{transform:translateY(-14px) scale(.6);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
.mmp-bead--q{background:#fff3c4;border:3px dashed ${theme};animation:mmp-pulse 1.4s ease-in-out infinite;}
@keyframes mmp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.mmp-bead--done{animation:mmp-pop .5s ease;}
@keyframes mmp-pop{0%{transform:scale(.5)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.mmp-opts{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;}
.mmp-choice{width:66px;height:66px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#fff9,var(--bead,${theme}));box-shadow:inset 0 -5px 8px rgba(0,0,0,.18),var(--shadow);cursor:pointer;transition:transform .12s ease;}
.mmp-choice:active{transform:scale(.92);}
.mmp-choice--wrong{animation:mmp-shake .4s ease;}
@keyframes mmp-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.mmp-bead{width:38px;height:38px;}.mmp-choice{width:56px;height:56px;}}
`;
}

export function create(): MermaidPearlGame {
  return new MermaidPearlGame();
}
