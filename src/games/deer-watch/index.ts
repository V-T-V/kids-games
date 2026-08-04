/* 数鹿群 Deer Watch —— 树林背景展示几只鹿（部分被树遮挡），
   快速展示几秒后收起，问"看到了几只鹿"。
   独特点：短时记忆 + 计数训练，鹿会被树部分遮挡增加难度（要数清）。
   难度=鹿数范围（easy 3~5，medium 3~7，hard 5~10）。
   通关=答对目标轮数。解保证：正确答案就是实际放置的鹿数，唯一。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, randInt } from "../../lobby/util.ts";

function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 4 : 5;
}
function deerRange(diff: "easy" | "medium" | "hard"): [number, number] {
  return diff === "easy" ? [3, 5] : diff === "medium" ? [3, 7] : [5, 10];
}

interface Spot {
  x: number; // 0..100 %
  y: number; // 0..100 %
  hidden: boolean; // 是否被树遮挡（视觉上变淡但仍可辨识轮廓）
}

export class DeerWatchGame extends BaseGame {
  constructor() {
    super("deer-watch");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answer = 0;
  private answered = false;
  private phase: "show" | "ask" = "show";

  protected mount(): void {
    this.roundTotal = roundTotal(this.difficulty);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* trackTimeout 统一清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.answered = false;
    this.phase = "show";

    const [lo, hi] = deerRange(this.difficulty);
    this.answer = randInt(lo, hi);
    const spots = this.makeSpots(this.answer);

    const wrap = document.createElement("div");
    wrap.className = "dw-wrap";

    const task = document.createElement("div");
    task.className = "dw-task";
    task.id = "dw-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 仔细看树林里有几只鹿！`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "dw-scene";

    // 远景树林（剪影）
    const far = document.createElement("div");
    far.className = "dw-far";
    scene.appendChild(far);

    // 鹿群层
    const deerLayer = document.createElement("div");
    deerLayer.className = "dw-deer-layer";
    deerLayer.id = "dw-deer-layer";
    for (const s of spots) {
      const d = document.createElement("div");
      d.className = "dw-deer" + (s.hidden ? " dw-deer--hidden" : "");
      d.textContent = "🦌";
      d.style.left = `${s.x}%`;
      d.style.top = `${s.y}%`;
      deerLayer.appendChild(d);
    }
    scene.appendChild(deerLayer);

    // 前景树木（遮挡部分鹿）
    const trees = this.makeTrees(spots);
    for (const t of trees) {
      const el = document.createElement("div");
      el.className = "dw-tree";
      el.textContent = "🌲";
      el.style.left = `${t.x}%`;
      el.style.top = `${t.y}%`;
      el.style.fontSize = `${t.size}px`;
      scene.appendChild(el);
    }

    // 倒计时条
    const bar = document.createElement("div");
    bar.className = "dw-bar";
    const fill = document.createElement("div");
    fill.className = "dw-bar-fill";
    fill.id = "dw-bar-fill";
    bar.appendChild(fill);
    scene.appendChild(bar);

    wrap.appendChild(scene);
    this.root.appendChild(wrap);

    // 展示阶段倒计时（easy 长，hard 短）
    const showMs =
      this.difficulty === "easy"
        ? 3000
        : this.difficulty === "medium"
          ? 2600
          : 2200;
    // 动画填充
    fill.style.transition = `width ${showMs}ms linear`;
    requestAnimationFrame(() => {
      fill.style.width = "100%";
    });
    this.trackTimeout(() => this.toAsk(), showMs);
  }

  /** 生成鹿的随机位置（保证不重叠 + 部分被遮挡）。 */
  private makeSpots(n: number): Spot[] {
    const spots: Spot[] = [];
    let tries = 0;
    while (spots.length < n && tries < 200) {
      tries++;
      const x = 8 + Math.random() * 84;
      const y = 30 + Math.random() * 52;
      const ok = spots.every((s) => Math.hypot(s.x - x, s.y - y) > 14);
      if (ok) {
        // 约 1/3 被遮挡（更难数清）
        const hidden = Math.random() < 0.33;
        spots.push({ x, y, hidden });
      }
    }
    // 兜底：若位置不够直接补齐
    while (spots.length < n) {
      spots.push({
        x: 8 + Math.random() * 84,
        y: 30 + Math.random() * 52,
        hidden: false,
      });
    }
    return spots;
  }

  /** 在被遮挡的鹿附近放一棵树，强化"被挡住"的视觉。 */
  private makeTrees(spots: Spot[]): { x: number; y: number; size: number }[] {
    const trees: { x: number; y: number; size: number }[] = [];
    for (const s of spots) {
      if (s.hidden) {
        trees.push({ x: s.x + 2, y: s.y - 2, size: 60 });
      }
    }
    // 再随机撒几棵装饰树
    const decoy = randInt(2, 4);
    for (let i = 0; i < decoy; i++) {
      trees.push({
        x: 5 + Math.random() * 88,
        y: 60 + Math.random() * 25,
        size: 50 + Math.random() * 20,
      });
    }
    return trees;
  }

  private toAsk(): void {
    this.phase = "ask";
    // 隐藏鹿群层（模拟"鹿藏起来了"）
    const layer = this.root.querySelector("#dw-deer-layer");
    if (layer) layer.classList.add("dw-deer-layer--hide");
    const task = this.root.querySelector<HTMLElement>("#dw-task");
    if (task) task.innerHTML = `林子里刚才有 <b>几只鹿</b>？选一个数字 👀`;

    const wrap = this.root.querySelector(".dw-wrap");
    const choices = document.createElement("div");
    choices.className = "dw-choices";
    // 选项：正确答案 + 若干邻近干扰，打乱
    const opts = new Set<number>([this.answer]);
    while (opts.size < Math.min(5, 10)) {
      const d = randInt(-2, 2);
      const v = this.answer + d;
      if (v >= 1) opts.add(v);
    }
    for (const v of shuffle([...opts])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dw-opt";
      b.dataset.v = String(v);
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(v, b));
      choices.appendChild(b);
    }
    if (wrap) wrap.appendChild(choices);

    // 再次展示按钮（看一眼）
    const peek = document.createElement("button");
    peek.type = "button";
    peek.className = "dw-peek";
    peek.textContent = "👀 再看一眼";
    peek.addEventListener("click", () => {
      if (layer) {
        layer.classList.remove("dw-deer-layer--hide");
        this.trackTimeout(
          () => layer.classList.add("dw-deer-layer--hide"),
          1200,
        );
      }
    });
    if (wrap) wrap.appendChild(peek);
  }

  private choose(v: number, btn: HTMLButtonElement): void {
    if (this.answered || this.phase !== "ask") return;
    if (v === this.answer) {
      this.answered = true;
      btn.classList.add("dw-opt--right");
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
      btn.classList.add("dw-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("dw-opt--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "用「再看一眼」多看几次，慢慢数清楚～",
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
    if (document.getElementById("dw-style")) return;
    const st = document.createElement("style");
    st.id = "dw-style";
    st.textContent = DW_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function DW_CSS(theme: string): string {
  return `
.dw-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.dw-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.dw-task b{color:${theme};}
.dw-scene{position:relative;width:100%;height:54vh;min-height:320px;background:linear-gradient(180deg,#bfe3c0 0%,#9ccb9a 60%,#7ab07a 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.dw-far{position:absolute;inset:0;background-image:radial-gradient(ellipse 30px 50px at 10% 70%,rgba(60,90,50,.35),transparent),radial-gradient(ellipse 26px 44px at 30% 75%,rgba(60,90,50,.3),transparent),radial-gradient(ellipse 34px 56px at 55% 72%,rgba(60,90,50,.35),transparent),radial-gradient(ellipse 28px 46px at 78% 74%,rgba(60,90,50,.3),transparent),radial-gradient(ellipse 32px 52px at 92% 70%,rgba(60,90,50,.35),transparent);}
.dw-deer-layer{position:absolute;inset:0;z-index:3;transition:opacity .35s ease,transform .35s ease;}
.dw-deer-layer--hide{opacity:0;transform:scale(.96);}
.dw-deer{position:absolute;font-size:2rem;line-height:1;transform:translate(-50%,-50%);filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.dw-deer--hidden{opacity:.92;}
.dw-tree{position:absolute;font-size:54px;line-height:1;transform:translate(-50%,-60%);z-index:4;filter:drop-shadow(0 3px 3px rgba(0,0,0,.2));}
.dw-bar{position:absolute;left:16px;right:16px;bottom:12px;height:8px;background:rgba(255,255,255,.5);border-radius:999px;overflow:hidden;z-index:5;}
.dw-bar-fill{width:0;height:100%;background:linear-gradient(90deg,${theme},#d4a373);}
.dw-choices{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.7);border-radius:20px;box-shadow:var(--shadow);width:min(400px,94%);}
.dw-opt{font-family:inherit;font-size:1.4rem;font-weight:900;color:var(--ink);background:#fff;border:none;width:64px;height:64px;border-radius:16px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s,background .15s;}
.dw-opt:hover{transform:translateY(-3px);}
.dw-opt:active{transform:scale(.93);}
.dw-opt--right{background:linear-gradient(160deg,#6bcf7f,#4ba85f);color:#fff;animation:dw-pop .3s ease;}
.dw-opt--wrong{background:linear-gradient(160deg,#ff8a8a,#ff6348);color:#fff;animation:dw-shake .4s ease;}
@keyframes dw-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes dw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.dw-peek{font-family:inherit;font-size:1rem;font-weight:800;color:#fff;background:linear-gradient(160deg,${theme},#8a6a4a);border:none;padding:10px 24px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;}
.dw-peek:active{transform:scale(.94);}
@media (max-width:380px){.dw-task{font-size:.95rem;}.dw-deer{font-size:1.7rem;}.dw-opt{width:54px;height:54px;font-size:1.2rem;}}
`;
}

export function create(): DeerWatchGame {
  return new DeerWatchGame();
}
