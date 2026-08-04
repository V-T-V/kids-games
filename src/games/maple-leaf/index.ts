/* 枫叶找同 Maple Leaf —— 几片颜色/大小/纹路不同的枫叶，
   找出两片完全相同的。点第一片再点第二片配对。
   独特点：观察力 + 属性辨识（颜色+大小+斑点）。
   视觉：渐变秋日背景 + 枫叶 emoji 配 CSS 属性（色调/缩放/斑点装饰）。
   巧思：每轮保证恰好有一对相同，其余互不相同；找对后两片一起飞走。
   难度 = 叶子总数。通关 = 找对目标轮数。
   前缀 mlf-（ml- 已被 more-less 占用，避免冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample, randInt } from "../../lobby/util.ts";

interface LeafKind {
  /** 组合 key，唯一标识"长相" */
  key: string;
  hue: number; // 色相
  size: number; // 缩放
  /** 0/1/2 颗斑点 */
  spots: number;
  /** 旋转角度 */
  rot: number;
}

export class MapleLeafGame extends BaseGame {
  constructor() {
    super("maple-leaf");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private picked: number | null = null;
  private locked = false;
  private leafEls: HTMLButtonElement[] = [];
  private kinds: LeafKind[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 与 timer 由基类清理 */
  }

  private count(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  /** 生成叶子集：保证恰好一对相同，其余各不相同。 */
  private genKinds(n: number): LeafKind[] {
    const pool: LeafKind[] = [];
    const usedKeys = new Set<string>();
    const make = (): LeafKind => {
      // 最多尝试 20 次生成不重复 key
      for (let i = 0; i < 20; i++) {
        const hue = sample([18, 32, 48, 8, 0, 60]); // 红/橙/黄系
        const size = sample([0.8, 1.0, 1.2]);
        const spots = randInt(0, 2);
        const rot = sample([-12, 0, 12, 8, -8]);
        const key = `${hue}-${size}-${spots}-${rot}`;
        if (!usedKeys.has(key)) {
          usedKeys.add(key);
          return { key, hue, size, spots, rot };
        }
      }
      // 兜底：随机但可能重复（极少触发）
      const hue = randInt(0, 60);
      const size = sample([0.8, 1.0, 1.2]);
      const spots = randInt(0, 2);
      const rot = randInt(-15, 15);
      const key = `${hue}-${size}-${spots}-${rot}-${Math.random()}`;
      usedKeys.add(key);
      return { key, hue, size, spots, rot };
    };

    // 1 对相同 + (n-2) 个不同
    const pair = make();
    pool.push({ ...pair }, { ...pair });
    for (let i = 0; i < n - 2; i++) pool.push(make());
    return shuffle(pool);
  }

  private startRound(): void {
    this.picked = null;
    this.locked = false;
    this.root.innerHTML = "";

    const n = this.count();
    this.kinds = this.genKinds(n);

    const wrap = document.createElement("div");
    wrap.className = "mlf-wrap";

    const task = document.createElement("div");
    task.className = "mlf-task";
    task.innerHTML = `找出<b>两片完全一样</b>的枫叶，点一点它们～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "mlf-board";
    this.leafEls = [];
    this.kinds.forEach((k, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mlf-leaf";
      b.dataset.idx = String(idx);
      b.style.setProperty("--mlf-hue", String(k.hue));
      b.style.setProperty("--mlf-size", String(k.size));
      b.style.setProperty("--mlf-rot", `${k.rot}deg`);
      b.innerHTML = `<span class="mlf-leaf__emoji">🍁</span>${this.spotsHtml(k.spots)}`;
      b.setAttribute(
        "aria-label",
        `色相${k.hue} 大小${k.size.toFixed(1)} 斑点${k.spots}`,
      );
      b.addEventListener("click", () => this.click(idx));
      board.appendChild(b);
      this.leafEls.push(b);
    });
    wrap.appendChild(board);

    const hint = document.createElement("div");
    hint.className = "mlf-hint";
    hint.id = "mlf-hint";
    hint.textContent = "提示：比一比颜色、大小和斑点数～";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
    this.reportProgress(this.roundsDone, this.roundTotal);
  }

  private spotsHtml(n: number): string {
    if (n <= 0) return "";
    let s = "";
    for (let i = 0; i < n; i++) {
      s += `<span class="mlf-spot mlf-spot--${i}" style="--i:${i}"></span>`;
    }
    return s;
  }

  private click(idx: number): void {
    if (this.locked) return;
    const el = this.leafEls[idx]!;
    if (this.picked === null) {
      this.picked = idx;
      el.classList.add("mlf-leaf--picked");
      sfxPop();
      return;
    }
    if (this.picked === idx) {
      el.classList.remove("mlf-leaf--picked");
      this.picked = null;
      return;
    }
    const a = this.kinds[this.picked]!;
    const b = this.kinds[idx]!;
    if (a.key === b.key) {
      // 找对
      this.locked = true;
      this.leafEls[this.picked]!.classList.add("mlf-leaf--match");
      el.classList.add("mlf-leaf--match");
      this.leafEls[this.picked]!.classList.remove("mlf-leaf--picked");
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      const hint = this.root.querySelector("#mlf-hint");
      if (hint) hint.textContent = "找对啦！两片一模一样～";
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
      this.picked = null;
    } else {
      // 不对：抖一抖
      el.classList.add("mlf-leaf--wrong");
      this.leafEls[this.picked]!.classList.add("mlf-leaf--wrong");
      const aIdx = this.picked;
      const paused = this.onWrong();
      this.trackTimeout(() => {
        el.classList.remove("mlf-leaf--wrong");
        this.leafEls[aIdx]?.classList.remove("mlf-leaf--wrong");
      }, 600);
      this.picked = null;
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍁",
      variant: "rest",
      body: "比一比颜色、大小，还有上面的斑点数～",
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
    if (document.getElementById("mlf-style")) return;
    const st = document.createElement("style");
    st.id = "mlf-style";
    st.textContent = MLF_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function MLF_CSS(theme: string): string {
  return `
.mlf-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(540px,100%);}
.mlf-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.mlf-board{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:20px;background:linear-gradient(180deg,rgba(255,241,224,.7),rgba(255,221,180,.6));border-radius:22px;box-shadow:var(--shadow);width:100%;max-width:460px;}
.mlf-leaf{position:relative;width:78px;height:88px;border:none;background:transparent;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;transition:transform .15s;}
.mlf-leaf__emoji{font-size:calc(48px * var(--mlf-size,1));line-height:1;filter:hue-rotate(calc((var(--mlf-hue,30) - 30) * 1deg)) drop-shadow(0 3px 3px rgba(0,0,0,.2));transform:rotate(var(--mlf-rot,0deg));transition:transform .2s,filter .2s;}
.mlf-leaf:active{transform:scale(.92);}
.mlf-leaf--picked .mlf-leaf__emoji{transform:rotate(var(--mlf-rot,0deg)) translateY(-8px) scale(1.12);filter:hue-rotate(calc((var(--mlf-hue,30) - 30) * 1deg)) drop-shadow(0 0 10px ${theme}) drop-shadow(0 4px 4px rgba(0,0,0,.25));}
.mlf-leaf--match .mlf-leaf__emoji{animation:mlf-fly .9s ease forwards;}
.mlf-leaf--wrong{animation:mlf-shake .5s ease;}
@keyframes mlf-fly{0%{transform:rotate(var(--mlf-rot,0deg)) scale(1);}50%{transform:rotate(0deg) scale(1.3) translateY(-10px);}100%{transform:rotate(0deg) scale(1.3) translateY(-40px);opacity:0;}}
@keyframes mlf-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px) rotate(-4deg);}75%{transform:translateX(5px) rotate(4deg);}}
.mlf-spot{position:absolute;width:7px;height:7px;background:#5a2a10;border-radius:50%;top:calc(40% + var(--i) * 14px);left:calc(45% + var(--i) * 8px);pointer-events:none;}
.mlf-hint{font-size:.95rem;font-weight:700;color:#7a4a1a;text-align:center;min-height:1.4em;}
@media (max-width:380px){.mlf-leaf{width:64px;height:74px;}.mlf-leaf__emoji{font-size:calc(40px * var(--mlf-size,1));}.mlf-board{gap:8px;padding:14px;}}
`;
}

export function create(): MapleLeafGame {
  return new MapleLeafGame();
}
