/* 拉面长短 Noodle Pull —— 几根面条长度不同，
   孩子把它们按从短到长排序（点击顺序就是排序顺序）。
   独特点：长度比较 + 顺序排列。每点一根，它"跳"到上方排列区。
   视觉：碗 + 不同长度面条（带粗细一致的色条）。难度=面条数。
   通关=排对目标轮数。前缀 ndl-。
   可解性：每根长度唯一，排序结果唯一；按从短到长点即正确。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const NOODLE_COLORS = ["#f4c95d", "#e8a04a", "#ffd066", "#dba74e", "#c98a3a"];

interface Noodle {
  id: number;
  /** 长度（1~10）数值越大越长 */
  len: number;
  color: string;
  placed: boolean;
}

export class NoodlePullGame extends BaseGame {
  constructor() {
    super("noodle-pull");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private noodles: Noodle[] = [];
  /** 目标排序：从短到长的 noodle.id 序列 */
  private target: number[] = [];
  /** 当前已放置的 id 序列 */
  private placed: number[] = [];
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

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    this.placed = [];

    const n = this.count();
    // 生成 n 个不同长度（保证唯一）
    const lenPool = shuffle([3, 4, 5, 6, 7, 8, 9]).slice(0, n);
    this.noodles = lenPool.map((len, i) => ({
      id: i,
      len,
      color: sample(NOODLE_COLORS),
      placed: false,
    }));
    // 目标：按 len 升序的 id
    this.target = [...this.noodles]
      .sort((a, b) => a.len - b.len)
      .map((x) => x.id);
    // 展示顺序打乱
    const shown = shuffle([...this.noodles]);

    const wrap = document.createElement("div");
    wrap.className = "ndl-wrap";

    const task = document.createElement("div");
    task.className = "ndl-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 把面条从 <b>短</b> 到 <b>长</b> 排好（从最短的开始点）🍜`;
    wrap.appendChild(task);

    // 排序结果展示区
    const rank = document.createElement("div");
    rank.className = "ndl-rank";
    rank.id = "ndl-rank";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "ndl-rank-slot";
      slot.dataset.pos = String(i);
      slot.innerHTML = `<span class="ndl-rank-no">${i + 1}</span>`;
      rank.appendChild(slot);
    }
    wrap.appendChild(rank);

