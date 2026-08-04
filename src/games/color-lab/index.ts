/* 色彩实验室 Color Lab —— 自由混色探索。孩子选 2 种颜色倒进烧杯，
   看看混出什么新颜色。每轮给一个"目标色"，探索哪两种颜色能混出来
   （红+黄=橙、蓝+黄=绿、红+蓝=紫…）。与 color-mixer 不同的是强调
   "自由实验"：可以反复倒、倒掉、再试，没有时间压力。
   独特点：实验探索而非答题——错了不扣，鼓励反复尝试发现规律。
   视觉：烧杯液面动画 + 颜色渐变。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Dye {
  id: string;
  hex: string;
  name: string;
}

/** 基础颜料（幼儿认识的）。 */
const DYES: Dye[] = [
  { id: "red", hex: "#ff5252", name: "红" },
  { id: "yellow", hex: "#ffd93d", name: "黄" },
  { id: "blue", hex: "#4d96ff", name: "蓝" },
];

/** 混色规则：a+b -> 结果（顺序无关）。 */
const MIX_RULES: Record<string, { hex: string; name: string }> = {
  "red|yellow": { hex: "#ff9f43", name: "橙" },
  "yellow|red": { hex: "#ff9f43", name: "橙" },
  "blue|yellow": { hex: "#6bcf7f", name: "绿" },
  "yellow|blue": { hex: "#6bcf7f", name: "绿" },
  "red|blue": { hex: "#a55eea", name: "紫" },
  "blue|red": { hex: "#a55eea", name: "紫" },
};

/** 可作为目标的混色结果。 */
const TARGETS = [
  { hex: "#ff9f43", name: "橙色" },
  { hex: "#6bcf7f", name: "绿色" },
  { hex: "#a55eea", name: "紫色" },
];

