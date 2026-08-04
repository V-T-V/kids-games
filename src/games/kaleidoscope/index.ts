/* 万花筒 Kaleidoscope —— 转动万花筒（点屏幕或拖动），看到对称彩色图案变化。
   每轮给定一个"目标图案碎片"，孩子转动找到与目标颜色一致的图案。
   纯视觉探索，培养审美和观察力。
   独特点：每次转动都是新图案的惊喜；用 CSS rotate + 对称镜像复制扇区。
   视觉：用 CSS transform rotate + 对称布局创建万花筒效果，颜色块围绕中心旋转。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

const COLORS = [
  "#ff6b9d",
  "#4d96ff",
  "#6bcf7f",
  "#ffd93d",
  "#a55eea",
  "#ff9f43",
  "#22d3ee",
  "#ff6348",
];

/** 一种万花筒图案：每个扇区的颜色序列。 */
interface Pattern {
  /** 单个扇区内 N 个色块颜色（会被镜像复制到全圆）。 */
  slices: string[];
}

/** 随机生成一个图案 */
function genPattern(n: number): Pattern {
  const slices: string[] = [];
  for (let i = 0; i < n; i++) slices.push(sample(COLORS));
  return { slices };
}

export class KaleidoscopeGame extends BaseGame {
  constructor() {
    super("kaleidoscope");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 当前转动到的图案（在不断变换中）。 */
  private current: Pattern = { slices: [] };
  /** 目标图案碎片：颜色序列。 */
  private target: Pattern = { slices: [] };
  /** 旋转角度。 */
  private rotation = 0;
  /** 扇区数（镜像份数）。 */
  private sectors = 6;
  /** 每个扇区内色块数。 */
  private sliceN = 3;
  private busy = false;
  private unbinds: (() => void)[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    if (this.difficulty === "hard") {
      this.sectors = 8;
      this.sliceN = 4;
    } else if (this.difficulty === "medium") {
      this.sectors = 6;
      this.sliceN = 4;
    } else {
      this.sectors = 6;
      this.sliceN = 3;
    }
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    this.rotation = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 目标图案：随机一个，作为本轮要找到的"图案碎片" */
    this.target = genPattern(this.sliceN);
    /* 当前图案：先随机一个与目标不同的 */
    do {
      this.current = genPattern(this.sliceN);
    } while (this.patternEqual(this.current, this.target));

    const wrap = document.createElement("div");
    wrap.className = "ksr-wrap";

    const task = document.createElement("div");
    task.className = "ksr-task";
    task.innerHTML = `转到和上面一样的图案！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    /* 目标预览 */
    const preview = document.createElement("div");
    preview.className = "ksr-preview";
    preview.id = "ksr-preview";
    preview.appendChild(this.buildWheel(this.target, true));
    const pl = document.createElement("div");
    pl.className = "ksr-preview__label";
    pl.textContent = "🎯 找这个图案";
    wrap.appendChild(preview);
    wrap.appendChild(pl);

    /* 万花筒主体 */
    const scope = document.createElement("div");
    scope.className = "ksr-scope";
    scope.id = "ksr-scope";
    scope.appendChild(this.buildWheel(this.current, false));
    wrap.appendChild(scope);

    /* 控制说明 */
    const ctrl = document.createElement("div");
    ctrl.className = "ksr-ctrl";
    ctrl.innerHTML = `👆 点万花筒转动 / 变图案`;
    wrap.appendChild(ctrl);

    /* 操作按钮 */
    const actions = document.createElement("div");
    actions.className = "ksr-actions";
    const spin = document.createElement("button");
    spin.type = "button";
    spin.className = "ksr-btn";
    spin.textContent = "🔄 转一转";
    spin.addEventListener("click", () => this.spin());
    actions.appendChild(spin);
    const change = document.createElement("button");
    change.type = "button";
    change.className = "ksr-btn ksr-btn--alt";
    change.textContent = "✨ 换图案";
    change.addEventListener("click", () => this.changePattern());
    actions.appendChild(change);
    wrap.appendChild(actions);

    /* 确认按钮：当图案匹配时可用 */
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "ksr-confirm";
    confirm.id = "ksr-confirm";
    confirm.textContent = "就是这个！✓";
    confirm.disabled = true;
    confirm.addEventListener("click", () => this.tryConfirm());
    wrap.appendChild(confirm);

    this.root.appendChild(wrap);

    /* 点万花筒也能转 */
    const onScope = (): void => this.spin();
    scope.addEventListener("pointerdown", onScope);
    this.unbinds.push(() => scope.removeEventListener("pointerdown", onScope));
  }

  private patternEqual(a: Pattern, b: Pattern): boolean {
    if (a.slices.length !== b.slices.length) return false;
    return a.slices.every((c, i) => c === b.slices[i]);
  }

  /** 构建一个万花筒轮（扇区镜像对称）。 */
  private buildWheel(p: Pattern, isPreview: boolean): HTMLElement {
    const wheel = document.createElement("div");
    wheel.className = "ksr-wheel";
    if (isPreview) wheel.classList.add("ksr-wheel--preview");
    wheel.style.setProperty("--ksr-sectors", String(this.sectors));

    /* 用 conic-gradient 简单实现对称扇区：每个扇区重复同一组颜色 */
    const stops: string[] = [];
    const seg = 360 / this.sectors;
    for (let s = 0; s < this.sectors; s++) {
      const start = s * seg;
      /* 交替镜像方向让相邻扇区互为镜像（万花筒效果） */
      const slice = s % 2 === 0 ? p.slices : [...p.slices].reverse();
      const sub = seg / slice.length;
      slice.forEach((c, i) => {
        stops.push(`${c} ${start + i * sub}deg ${start + (i + 1) * sub}deg`);
      });
    }
    wheel.style.background = `conic-gradient(${stops.join(",")})`;
    /* 中心装饰 */
    const core = document.createElement("div");
    core.className = "ksr-wheel__core";
    wheel.appendChild(core);
    return wheel;
  }

  private spin(): void {
    if (this.busy) return;
    this.rotation += randInt(60, 160);
    const scope = this.root.querySelector("#ksr-scope .ksr-wheel") as HTMLElement;
    if (scope) scope.style.transform = `rotate(${this.rotation}deg)`;
    sfxPop();
    this.updateConfirm();
  }

  private changePattern(): void {
    if (this.busy) return;
    /* 随机换一个图案，尽量与目标不同 */
    let np: Pattern;
    do {
      np = genPattern(this.sliceN);
    } while (this.patternEqual(np, this.target) || this.patternEqual(np, this.current));
    this.current = np;
    const scope = this.root.querySelector("#ksr-scope") as HTMLElement;
    if (scope) {
      const old = scope.querySelector(".ksr-wheel");
      if (old) old.remove();
      scope.appendChild(this.buildWheel(this.current, false));
    }
    sfxPop();
    this.updateConfirm();
  }

  private updateConfirm(): void {
    const btn = this.root.querySelector("#ksr-confirm") as HTMLButtonElement;
    if (!btn) return;
    const match = this.patternEqual(this.current, this.target);
    btn.disabled = !match;
    if (match) btn.classList.add("ksr-confirm--ready");
    else btn.classList.remove("ksr-confirm--ready");
  }

  private tryConfirm(): void {
    const btn = this.root.querySelector("#ksr-confirm") as HTMLButtonElement;
    if (btn?.disabled) return;
    if (this.patternEqual(this.current, this.target)) {
      this.busy = true;
      const scope = this.root.querySelector("#ksr-scope") as HTMLElement;
      const r = scope.getBoundingClientRect();
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
      }, 1000);
    } else {
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
      body: "再转一转，找找一样的图案～",
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
    if (document.getElementById("ksr-style")) return;
    const st = document.createElement("style");
    st.id = "ksr-style";
    st.textContent = KSR_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function KSR_CSS(theme: string): string {
  return `
.ksr-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:min(520px,100%);}
.ksr-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;}
.ksr-preview{width:96px;height:96px;display:flex;align-items:center;justify-content:center;}
.ksr-preview__label{font-size:.9rem;font-weight:700;color:#7a5ba0;margin-bottom:2px;}
.ksr-scope{position:relative;width:min(280px,80%);aspect-ratio:1;border-radius:50%;overflow:hidden;box-shadow:0 0 0 8px #fff,0 0 0 12px ${theme},var(--shadow);cursor:pointer;touch-action:manipulation;background:#1a1a2e;}
.ksr-wheel{position:absolute;inset:0;border-radius:50%;transition:transform .5s cubic-bezier(.3,1.4,.5,1);will-change:transform;}
.ksr-wheel--preview{transition:none;}
.ksr-wheel__core{position:absolute;left:50%;top:50%;width:24px;height:24px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff,${theme});box-shadow:0 0 8px rgba(255,255,255,.8);z-index:2;}
.ksr-scope:active{transform:scale(.99);}
.ksr-ctrl{font-size:.95rem;color:#888;font-weight:600;}
.ksr-actions{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.ksr-btn{min-width:120px;min-height:48px;padding:10px 22px;font-size:1.1rem;font-weight:800;border-radius:14px;border:none;background:${theme};color:#fff;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s;}
.ksr-btn--alt{background:#fff;color:${theme};border:3px solid ${theme};}
.ksr-btn:hover{transform:translateY(-2px);}
.ksr-btn:active{transform:scale(.95);}
.ksr-confirm{margin-top:4px;padding:14px 32px;font-size:1.15rem;font-weight:800;border-radius:999px;border:3px solid #ccc;background:#eee;color:#999;cursor:not-allowed;transition:all .2s;}
.ksr-confirm--ready{border-color:${theme};background:${theme};color:#fff;cursor:pointer;animation:ksr-pulse 1s ease-in-out infinite;}
@keyframes ksr-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.ksr-confirm--ready:hover{transform:translateY(-2px);}
@media (max-width:380px){.ksr-scope{width:230px;}.ksr-btn{min-width:100px;padding:10px 16px;}}
`;
}

export function create(): KaleidoscopeGame {
  return new KaleidoscopeGame();
}
