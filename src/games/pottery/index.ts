/* 陶艺 Pottery —— 展示一个目标陶罐的形状（高矮胖瘦、瓶口样式），
   孩子从几个选项里选出和目标一模一样形状的那个。
   独特点：形状辨识/视觉细节辨别，陶罐用 SVG 参数化生成（轮廓 + 釉色）。
   视觉：目标陶罐 + 几个候选陶罐。难度=候选相似度。
   通关=选对目标轮数。前缀 pt2-（避免与 pizza-top 冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 陶罐形状参数：决定轮廓。 */
interface Pot {
  /** 整体宽高比（0.6 细高 ~ 1.3 矮胖） */
  ratio: number;
  /** 肚子位置（0.4~0.7） */
  belly: number;
  /** 瓶口样式：直口/喇叭口/小口 */
  mouth: "straight" | "flare" | "narrow";
  /** 釉色 */
  color: string;
}

const COLORS = ["#b08968", "#c08552", "#a07050", "#9c6b4a", "#bda06a"];

/** 判断两个 Pot 是否形状相同（颜色可不同/相同都算——我们要求形状一致）。
 *  这里题目要求"一模一样形状"，所以只比形状参数。 */
function sameShape(a: Pot, b: Pot): boolean {
  return a.ratio === b.ratio && a.belly === b.belly && a.mouth === b.mouth;
}

/** 把 Pot 渲染成 SVG 字符串。viewBox 固定，用参数算关键控制点。 */
function potSVG(p: Pot, uid: string): string {
  const w = 100;
  const h = 120;
  // 中心 x
  const cx = w / 2;
  // 肚子 y（越大越靠下）
  const bellyY = 18 + p.belly * 70; // 46~67
  // 肚子最宽半径，受 ratio 影响（胖→大）
  const bellyR = 16 + p.ratio * 22; // ~26~45
  const topR =
    p.mouth === "flare"
      ? bellyR * 0.7
      : p.mouth === "narrow"
        ? bellyR * 0.28
        : bellyR * 0.45;
  const botR = bellyR * 0.5;
  const topY = 10;
  const botY = h - 12;
  // 颈部高度（小口更短）
  const neckY = p.mouth === "narrow" ? bellyY - 30 : bellyY - 22;

  const grad = `pt2g${uid}`;
  const path = [
    `M ${cx - topR} ${topY}`,
    // 左侧脖子到肚子
    `C ${cx - topR} ${neckY}, ${cx - bellyR} ${neckY + 8}, ${cx - bellyR} ${bellyY}`,
    // 肚子到底
    `C ${cx - bellyR} ${bellyY + 30}, ${cx - botR} ${botY - 6}, ${cx - botR} ${botY}`,
    `L ${cx + botR} ${botY}`,
    `C ${cx + botR} ${botY - 6}, ${cx + bellyR} ${bellyY + 30}, ${cx + bellyR} ${bellyY}`,
    // 右侧肚子到脖子
    `C ${cx + bellyR} ${neckY + 8}, ${cx + topR} ${neckY}, ${cx + topR} ${topY}`,
    "Z",
  ].join(" ");
  // 瓶口椭圆（顶面）
  const mouthEllipse = `<ellipse cx="${cx}" cy="${topY}" rx="${topR}" ry="3.2" fill="rgba(0,0,0,.28)"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" class="pt2-svg" aria-hidden="true">
    <defs><linearGradient id="${grad}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.color}" stop-opacity=".75"/>
      <stop offset="0.45" stop-color="${p.color}"/>
      <stop offset="1" stop-color="${p.color}" stop-opacity=".7"/>
    </linearGradient></defs>
    <path d="${path}" fill="url(#${grad})" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
    ${mouthEllipse}
    <ellipse cx="${cx - bellyR * 0.5}" cy="${bellyY}" rx="${bellyR * 0.25}" ry="${bellyR * 0.5}" fill="#fff" opacity=".18"/>
  </svg>`;
}