export class ColorLabGame extends BaseGame {
  constructor() {
    super("color-lab");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 烧杯里已倒入的颜料（最多 2 种）。 */
  private beaker: Dye[] = [];
  /** 当前烧杯混合后的颜色（null=空）。 */
  private mixed: { hex: string; name: string } | null = null;
  /** 本轮目标色。 */
  private target: { hex: string; name: string } = TARGETS[0]!;
  private busy = false;
  /** 本轮尝试次数（用于算星，鼓励少试错）。 */
  private triesThisRound = 0;
  private totalTries = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 + trackTimeout 自动清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    this.beaker = [];
    this.mixed = null;
    this.triesThisRound = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 随机选目标 */
    this.target = sample(TARGETS);

    const wrap = document.createElement("div");
    wrap.className = "clb-wrap";

    const task = document.createElement("div");
    task.className = "clb-task";
    task.innerHTML = `试着调出 <span class="clb-target" style="background:${this.target.hex}">${this.target.name}</span><br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    /* 烧杯区 */
    const lab = document.createElement("div");
    lab.className = "clb-lab";
    const beaker = document.createElement("div");
    beaker.className = "clb-beaker";
    beaker.id = "clb-beaker";
    beaker.innerHTML = `
      <div class="clb-beaker__glass">
        <div class="clb-beaker__liquid" id="clb-liquid"></div>
        <div class="clb-beaker__shine"></div>
      </div>
      <div class="clb-beaker__base"></div>
    `;
    lab.appendChild(beaker);

    /* 当前状态文字 */
    const status = document.createElement("div");
    status.className = "clb-status";
    status.id = "clb-status";
    status.textContent = "烧杯是空的，倒点颜料进来～";
    lab.appendChild(status);

    wrap.appendChild(lab);

    /* 颜料瓶 */
    const rack = document.createElement("div");
    rack.className = "clb-rack";
    for (const d of DYES) {
      const bottle = document.createElement("button");
      bottle.type = "button";
      bottle.className = "clb-bottle";
      bottle.style.setProperty("--clb-c", d.hex);
      bottle.setAttribute("aria-label", `${d.name}色颜料`);
      bottle.innerHTML = `<span class="clb-bottle__body"></span><span class="clb-bottle__cap"></span><span class="clb-bottle__label">${d.name}</span>`;
      bottle.addEventListener("click", () => this.pour(d));
      rack.appendChild(bottle);
    }
    wrap.appendChild(rack);

    /* 操作按钮 */
    const actions = document.createElement("div");
    actions.className = "clb-actions";
    const empty = document.createElement("button");
    empty.type = "button";
    empty.className = "clb-btn clb-btn--alt";
    empty.textContent = "🚮 倒掉";
    empty.addEventListener("click", () => this.emptyBeaker());
    actions.appendChild(empty);

    const done = document.createElement("button");
    done.type = "button";
    done.className = "clb-btn";
    done.id = "clb-done";
    done.textContent = "就是它！✓";
    done.disabled = true;
    done.addEventListener("click", () => this.tryDone());
    actions.appendChild(done);
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
  }

  private pour(d: Dye): void {
    if (this.busy) return;
    if (this.beaker.length >= 2) return; /* 烧杯满了 */
    sfxPop();
    this.beaker.push(d);

    /* 倒入动画 + 计算混合色 */
    if (this.beaker.length === 1) {
      /* 只有一种颜料：液体就是它本身 */
      this.mixed = { hex: d.hex, name: d.name };
    } else {
      /* 两种混合 */
      const key = `${this.beaker[0]!.id}|${this.beaker[1]!.id}`;
      const rule = MIX_RULES[key];
      if (rule) {
        this.mixed = rule;
      } else {
        /* 相同颜色 */
        this.mixed = { hex: d.hex, name: d.name };
      }
    }
    this.updateBeaker();
  }

  private updateBeaker(): void {
    const liquid = this.root.querySelector("#clb-liquid") as HTMLElement;
    const status = this.root.querySelector("#clb-status") as HTMLElement;
    const doneBtn = this.root.querySelector("#clb-done") as HTMLButtonElement;
    if (!liquid || !status) return;

    if (this.beaker.length === 0) {
      liquid.style.height = "0%";
      liquid.style.background = "transparent";
      status.textContent = "烧杯是空的，倒点颜料进来～";
      doneBtn.disabled = true;
      return;
    }
    /* 液面高度按倒入数 */
    liquid.style.height = this.beaker.length === 1 ? "45%" : "85%";
    liquid.style.background = this.mixed!.hex;

    if (this.beaker.length === 1) {
      status.innerHTML = `倒进了 <b style="color:${this.mixed!.hex}">${this.mixed!.name}</b>色，再倒一种试试～`;
      doneBtn.disabled = true;
    } else {
      status.innerHTML = `混合出 <b style="color:${this.mixed!.hex}">${this.mixed!.name}</b>色！对吗？`;
      const match = this.mixed!.hex.toLowerCase() === this.target.hex.toLowerCase();
      doneBtn.disabled = false;
      if (match) doneBtn.classList.add("clb-btn--ready");
      else doneBtn.classList.remove("clb-btn--ready");
    }
  }

  private emptyBeaker(): void {
    if (this.busy) return;
    sfxPop();
    this.beaker = [];
    this.mixed = null;
    this.updateBeaker();
  }

  private tryDone(): void {
    const doneBtn = this.root.querySelector("#clb-done") as HTMLButtonElement;
    if (doneBtn?.disabled || !this.mixed) return;
    this.triesThisRound += 1;
    this.totalTries += 1;
    if (this.mixed.hex.toLowerCase() === this.target.hex.toLowerCase()) {
      this.busy = true;
      const beaker = this.root.querySelector("#clb-beaker") as HTMLElement;
      const r = beaker.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          /* 星级：平均每轮尝试次数越少越好 */
          const avg = this.totalTries / this.roundTotal;
          let stars = starsByAccuracy(this.wrongCount);
          if (avg <= 1.5) stars = Math.max(stars, 3);
          else if (avg <= 2.5) stars = Math.max(stars, 2);
          this.finishClear(stars);
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      /* 不是目标色：不扣分（探索游戏），温柔提示再试 */
      const status = this.root.querySelector("#clb-status") as HTMLElement;
      status.innerHTML = `还不是 <b style="color:${this.target.hex}">${this.target.name}</b>，倒掉再试试别的搭配～`;
      doneBtn.disabled = true;
      const beaker = this.root.querySelector("#clb-beaker") as HTMLElement;
      beaker.classList.add("clb-beaker--shake");
      this.trackTimeout(() => beaker.classList.remove("clb-beaker--shake"), 400);
      /* 累计答错护盾：用 onWrong 计数（但探索游戏不太可能触发休息） */
      const paused = this.onWrong();
      if (paused) {
        this.trackTimeout(() => this.showRest(), 600);
      }
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想哪两种颜色能调出目标色～",
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
    if (document.getElementById("clb-style")) return;
    const st = document.createElement("style");
    st.id = "clb-style";
    st.textContent = CLB_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function CLB_CSS(theme: string): string {
  return `
.clb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.clb-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;}
.clb-target{display:inline-block;padding:2px 14px;border-radius:999px;color:#fff;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.3);box-shadow:var(--shadow);}
.clb-lab{display:flex;flex-direction:column;align-items:center;gap:12px;}
.clb-beaker{position:relative;width:120px;height:150px;display:flex;flex-direction:column;align-items:center;transition:transform .15s;}
.clb-beaker--shake{animation:clb-shake .4s ease;}
@keyframes clb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px) rotate(-3deg)}75%{transform:translateX(8px) rotate(3deg)}}
.clb-beaker__glass{position:relative;width:100px;height:120px;border:4px solid rgba(180,200,220,.8);border-top:none;border-radius:0 0 18px 18px;background:rgba(200,230,255,.2);overflow:hidden;box-shadow:inset 0 0 12px rgba(255,255,255,.3);}
.clb-beaker__liquid{position:absolute;bottom:0;left:0;width:100%;height:0%;background:transparent;transition:height .6s cubic-bezier(.4,0,.2,1),background .6s ease;}
.clb-beaker__shine{position:absolute;top:8px;left:8px;width:14px;height:80%;background:linear-gradient(180deg,rgba(255,255,255,.5),transparent);border-radius:8px;pointer-events:none;}
.clb-beaker__base{width:120px;height:14px;background:rgba(180,200,220,.8);border-radius:4px;margin-top:-2px;}
.clb-status{font-size:1rem;font-weight:700;color:#444;min-height:1.6em;text-align:center;max-width:340px;}
.clb-rack{display:flex;gap:24px;flex-wrap:wrap;justify-content:center;padding:16px 24px;background:#fff;border-radius:20px;box-shadow:var(--shadow);}
.clb-bottle{position:relative;width:54px;height:96px;background:transparent;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;transition:transform .12s;padding:0;}
.clb-bottle:hover{transform:translateY(-4px) scale(1.05);}
.clb-bottle:active{transform:scale(.92);}
.clb-bottle__cap{width:22px;height:14px;background:#888;border-radius:4px 4px 2px 2px;}
.clb-bottle__body{width:46px;height:64px;background:var(--clb-c);border-radius:50% 50% 16px 16px / 30% 30% 16px 16px;box-shadow:inset 0 -8px 10px rgba(0,0,0,.15),inset 0 6px 8px rgba(255,255,255,.3);position:relative;}
.clb-bottle__label{margin-top:4px;font-size:.85rem;font-weight:800;color:#444;background:#fff;padding:1px 8px;border-radius:6px;}
.clb-actions{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.clb-btn{min-width:130px;min-height:48px;padding:10px 22px;font-size:1.1rem;font-weight:800;border-radius:14px;border:none;background:${theme};color:#fff;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s;}
.clb-btn--alt{background:#fff;color:${theme};border:3px solid ${theme};}
.clb-btn:disabled{background:#ddd;color:#aaa;cursor:not-allowed;box-shadow:none;}
.clb-btn:not(:disabled):hover{transform:translateY(-2px);}
.clb-btn--ready{animation:clb-pulse 1s ease-in-out infinite;}
@keyframes clb-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@media (max-width:380px){.clb-rack{gap:16px;padding:12px 16px;}.clb-bottle{width:46px;height:84px;}.clb-btn{min-width:110px;padding:10px 16px;}}
`;
}

export function create(): ColorLabGame {
  return new ColorLabGame();
}
