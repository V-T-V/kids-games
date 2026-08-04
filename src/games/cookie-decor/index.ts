/* 饼干装饰 Cookie Decor —— 饼干上的装饰按规律排（如 巧克力豆-糖珠-巧克力豆-?），
   孩子找出规律，把缺的位置补上正确的装饰。
   独特点：规律推理（区别于 jewelry 的环形项链，这里是直线性、多个空位）。
   视觉：圆形饼干 + 装饰点环排 + 问号空位 + 装饰盘。
   难度=规律复杂度（周期 2 / 3 / 3 且空位数）。
   通关=补全目标轮数。前缀 ccd-。
   可解性：空位都位于周期已展示过至少一次之后，能由前文唯一推出。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Sprinkle {
  key: string;
  emoji: string;
  name: string;
  color: string;
}

const SPRINKLES: Sprinkle[] = [
  { key: "chip", emoji: "🟤", name: "巧克力豆", color: "#8d4925" },
  { key: "red", emoji: "🔴", name: "红豆", color: "#ff6348" },
  { key: "yellow", emoji: "🟡", name: "糖珠", color: "#ffd93d" },
  { key: "green", emoji: "🟢", name: "抹茶豆", color: "#6bcf7f" },
  { key: "pink", emoji: "🟣", name: "蜜桃豆", color: "#ff9ff3" },
  { key: "blue", emoji: "🔵", name: "蓝莓豆", color: "#4d96ff" },
];

interface Puzzle {
  /** 完整装饰序列（Sprinkle key） */
  full: string[];
  /** 显示用 Sprinkle（emoji / 缺位 '?'） */
  display: string[];
  /** 缺位的索引 */
  holes: number[];
  /** 每个空位对应的正确答案 key */
  answers: string[];
  /** 出现在序列里的 Sprinkle（用于装饰盘） */
  used: Sprinkle[];
  /** 干扰 Sprinkle */
  distractors: Sprinkle[];
}

/** 生成一道题：周期 period，总长 total，挖 holes 个空（都在已展示过周期的位置）。 */
function genPuzzle(diff: string): Puzzle {
  const period = diff === "easy" ? 4 : diff === "medium" ? 2 : 3;
  const total = diff === "easy" ? 6 : diff === "medium" ? 8 : 9;
  const holesCount = diff === "easy" ? 1 : diff === "medium" ? 2 : 2;

  const pool = shuffle([...SPRINKLES]).slice(0, period);
  const full: string[] = [];
  for (let i = 0; i < total; i++) full.push(pool[i % period]!.key);

  // 候选空位：必须 >= period（确保前面已经完整展示过一个周期）
  const candidates: number[] = [];
  for (let i = period; i < total; i++) candidates.push(i);
  const shuffled = shuffle(candidates);
  const holes = shuffled.slice(0, holesCount).sort((a, b) => a - b);
  const answers = holes.map((i) => full[i]!);

  const usedKeys = Array.from(new Set(full));
  const used = usedKeys
    .map((k) => SPRINKLES.find((s) => s.key === k)!)
    .filter(Boolean);
  const distractors = shuffle(
    SPRINKLES.filter((s) => !usedKeys.includes(s.key)),
  ).slice(0, 2);

  const display: string[] = full.map((k, i) =>
    holes.includes(i) ? "?" : used.find((s) => s.key === k)!.emoji,
  );

  return { full, display, holes, answers, used, distractors };
}

export class CookieDecorGame extends BaseGame {
  constructor() {
    super("cookie-decor");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private puzzle: Puzzle | null = null;
  private curPick: Sprinkle | null = null;
  private remaining = 0;

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
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.curPick = null;

    const puzzle = genPuzzle(this.difficulty);
    this.puzzle = puzzle;
    this.remaining = puzzle.holes.length;

    const wrap = document.createElement("div");
    wrap.className = "ccd-wrap";

    const task = document.createElement("div");
    task.className = "ccd-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 找出装饰的规律，把 <b>？</b> 位置补上正确的装饰 🍪`;
    wrap.appendChild(task);

    // 饼干
    const stage = document.createElement("div");
    stage.className = "ccd-stage";
    const cookie = document.createElement("div");
    cookie.className = "ccd-cookie";
    cookie.id = "ccd-cookie";
    puzzle.display.forEach((emoji, i) => {
      const dot = document.createElement("div");
      dot.className = "ccd-dot";
      if (emoji === "?") {
        dot.classList.add("ccd-dot--hole");
        dot.dataset.idx = String(i);
        dot.textContent = "？";
        dot.style.cursor = "pointer";
        dot.addEventListener("click", () => this.fill(i));
      } else {
        dot.classList.add("ccd-dot--set");
        dot.textContent = emoji;
      }
      cookie.appendChild(dot);
    });
    stage.appendChild(cookie);
    wrap.appendChild(stage);

    // 装饰盘（含答案 + 干扰）
    const palette = document.createElement("div");
    palette.className = "ccd-palette";
    const items = shuffle([...puzzle.used, ...puzzle.distractors]);
    for (const s of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ccd-pick";
      b.dataset.key = s.key;
      b.style.setProperty("--ccd-c", s.color);
      b.innerHTML = `<span class="ccd-pick__emoji">${s.emoji}</span><span class="ccd-pick__name">${s.name}</span>`;
      b.addEventListener("click", () => this.selectPick(s));
      palette.appendChild(b);
    }
    wrap.appendChild(palette);

    this.root.appendChild(wrap);
  }

