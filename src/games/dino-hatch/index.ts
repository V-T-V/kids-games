/* 恐龙蛋 Dino Hatch —— 大蛋孵大恐龙，小蛋孵小恐龙。把蛋和对应大小的恐龙配对。
   独特点：大小匹配认知。不同大小的蛋 + 不同大小的恐龙，按"大小一样"配对。
   玩法：点一个蛋选中（会发光），再点一个恐龙尝试配对；大小（rank）一致才算对。
         配对的会"孵化"消失。通关 = 配完目标轮数。
   解保证：蛋和恐龙各有相同的 size-rank 集合（一一对应），每个 rank 唯一。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const DINO_EMOJI = ["🦕", "🦖", "🦎", "🐊"] as const;

function pairCount(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 4 : diff === "medium" ? 3 : 4;
}
function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 4 : diff === "medium" ? 3 : 3;
}

/** 把 rank(0..n-1) 映射成视觉尺寸倍率。 */
function sizeForRank(rank: number, n: number): number {
  // 最小 0.65，最大 1.3，线性
  if (n <= 1) return 1;
  return 0.65 + (rank / (n - 1)) * 0.65;
}

export class DinoHatchGame extends BaseGame {
  constructor() {
    super("dino-hatch");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private pairs = 0;
  private eggs: { rank: number; el: HTMLButtonElement; matched: boolean }[] =
    [];
  private dinos: {
    rank: number;
    emoji: string;
    el: HTMLButtonElement;
    matched: boolean;
  }[] = [];
  private selectedEgg: number = -1; // eggs 数组索引
  private matchedCount = 0;

  protected mount(): void {
    this.roundTotal = roundTotal(this.difficulty);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.pairs = pairCount(this.difficulty);
    this.eggs = [];
    this.dinos = [];
    this.selectedEgg = -1;
    this.matchedCount = 0;

    // 蛋的 rank 集合 0..pairs-1；恐龙 emoji 各不同，rank 同集合
    const eggRanks = shuffle(Array.from({ length: this.pairs }, (_, i) => i));
    const dinoRanks = shuffle(Array.from({ length: this.pairs }, (_, i) => i));
    const dinoEmojis = shuffle([...DINO_EMOJI]).slice(0, this.pairs);

    const wrap = document.createElement("div");
    wrap.className = "dh-wrap";

    const task = document.createElement("div");
    task.className = "dh-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 大蛋配大恐龙，小蛋配小恐龙 🥚➡️🦕`;
    wrap.appendChild(task);

    // 蛋区
    const eggRow = document.createElement("div");
    eggRow.className = "dh-row dh-row--eggs";
    eggRow.id = "dh-eggs";
    eggRanks.forEach((rank) => {
      const e = document.createElement("button");
      e.type = "button";
      e.className = "dh-egg";
      const s = sizeForRank(rank, this.pairs);
      e.style.fontSize = `${2.2 * s}rem`;
      e.dataset.rank = String(rank);
      e.textContent = "🥚";
      e.addEventListener("click", () => this.pickEgg(rank, e));
      eggRow.appendChild(e);
      this.eggs.push({ rank, el: e, matched: false });
    });
    wrap.appendChild(eggRow);

    // 恐龙区
    const dinoRow = document.createElement("div");
    dinoRow.className = "dh-row dh-row--dinos";
    dinoRow.id = "dh-dinos";
    dinoRanks.forEach((rank, i) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "dh-dino";
      const s = sizeForRank(rank, this.pairs);
      d.style.fontSize = `${2.2 * s}rem`;
      d.dataset.rank = String(rank);
      d.textContent = dinoEmojis[i]!;
      d.addEventListener("click", () => this.pickDino(rank, d));
      dinoRow.appendChild(d);
      this.dinos.push({ rank, emoji: dinoEmojis[i]!, el: d, matched: false });
    });
    wrap.appendChild(dinoRow);

    this.root.appendChild(wrap);
  }

  private pickEgg(rank: number, el: HTMLButtonElement): void {
    // 已匹配的不能选
    const egg = this.eggs.find((e) => e.el === el);
    if (!egg || egg.matched) return;
    this.selectedEgg = rank;
    sfxPop();
    this.root
      .querySelectorAll<HTMLButtonElement>(".dh-egg")
      .forEach((b) => b.classList.remove("dh-egg--sel"));
    el.classList.add("dh-egg--sel");
  }

  private pickDino(rank: number, el: HTMLButtonElement): void {
    const dino = this.dinos.find((d) => d.el === el);
    if (!dino || dino.matched) return;
    if (this.selectedEgg < 0) {
      // 没选蛋，温柔提示
      el.classList.add("dh-shake");
      this.trackTimeout(() => el.classList.remove("dh-shake"), 400);
      return;
    }
    if (rank === this.selectedEgg) {
      // 配对成功
      const egg = this.eggs.find((e) => e.rank === rank && !e.matched);
      if (egg) {
        egg.matched = true;
        dino.matched = true;
        this.matchedCount += 1;
        egg.el.classList.add("dh-hatched");
        dino.el.classList.add("dh-hatched");
        sfxPop();
        const r = dino.el.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        this.selectedEgg = -1;
        if (this.matchedCount >= this.pairs) {
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 800);
        }
      }
    } else {
      // 大小不匹配
      el.classList.add("dh-shake");
      this.trackTimeout(() => el.classList.remove("dh-shake"), 400);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先看看蛋有多大，再找一个一样大的恐龙～",
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
    if (document.getElementById("dh-style")) return;
    const st = document.createElement("style");
    st.id = "dh-style";
    st.textContent = DH_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function DH_CSS(theme: string): string {
  return `
.dh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.dh-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.dh-row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:flex-end;padding:16px;background:rgba(255,255,255,.55);border-radius:20px;box-shadow:var(--shadow);width:min(400px,94%);min-height:90px;}
.dh-row--eggs{background:linear-gradient(160deg,#fff3d6,#ffe0a8);}
.dh-row--dinos{background:linear-gradient(160deg,#dff5df,#bfe8bf);}
.dh-egg,.dh-dino{background:none;border:none;cursor:pointer;line-height:1;padding:6px;filter:drop-shadow(0 3px 3px rgba(0,0,0,.2));transition:transform .12s,filter .15s;}
.dh-egg:hover,.dh-dino:hover{transform:translateY(-4px);}
.dh-egg:active,.dh-dino:active{transform:scale(.92);}
.dh-egg--sel{filter:drop-shadow(0 0 12px ${theme}) drop-shadow(0 3px 3px rgba(0,0,0,.2));animation:dh-bounce .6s ease-in-out infinite;}
@keyframes dh-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.dh-hatched{animation:dh-hatch .6s ease forwards;pointer-events:none;}
@keyframes dh-hatch{0%{transform:scale(1);opacity:1}40%{transform:scale(1.4) rotate(15deg);opacity:1}100%{transform:scale(0) rotate(40deg);opacity:0}}
.dh-shake{animation:dh-shake .4s ease;}
@keyframes dh-shake{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(-6px) rotate(-8deg)}75%{transform:translateX(6px) rotate(8deg)}}
@media (max-width:380px){.dh-row{gap:8px;padding:12px;}}
`;
}

export function create(): DinoHatchGame {
  return new DinoHatchGame();
}
