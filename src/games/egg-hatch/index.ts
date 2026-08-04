/* 破壳配对 Egg Hatch —— 把蛋和它孵出的小动物配对。
   独特点：蛋的花纹和动物一一对应（斑点蛋→斑点狗、条纹蛋→斑马），
   配对成功时蛋裂开孵化动画。
   巧思：对数随难度增加，干扰项变多。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Pair {
  /** 蛋的样式 key（决定花纹） */
  pattern: "spot" | "stripe" | "star" | "heart" | "wave";
  /** 蛋主色 */
  color: string;
  /** 孵出的动物 emoji */
  animal: string;
  /** 动物名 */
  name: string;
}

const PAIRS: Pair[] = [
  { pattern: "spot", color: "#fff8e7", animal: "🐶", name: "小狗" },
  { pattern: "stripe", color: "#fff3e0", animal: "🦓", name: "斑马" },
  { pattern: "star", color: "#fffbe6", animal: "🐥", name: "小鸡" },
  { pattern: "heart", color: "#ffe4ec", animal: "🐰", name: "小兔" },
  { pattern: "wave", color: "#e6f7ff", animal: "🐢", name: "乌龟" },
];

export class EggHatchGame extends BaseGame {
  constructor() {
    super("egg-hatch");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private matched = 0;
  private pairs: Pair[] = [];
  private selectedEgg: HTMLElement | null = null;
  private selectedKey: string | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private pairCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.selectedEgg = null;
    this.selectedKey = null;
    this.matched = 0;

    // 选取本轮的对
    this.pairs = shuffle(PAIRS).slice(0, this.pairCount());

    const wrap = document.createElement("div");
    wrap.className = "eh-wrap";

    const task = document.createElement("div");
    task.className = "eh-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 点蛋再点它的小动物，让蛋破壳`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "eh-board";

    // 左：蛋
    const eggCol = document.createElement("div");
    eggCol.className = "eh-col";
    const eggTitle = document.createElement("div");
    eggTitle.className = "eh-col-title";
    eggTitle.textContent = "蛋";
    eggCol.appendChild(eggTitle);
    const eggs = shuffle(this.pairs);
    for (const p of eggs) {
      const e = document.createElement("button");
      e.type = "button";
      e.className = "eh-egg";
      e.dataset.key = `${p.pattern}-${p.animal}`;
      e.style.setProperty("--eh-color", p.color);
      e.innerHTML = `<span class="eh-egg-shell"></span><span class="eh-egg-pattern eh-pattern-${p.pattern}"></span>`;
      e.addEventListener("click", () => this.pickEgg(e, p));
      eggCol.appendChild(e);
    }
    board.appendChild(eggCol);

    // 右：动物
    const aniCol = document.createElement("div");
    aniCol.className = "eh-col";
    const aniTitle = document.createElement("div");
    aniTitle.className = "eh-col-title";
    aniTitle.textContent = "小动物";
    aniCol.appendChild(aniTitle);
    for (const p of shuffle(this.pairs)) {
      const a = document.createElement("button");
      a.type = "button";
      a.className = "eh-animal";
      a.dataset.key = `${p.pattern}-${p.animal}`;
      a.innerHTML = `<span class="eh-animal-emoji">${p.animal}</span>`;
      a.addEventListener("click", () => this.pickAnimal(a, p));
      aniCol.appendChild(a);
    }
    board.appendChild(aniCol);

    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private pickEgg(el: HTMLElement, p: Pair): void {
    if (el.classList.contains("eh-egg--matched")) return;
    // 切换选中
    this.root
      .querySelectorAll(".eh-egg--selected")
      .forEach((n) => n.classList.remove("eh-egg--selected"));
    el.classList.add("eh-egg--selected");
    this.selectedEgg = el;
    this.selectedKey = `${p.pattern}-${p.animal}`;
    sfxPop();
  }

  private pickAnimal(el: HTMLElement, p: Pair): void {
    if (el.classList.contains("eh-animal--matched")) return;
    if (!this.selectedEgg || !this.selectedKey) {
      // 没选蛋先点动物：温和提示，算轻微错误
      this.onWrongShake(el);
      return;
    }
    const key = `${p.pattern}-${p.animal}`;
    const egg = this.selectedEgg;
    if (key === this.selectedKey) {
      // 配对成功
      sfxPop();
      egg.classList.remove("eh-egg--selected");
      egg.classList.add("eh-egg--matched", "eh-egg--crack");
      el.classList.add("eh-animal--matched");
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.matched += 1;
      this.selectedEgg = null;
      this.selectedKey = null;
      if (this.matched >= this.pairs.length) {
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 900);
      }
    } else {
      this.onWrongShake(el);
      egg.classList.remove("eh-egg--selected");
      this.selectedEgg = null;
      this.selectedKey = null;
    }
  }