    // 碗 + 面条
    const stage = document.createElement("div");
    stage.className = "ndl-stage";
    const bowl = document.createElement("div");
    bowl.className = "ndl-bowl";
    const tray = document.createElement("div");
    tray.className = "ndl-tray";
    tray.id = "ndl-tray";
    shown.forEach((nd) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "ndl-noodle";
      el.dataset.id = String(nd.id);
      el.style.setProperty("--ndl-w", `${nd.len * 12}%`);
      el.style.setProperty("--ndl-c", nd.color);
      el.innerHTML = `<span class="ndl-noodle__bar"></span><span class="ndl-noodle__tip">●</span>`;
      el.addEventListener("click", () => this.pickNoodle(nd.id, el));
      tray.appendChild(el);
    });
    bowl.appendChild(tray);
    stage.appendChild(bowl);
    wrap.appendChild(stage);

    // 重置
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "ndl-reset";
    reset.textContent = "↺ 重新排";
    reset.addEventListener("click", () => this.resetRound());
    wrap.appendChild(reset);

    this.root.appendChild(wrap);
  }

  private pickNoodle(id: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    const nd = this.noodles[id]!;
    if (nd.placed) return;
    const expectedId = this.target[this.placed.length];
    if (id !== expectedId) {
      // 不是当前最短
      btn.classList.add("ndl-noodle--wrong");
      this.trackTimeout(() => btn.classList.remove("ndl-noodle--wrong"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    // 放对
    nd.placed = true;
    this.placed.push(id);
    sfxPop();
    this.resetWrongStreak();

    // 把这根从碗里移到排序区对应槽位
    const pos = this.placed.length - 1;
    const slot = this.root.querySelector<HTMLElement>(
      `.ndl-rank-slot[data-pos="${pos}"]`,
    );
    if (slot) {
      slot.classList.add("ndl-rank-slot--filled");
      const bar = document.createElement("span");
      bar.className = "ndl-noodle__bar ndl-rank-bar";
      bar.style.setProperty("--ndl-w", `${nd.len * 12}%`);
      bar.style.background = nd.color;
      slot.appendChild(bar);
    }
    btn.classList.add("ndl-noodle--gone");
    btn.disabled = true;
    const r = btn.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);

    if (this.placed.length >= this.target.length) {
      this.locked = true;
      this.trackTimeout(() => {
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 700);
      }, 450);
    }
  }

  private resetRound(): void {
    this.noodles.forEach((nd) => (nd.placed = false));
    this.placed = [];
    this.root.querySelectorAll<HTMLElement>(".ndl-rank-slot").forEach((s) => {
      s.classList.remove("ndl-rank-slot--filled");
      s.querySelectorAll(".ndl-rank-bar").forEach((b) => b.remove());
    });
    this.root
      .querySelectorAll<HTMLButtonElement>(".ndl-noodle")
      .forEach((b) => {
        b.classList.remove("ndl-noodle--gone");
        b.disabled = false;
      });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍜",
      variant: "rest",
      body: `先找最短的那根，再找剩下的里最短的，一根一根排～ ${sample(["排得真整齐！", "比一比哪根短！"])}`,
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
    if (document.getElementById("ndl-style")) return;
    const st = document.createElement("style");
    st.id = "ndl-style";
    st.textContent = NDL_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function NDL_CSS(theme: string): string {
  return `
.ndl-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.ndl-task{font-size:1.02rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ndl-rank{display:flex;flex-direction:column;gap:8px;width:100%;max-width:420px;background:rgba(255,255,255,.5);border-radius:18px;padding:12px;box-shadow:var(--shadow);}
.ndl-rank-slot{display:flex;align-items:center;gap:10px;height:28px;border-radius:10px;background:rgba(255,255,255,.4);padding:0 10px;}
.ndl-rank-slot--filled{background:rgba(255,255,255,.85);}
.ndl-rank-no{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${theme};color:#fff;font-size:.8rem;font-weight:900;flex-shrink:0;}
.ndl-rank-bar{height:14px;border-radius:7px;animation:ndl-grow .3s ease;}
@keyframes ndl-grow{0%{transform:scaleX(0);transform-origin:left;opacity:0}100%{transform:scaleX(1);opacity:1}}
.ndl-stage{display:flex;justify-content:center;width:100%;}
.ndl-bowl{position:relative;width:min(420px,92%);min-height:180px;background:linear-gradient(180deg,#fff,#ffe9d0);border-radius:24px;box-shadow:var(--shadow);padding:24px;}
.ndl-bowl::before{content:"🥢";position:absolute;top:-14px;right:24px;font-size:2rem;transform:rotate(20deg);}
.ndl-tray{display:flex;flex-direction:column;gap:12px;align-items:flex-start;}
.ndl-noodle{display:flex;align-items:center;gap:2px;border:none;background:transparent;cursor:pointer;padding:0;transition:transform .12s;}
.ndl-noodle:active{transform:scale(.97);}
.ndl-noodle__bar{display:inline-block;height:18px;width:var(--ndl-w,30%);min-width:40px;border-radius:9px;background:var(--ndl-c,#f4c95d);box-shadow:inset 0 -3px 4px rgba(0,0,0,.15),0 2px 4px rgba(0,0,0,.15);position:relative;}
.ndl-noodle__bar::after{content:"";position:absolute;left:6px;right:6px;top:3px;height:3px;background:rgba(255,255,255,.5);border-radius:2px;}
.ndl-noodle__tip{color:var(--ndl-c,#f4c95d);font-size:1rem;filter:brightness(.85);}
.ndl-noodle--wrong{animation:ndl-shake .45s ease;}
@keyframes ndl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.ndl-noodle--gone{opacity:0;pointer-events:none;height:0;overflow:hidden;margin:0;padding:0;transition:opacity .2s;}
.ndl-reset{padding:6px 16px;border:none;border-radius:999px;background:#fff;color:#888;font-weight:800;box-shadow:var(--shadow);cursor:pointer;}
.ndl-reset:active{transform:translateY(2px);}
@media (max-width:380px){.ndl-bowl{padding:18px;min-height:160px;}.ndl-noodle__bar{height:16px;}}
`;
}

export function create(): NoodlePullGame {
  return new NoodlePullGame();
}