  private selectPick(s: Sprinkle): void {
    this.curPick = s;
    sfxPop();
    this.root.querySelectorAll<HTMLButtonElement>(".ccd-pick").forEach((p) => {
      p.classList.toggle("ccd-pick--sel", p.dataset.key === s.key);
    });
  }

  private fill(i: number): void {
    if (!this.puzzle || !this.curPick) return;
    const holeIdx = this.puzzle.holes.indexOf(i);
    if (holeIdx < 0) return;
    const answer = this.puzzle.answers[holeIdx]!;
    if (this.curPick.key !== answer) {
      // 错
      const el = this.root.querySelector<HTMLElement>(
        `.ccd-dot[data-idx="${i}"]`,
      );
      el?.classList.remove("ccd-shake");
      void el?.offsetWidth;
      el?.classList.add("ccd-shake");
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    // 对
    this.remaining -= 1;
    const el = this.root.querySelector<HTMLElement>(
      `.ccd-dot[data-idx="${i}"]`,
    );
    if (el) {
      el.classList.remove("ccd-dot--hole");
      el.classList.add("ccd-dot--filled");
      el.textContent = this.curPick.emoji;
      el.style.background = this.curPick.color;
    }
    sfxPop();
    this.resetWrongStreak();
    if (el) {
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }
    if (this.remaining <= 0) {
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍪",
      variant: "rest",
      body: `看看前面的装饰是怎么重复的，猜猜？位置应该是哪个～ ${sample(["找规律真棒！", "再看一遍哦～"])}`,
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
    if (document.getElementById("ccd-style")) return;
    const st = document.createElement("style");
    st.id = "ccd-style";
    st.textContent = CCD_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function CCD_CSS(theme: string): string {
  return `
.ccd-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.ccd-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ccd-stage{display:flex;justify-content:center;}
.ccd-cookie{position:relative;width:min(360px,90%);padding:28px 20px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;background:radial-gradient(circle at 40% 35%,#e8b878,#c98a3a 75%);border-radius:50%;aspect-ratio:1/1;box-shadow:var(--shadow),inset 0 0 0 6px #a87a45,inset 0 -10px 20px rgba(120,72,20,.35);min-height:240px;}
.ccd-cookie::before{content:"";position:absolute;inset:14%;border-radius:50%;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.15),transparent 50%);pointer-events:none;}
.ccd-dot{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;font-size:1.5rem;font-weight:900;line-height:1;background:rgba(255,255,255,.2);box-shadow:inset 0 -2px 4px rgba(0,0,0,.2);z-index:2;transition:transform .12s;}
.ccd-dot--set{background:rgba(255,255,255,.35);filter:drop-shadow(0 2px 2px rgba(120,72,20,.3));}
.ccd-dot--hole{background:rgba(255,255,255,.7);color:${theme};border:3px dashed ${theme};font-size:1.3rem;cursor:pointer;}
.ccd-dot--hole:hover{transform:scale(1.1);}
.ccd-dot--filled{color:#fff;border:none;animation:ccd-pop .3s ease;}
@keyframes ccd-pop{0%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1)}}
.ccd-shake{animation:ccd-shake .4s ease;}
@keyframes ccd-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
.ccd-palette{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:460px;}
.ccd-pick{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:72px;padding:8px 6px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--ccd-c,#eee) 28%,#fff));box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:pointer;transition:transform .12s,box-shadow .12s;}
.ccd-pick:active{transform:translateY(3px);}
.ccd-pick--sel{transform:translateY(-5px) scale(1.1);box-shadow:0 8px 14px rgba(0,0,0,.25),0 0 0 3px #fff,0 0 0 6px var(--ccd-c);}
.ccd-pick__emoji{font-size:1.6rem;}
.ccd-pick__name{font-size:.74rem;font-weight:800;color:#555;}
@media (max-width:380px){.ccd-cookie{min-height:200px;padding:20px 14px;}.ccd-dot{width:40px;height:40px;font-size:1.3rem;}.ccd-pick{min-width:62px;}}
`;
}

export function create(): CookieDecorGame {
  return new CookieDecorGame();
}
