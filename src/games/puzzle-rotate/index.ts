/* 转转拼图 Puzzle Rotate —— 把每块旋转到正确方向，拼出完整图案。
   独特点：网格分块，点击旋转 90°，全部正确时整体高亮 + 图案完整。
   巧思：图案用大 emoji 平铺 + 每块裁剪显示，难度=块数（2x2 / 3x3）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Block {
  /** 当前旋转角度（0/90/180/270） */
  rot: number;
  el: HTMLDivElement;
}

export class PuzzleRotateGame extends BaseGame {
  constructor() {
    super("puzzle-rotate");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private grid = 2;
  private blocks: Block[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private gridSize(): number {
    return this.difficulty === "easy" ? 2 : 3;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.grid = this.gridSize();
    this.blocks = [];
    const emoji = sample([
      "⭐",
      "🍎",
      "🌈",
      "🐙",
      "🦋",
      "🌸",
      "🎈",
      "🚀",
      "🍕",
    ]);

    const wrap = document.createElement("div");
    wrap.className = "pr-wrap";

    const task = document.createElement("div");
    task.className = "pr-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 点每块转一转，拼回完整的图`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "pr-board";
    const n = this.grid;
    board.style.setProperty("--pr-n", String(n));

    const bg = `url("data:image/svg+xml;utf8,${svgFor(emoji)}")`;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const b = document.createElement("div");
        b.className = "pr-block";
        const rot = sample([90, 180, 270]);
        b.style.setProperty("--pr-rot", `${rot}deg`);
        // 背景平铺到整个拼图大小，用 position 显示该块对应区域
        b.style.backgroundImage = bg;
        b.style.backgroundSize = `${n * 100}% ${n * 100}%`;
        // position：让该块对应区域出现在视口
        const posX = n === 1 ? 50 : (c / (n - 1)) * 100;
        const posY = n === 1 ? 50 : (r / (n - 1)) * 100;
        b.style.backgroundPosition = `${posX}% ${posY}%`;
        b.addEventListener("click", () => this.rotate(b));
        board.appendChild(b);
        this.blocks.push({ rot, el: b });
      }
    }
    wrap.appendChild(board);

    const hint = document.createElement("div");
    hint.className = "pr-hint";
    hint.innerHTML = `参考图：<span class="pr-hint-emoji">${emoji}</span>`;
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  private rotate(el: HTMLDivElement): void {
    if (el.classList.contains("pr-block--done")) return;
    const block = this.blocks.find((b) => b.el === el);
    if (!block) return;
    block.rot = (block.rot + 90) % 360;
    el.style.setProperty("--pr-rot", `${block.rot}deg`);
    sfxPop();
    if (block.rot === 0) {
      el.classList.add("pr-block--done");
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
    }
    // 注意：旋转到中间角度（非 0）是必要的过程步骤，不计为答错，不扣星，
    // 也不触发休息护盾——否则孩子按最优解路径旋转仍会被罚。
    if (this.blocks.every((b) => b.rot === 0)) {
      this.root.querySelector(".pr-board")?.classList.add("pr-board--clear");
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("pr-style")) return;
    const st = document.createElement("style");
    st.id = "pr-style";
    st.textContent = PR_CSS(getCssVar("--c-blue"), getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

/** 把 emoji 包成大尺寸 SVG data-url，便于 CSS 平铺到网格区块。 */
function svgFor(emoji: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><text x='50%' y='50%' font-size='220' text-anchor='middle' dominant-baseline='central'>${emoji}</text></svg>`;
  return encodeURIComponent(svg);
}

function PR_CSS(theme: string, glow: string): string {
  return `
.pr-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(420px,100%);}
.pr-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pr-board{display:grid;grid-template-columns:repeat(var(--pr-n,2),1fr);gap:4px;padding:6px;background:#fff;border-radius:20px;box-shadow:var(--shadow);width:min(320px,80vw);height:min(320px,80vw);position:relative;transition:box-shadow .4s;}
.pr-board--clear{box-shadow:0 0 0 6px ${glow},0 0 30px ${glow};animation:pr-glow 1s ease;}
@keyframes pr-glow{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}
.pr-block{border-radius:6px;overflow:hidden;cursor:pointer;background-color:#eee;transform:rotate(var(--pr-rot,0deg));transition:transform .25s cubic-bezier(.4,1.4,.5,1);box-shadow:inset 0 0 0 2px rgba(255,255,255,.4);}
.pr-block:active{filter:brightness(1.1);}
.pr-block--done{box-shadow:inset 0 0 0 3px ${theme};}
.pr-hint{font-size:1rem;font-weight:700;color:#555;background:rgba(255,255,255,.7);padding:6px 16px;border-radius:999px;}
.pr-hint-emoji{font-size:1.6rem;vertical-align:middle;}
@media (max-width:380px){.pr-board{width:min(280px,80vw);height:min(280px,80vw);}}
`;
}

export function create(): PuzzleRotateGame {
  return new PuzzleRotateGame();
}
