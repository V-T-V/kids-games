/* 鱼群分组 Fish School —— 一群鱼要分成「每组 N 条」，孩子数出共几组。
   独特点：鱼按组分隔摆放，先圈再数，理解「包含除法」的直观含义。
   视觉：鱼 emoji 分组排列，组与组之间有间隔。难度=鱼数/每组数。
   通关=答对目标轮数。巧思：鱼数永远是每组数的整数倍（确保有解）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

const FISH = ["🐟", "🐠", "🐡", "🐙"];

const ENCOURAGE = [
  "数得真对！",
  "一组一组圈起来数～",
  "真厉害！",
  "你找到答案啦！",
];

export class FishSchoolGame extends BaseGame {
  constructor() {
    super("fish-school");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answer = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 每组鱼数（被除数分母） */
  private groupSize(): number {
    if (this.difficulty === "easy") return 2;
    if (this.difficulty === "medium") return 3;
    return randInt(2, 4);
  }
  /** 组数（答案区间） */
  private groupRange(): [number, number] {
    if (this.difficulty === "easy") return [2, 4];
    if (this.difficulty === "medium") return [2, 5];
    return [3, 6];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const per = this.groupSize();
    const [glo, ghi] = this.groupRange();
    const groups = randInt(glo, ghi);
    const total = per * groups;
    this.answer = groups;
    const fishEmoji = sample(FISH);

    /* 选项：正确答案 + 3 个邻近干扰（去重、>0） */
    const opts = new Set<number>([groups]);
    let guard = 0;
    while (opts.size < 4 && guard < 50) {
      guard += 1;
      const delta = sample([-2, -1, 1, 2, 3]);
      const v = groups + delta;
      if (v >= 1 && v <= 10) opts.add(v);
    }
    let fill = 1;
    while (opts.size < 4) {
      if (!opts.has(fill)) opts.add(fill);
      fill += 1;
    }

    const wrap = document.createElement("div");
    wrap.className = "fs-wrap";

    const task = document.createElement("div");
    task.className = "fs-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 把鱼 <b>每 ${per} 条</b> 圈成一组，一共 <b>几组</b>？`;
    wrap.appendChild(task);

    /* 鱼群摆放区：每组内紧凑，组间明显间隔，帮助「分组」可视化 */
    const sea = document.createElement("div");
    sea.className = "fs-sea";
    for (let g = 0; g < groups; g++) {
      const grp = document.createElement("div");
      grp.className = "fs-group";
      for (let i = 0; i < per; i++) {
        const f = document.createElement("span");
        f.className = "fs-fish";
        f.textContent = fishEmoji;
        f.style.setProperty("--fs-d", `${randInt(0, 240)}ms`);
        grp.appendChild(f);
      }
      sea.appendChild(grp);
    }
    wrap.appendChild(sea);

    /* 选项 */
    const optsEl = document.createElement("div");
    optsEl.className = "fs-options";
    shuffle([...opts]).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fs-option";
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(b, v));
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    void total;
    this.root.appendChild(wrap);
  }

  private choose(btn: HTMLButtonElement, value: number): void {
    if (this.locked) return;
    if (value === this.answer) {
      this.locked = true;
      btn.classList.add("fs-option--right");
      /* 给每组加圈圈高亮，强化「分组」概念 */
      this.root
        .querySelectorAll(".fs-group")
        .forEach((g) => g.classList.add("fs-group--done"));
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("fs-option--wrong");
      this.trackTimeout(() => btn.classList.remove("fs-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🐟",
      variant: "rest",
      body: `先几个几个圈成一组，再数一共几组。${sample(ENCOURAGE)}`,
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
    if (document.getElementById("fs-style")) return;
    const st = document.createElement("style");
    st.id = "fs-style";
    st.textContent = FS_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function FS_CSS(theme: string): string {
  return `
.fs-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.fs-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.fs-sea{display:flex;flex-wrap:wrap;gap:22px 20px;justify-content:center;padding:24px 18px;background:linear-gradient(180deg,#bfe9ff,#7cc8ff);border-radius:26px;box-shadow:var(--shadow);max-width:480px;min-height:120px;}
.fs-group{display:flex;gap:2px;padding:8px 10px;background:rgba(255,255,255,.35);border-radius:18px;border:2px dashed rgba(255,255,255,.6);transition:all .3s;}
.fs-group--done{background:rgba(255,236,150,.55);border-color:#ffd93d;transform:scale(1.04);box-shadow:0 0 0 3px rgba(255,217,61,.4);}
.fs-fish{font-size:2.1rem;line-height:1;display:inline-block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.2));animation:fs-swim 2.4s ease-in-out infinite;animation-delay:var(--fs-d,0ms);}
@keyframes fs-swim{0%,100%{transform:translateY(0) rotate(-2deg);}50%{transform:translateY(-4px) rotate(2deg);}}
.fs-options{display:flex;gap:14px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.fs-option{min-width:72px;height:72px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,${theme}33);font-size:2rem;font-weight:900;color:#333;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.12);transition:transform .1s;}
.fs-option:active{transform:translateY(3px);}
.fs-option--right{background:linear-gradient(180deg,#bff0c1,#6bcf7f);color:#1d6b2c;animation:fs-bounce .5s ease;}
.fs-option--wrong{background:linear-gradient(180deg,#ffd0c4,#ff8a72);animation:fs-shake .5s ease;}
@keyframes fs-bounce{0%,100%{transform:scale(1)}40%{transform:scale(1.18)}}
@keyframes fs-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.fs-fish{font-size:1.7rem;}.fs-sea{gap:16px 14px;}.fs-option{min-width:60px;height:62px;font-size:1.6rem;}}
`;
}

export function create(): FishSchoolGame {
  return new FishSchoolGame();
}