  private onWrongShake(el: HTMLElement): void {
    el.classList.add("eh-shake");
    this.trackTimeout(() => el.classList.remove("eh-shake"), 500);
    const paused = this.onWrong();
    if (paused) this.showRest();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先看看蛋的花纹，再找对应的小动物吧～",
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
    if (document.getElementById("eh-style")) return;
    const st = document.createElement("style");
    st.id = "eh-style";
    st.textContent = EH_CSS(
      getCssVar("--c-orange"),
      getCssVar("--c-pink"),
      getCssVar("--c-yellow"),
    );
    document.head.appendChild(st);
  }
}

function EH_CSS(theme: string, accent: string, glow: string): string {
  return `
.eh-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.eh-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.eh-board{display:flex;gap:24px;justify-content:center;width:100%;flex-wrap:wrap;}
.eh-col{display:flex;flex-direction:column;align-items:center;gap:12px;flex:1;min-width:200px;max-width:260px;}
.eh-col-title{font-size:1rem;font-weight:800;color:${theme};background:rgba(255,255,255,.7);padding:4px 18px;border-radius:999px;}
.eh-egg{position:relative;width:80px;height:100px;border:none;cursor:pointer;background:transparent;transition:transform .15s;}
.eh-egg:active{transform:scale(.92);}
.eh-egg-shell{position:absolute;inset:0;background:radial-gradient(ellipse at 35% 30%,#fff,var(--eh-color,#fff8e7));border-radius:50% 50% 48% 48%/55% 55% 45% 45%;box-shadow:inset 0 -6px 10px rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.18);overflow:hidden;}
.eh-egg-pattern{position:absolute;inset:0;border-radius:inherit;opacity:.9;pointer-events:none;}
.eh-pattern-spot{background:radial-gradient(circle at 30% 35%,${theme} 5px,transparent 6px),radial-gradient(circle at 65% 30%,${theme} 6px,transparent 7px),radial-gradient(circle at 50% 60%,${theme} 7px,transparent 8px),radial-gradient(circle at 25% 70%,${theme} 5px,transparent 6px),radial-gradient(circle at 75% 65%,${theme} 5px,transparent 6px);}
.eh-pattern-stripe{background:repeating-linear-gradient(135deg,transparent 0 10px,${theme} 10px 16px);}
.eh-pattern-star{background:radial-gradient(circle at 50% 40%,${glow} 4px,transparent 5px),radial-gradient(circle at 30% 65%,${glow} 4px,transparent 5px),radial-gradient(circle at 70% 65%,${glow} 4px,transparent 5px);font-size:1rem;}
.eh-pattern-heart{background:radial-gradient(circle at 40% 45%,${accent} 5px,transparent 6px),radial-gradient(circle at 60% 45%,${accent} 5px,transparent 6px);}
.eh-pattern-wave{background:repeating-radial-gradient(circle at 50% 100%,transparent 0 12px,${theme} 12px 14px);}
.eh-egg--selected .eh-egg-shell{box-shadow:inset 0 -6px 10px rgba(0,0,0,.12),0 0 0 4px ${theme},0 6px 14px rgba(0,0,0,.2);animation:eh-bounce .6s ease infinite;}
@keyframes eh-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.eh-egg--crack .eh-egg-shell{animation:eh-crack .8s ease forwards;}
@keyframes eh-crack{0%{transform:scale(1)}30%{transform:scale(1.1) rotate(-3deg)}60%{transform:scale(1.05) rotate(3deg);filter:brightness(1.2)}100%{transform:scale(.4);opacity:0;filter:brightness(1.5)}}
.eh-egg--matched{pointer-events:none;}
.eh-egg--matched .eh-egg-shell{opacity:0;}
.eh-animal{width:80px;height:100px;border:none;cursor:pointer;background:rgba(255,255,255,.7);border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);transition:transform .15s;}
.eh-animal:active{transform:scale(.92);}
.eh-animal--matched{background:linear-gradient(135deg,${glow},${theme});animation:eh-pop .6s ease;}
@keyframes eh-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.eh-animal-emoji{font-size:3rem;filter:drop-shadow(0 4px 6px rgba(0,0,0,.2));}
.eh-shake{animation:eh-shake .5s ease;}
@keyframes eh-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@media (max-width:380px){.eh-egg,.eh-animal{width:64px;height:84px;}.eh-animal-emoji{font-size:2.4rem;}.eh-col{min-width:140px;}}
`;
}

export function create(): EggHatchGame {
  return new EggHatchGame();
}
