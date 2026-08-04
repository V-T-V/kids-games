/* 齿轮方向 Gear Spin —— 一排相连的齿轮，第一个齿轮标了旋转方向（顺/逆时针），
   相邻齿轮转向相反。孩子判断最后一个齿轮往哪边转。
   独特点：机械传动思维——奇偶交替判定。
   巧思：齿轮数决定答案（偶数同向、奇数反向），题目保证明确。
   视觉：相连齿轮 + 第一个带方向箭头，全部带转动动画。
   难度=齿轮数。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

export class GearSpinGame extends BaseGame {
  constructor() {
    super("gear-spin");
  }

  private gearCount = 3;
  private firstDir: "cw" | "ccw" = "cw";
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.gearCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 最后一齿轮方向：相邻反向，所以偶数个齿轮与第一个同向，奇数个反向。
      （含第一个共 n 个，第 n 个相对第一个转了 n-1 次，奇数次→反向） */
  private lastDir(): "cw" | "ccw" {
    const flips = this.gearCount - 1;
    const reversed = flips % 2 === 1;
    if (this.firstDir === "cw") return reversed ? "ccw" : "cw";
    return reversed ? "cw" : "ccw";
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.firstDir = sample(["cw", "ccw"] as const);
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "gs2-wrap";
    const task = document.createElement("div");
    task.className = "gs2-task";
    task.innerHTML = `第一个齿轮往 <b>${this.firstDir === "cw" ? "顺时针 ↻" : "逆时针 ↺"}</b> 转。<br>最后一个（第 ${this.gearCount} 个）齿轮往哪边转？ ${this.roundsDone + 1} / ${this.roundTotal}`;
    wrap.appendChild(task);

    // 齿轮链（SVG）
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "gs2-chain");
    const r = 38;
    const gap = 4; // 齿轮间距（齿啮合留缝）
    const step = r * 2 + gap;
    const W = this.gearCount * step + 20;
    const H = r * 2 + 50;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));

    for (let i = 0; i < this.gearCount; i++) {
      const cx = 10 + r + i * step;
      const cy = H / 2;
      const dir =
        i % 2 === 0 ? this.firstDir : this.firstDir === "cw" ? "ccw" : "cw";
      const color =
        i === this.gearCount - 1
          ? getCssVar("--c-red")
          : i === 0
            ? getCssVar("--c-orange")
            : getCssVar("--c-brown");
      // 外层 g：定位；内层 g：旋转动画（绕本地原点旋转，定位已由外层承担）
      const outer = document.createElementNS(svgNs, "g");
      outer.setAttribute("transform", `translate(${cx} ${cy})`);
      const g = document.createElementNS(svgNs, "g");
      g.setAttribute("class", `gs2-gear gs2-gear--${dir}`);
      // 齿轮齿
      const teeth = 10;
      for (let t = 0; t < teeth; t++) {
        const a = (t / teeth) * Math.PI * 2;
        const rect = document.createElementNS(svgNs, "rect");
        rect.setAttribute("x", "-4");
        rect.setAttribute("y", String(-(r + 7)));
        rect.setAttribute("width", "8");
        rect.setAttribute("height", "9");
        rect.setAttribute("rx", "2");
        rect.setAttribute("fill", color);
        rect.setAttribute("transform", `rotate(${(a * 180) / Math.PI})`);
        g.appendChild(rect);
      }
      // 主体圆
      const circle = document.createElementNS(svgNs, "circle");
      circle.setAttribute("r", String(r));
      circle.setAttribute("fill", color);
      circle.setAttribute("stroke", "rgba(0,0,0,.2)");
      circle.setAttribute("stroke-width", "2");
      g.appendChild(circle);
      // 内孔
      const hole = document.createElementNS(svgNs, "circle");
      hole.setAttribute("r", "10");
      hole.setAttribute("fill", "#fff");
      hole.setAttribute("opacity", "0.6");
      g.appendChild(hole);
      // 辐条（让旋转可见）
      for (let s = 0; s < 4; s++) {
        const spoke = document.createElementNS(svgNs, "rect");
        spoke.setAttribute("x", "-4");
        spoke.setAttribute("y", String(-r + 8));
        spoke.setAttribute("width", "8");
        spoke.setAttribute("height", String(r * 2 - 16));
        spoke.setAttribute("rx", "3");
        spoke.setAttribute("fill", "rgba(0,0,0,.15)");
        spoke.setAttribute("transform", `rotate(${s * 45})`);
        g.appendChild(spoke);
      }
      outer.appendChild(g);
      svg.appendChild(outer);

      // 序号文字（SVG 内，齿轮下方）
      const num = document.createElementNS(svgNs, "text");
      num.setAttribute("x", String(cx));
      num.setAttribute("y", String(cy + r + 22));
      num.setAttribute("text-anchor", "middle");
      num.setAttribute("font-size", "13");
      num.setAttribute("font-weight", "800");
      num.setAttribute("fill", "#5a4a6a");
      num.textContent =
        i === 0
          ? "① 开始"
          : i === this.gearCount - 1
            ? `${this.toCircled(i + 1)} 终点`
            : this.toCircled(i + 1);
      svg.appendChild(num);
    }
    wrap.appendChild(svg);

    // 第一个齿轮上方：方向箭头
    const arrowNote = document.createElement("div");
    arrowNote.className = "gs2-arrow-note";
    arrowNote.innerHTML =
      this.firstDir === "cw"
        ? "↻<br><small>顺时针</small>"
        : "↺<br><small>逆时针</small>";
    wrap.appendChild(arrowNote);

    // 选项按钮：顺/逆
    const opts = document.createElement("div");
    opts.className = "gs2-opts";
    const optCW = document.createElement("button");
    optCW.type = "button";
    optCW.className = "gs2-opt";
    optCW.innerHTML = `↻<span>顺时针</span>`;
    optCW.addEventListener("click", () => this.choose("cw", optCW));
    const optCCW = document.createElement("button");
    optCCW.type = "button";
    optCCW.className = "gs2-opt";
    optCCW.innerHTML = `↺<span>逆时针</span>`;
    optCCW.addEventListener("click", () => this.choose("ccw", optCCW));
    opts.appendChild(optCCW);
    opts.appendChild(optCW);
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(ans: "cw" | "ccw", btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const correct = ans === this.lastDir();
    if (correct) {
      btn.classList.add("gs2-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 850);
    } else {
      btn.classList.add("gs2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".gs2-opt--wrong")
          .forEach((el) => el.classList.remove("gs2-opt--wrong"));
      }, 700);
    }
  }

  /** 1→① 2→② … 用于齿轮序号。 */
  private toCircled(n: number): string {
    const map = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
    return map[n - 1] ?? String(n);
  }

  private injectStyle(): void {
    if (document.getElementById("gs2-style")) return;
    const st = document.createElement("style");
    st.id = "gs2-style";
    st.textContent = GS2_CSS();
    document.head.appendChild(st);
  }
}