/** 随机生成一个 Pot。 */
function randomPot(): Pot {
  const ratios = [0.6, 0.85, 1.1, 1.3];
  const bellies = [0.4, 0.52, 0.62];
  const mouths: Pot["mouth"][] = ["straight", "flare", "narrow"];
  const r = ratios[Math.floor(Math.random() * ratios.length)]!;
  const b = bellies[Math.floor(Math.random() * bellies.length)]!;
  const m = mouths[Math.floor(Math.random() * mouths.length)]!;
  return {
    ratio: r,
    belly: b,
    mouth: m,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
  };
}

export class PotteryGame extends BaseGame {
  constructor() {
    super("pottery");
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

  /** 候选数 + 1 个正确，共 choices。难度越高干扰越像。 */
  private choiceCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 生成目标 + 候选（保证形状唯一可辨：每个候选形状互不相同，正确答案 = 目标形状）
    const target = randomPot();
    const n = this.choiceCount();
    const choices: Pot[] = [{ ...target }];
    let guard = 0;
    while (choices.length < n && guard < 200) {
      guard += 1;
      const cand = randomPot();
      // 与已有任一形状相同则跳过（保证干扰项彼此不同）
      if (choices.some((c) => sameShape(c, cand))) continue;
      choices.push(cand);
    }
    const shuffled = shuffle(choices);

    const wrap = document.createElement("div");
    wrap.className = "pt2-wrap";

    const task = document.createElement("div");
    task.className = "pt2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 看<b>左边陶罐</b>的样子，从下面选一个<b>一模一样</b>的 🏺`;
    wrap.appendChild(task);

    // 目标展示
    const targetBox = document.createElement("div");
    targetBox.className = "pt2-target";
    targetBox.innerHTML = `<div class="pt2-label">这个样子</div>${potSVG(target, "target")}`;
    wrap.appendChild(targetBox);

    // 候选项
    const opts = document.createElement("div");
    opts.className = "pt2-opts";
    shuffled.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pt2-choice";
      b.innerHTML = potSVG(p, `c${i}`);
      b.addEventListener("click", () => this.choose(p, target, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(p: Pot, target: Pot, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (sameShape(p, target)) {
      this.answered = true;
      btn.classList.add("pt2-choice--right");
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
      }, 900);
    } else {
      btn.classList.add("pt2-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("pt2-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🏺",
      variant: "rest",
      body: "比一比陶罐的胖瘦和高矮，再看瓶口的形状，找一模一样的～",
      primary: { text: "继续", icon: "🏺", onClick: () => ov.destroy() },
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
    if (document.getElementById("pt2-style")) return;
    const st = document.createElement("style");
    st.id = "pt2-style";
    st.textContent = PT2_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function PT2_CSS(theme: string): string {
  return `
.pt2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.pt2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pt2-task b{color:${theme};}
.pt2-target{display:flex;flex-direction:column;align-items:center;gap:6px;background:linear-gradient(180deg,#fff8ee,#ffe9c7);border-radius:20px;box-shadow:var(--shadow);padding:14px 24px;}
.pt2-label{font-size:.95rem;font-weight:900;color:#7a5a3a;}
.pt2-svg{width:120px;height:144px;display:block;filter:drop-shadow(0 4px 6px rgba(0,0,0,.18));}
.pt2-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:16px;background:rgba(255,255,255,.7);border-radius:22px;box-shadow:var(--shadow);max-width:540px;}
.pt2-choice{width:104px;height:144px;border-radius:18px;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s;padding:6px;}
.pt2-choice:active{transform:scale(.93);}
.pt2-choice .pt2-svg{width:88px;height:120px;}
.pt2-choice--right{outline:4px solid #6bcf7f;outline-offset:2px;animation:pt2-pop .4s ease;}
.pt2-choice--wrong{animation:pt2-shake .4s ease;}
@keyframes pt2-pop{0%{transform:scale(.85)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes pt2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.pt2-svg{width:100px;height:120px;}.pt2-choice{width:88px;height:124px;}.pt2-choice .pt2-svg{width:74px;height:104px;}}
`;
}

export function create(): PotteryGame {
  return new PotteryGame();
}