function GS2_CSS(): string {
  return `
.gs2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;}
.gs2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;max-width:420px;}
.gs2-task b{color:var(--c-orange);}
.gs2-chain{max-width:100%;height:auto;display:block;}
.gs2-gear{transform-box:fill-box;transform-origin:center;}
.gs2-gear--cw{animation:gs2-spin-cw 4s linear infinite;}
.gs2-gear--ccw{animation:gs2-spin-ccw 4s linear infinite;}
@keyframes gs2-spin-cw{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes gs2-spin-ccw{from{transform:rotate(0)}to{transform:rotate(-360deg)}}
.gs2-arrow-note{position:relative;font-size:2rem;font-weight:900;color:var(--c-orange);text-align:center;line-height:1;margin-top:-6px;}
.gs2-arrow-note small{font-size:.7rem;color:var(--ink-soft);font-weight:700;}
.gs2-opts{display:flex;gap:18px;margin-top:6px;}
.gs2-opt{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:110px;height:96px;font-size:2.4rem;font-weight:900;border:3px solid transparent;border-radius:18px;background:linear-gradient(160deg,#fff,#f0f0f5);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;color:var(--ink);}
.gs2-opt span{font-size:.85rem;font-weight:800;color:var(--ink-soft);}
.gs2-opt:active{transform:scale(.95);}
.gs2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:gs2-yes .4s ease;}
@keyframes gs2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.gs2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:gs2-no .3s ease;}
@keyframes gs2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.gs2-opt{width:92px;height:84px;font-size:2rem;}}
`;
}

export function create(): GearSpinGame {
  return new GearSpinGame();
}
