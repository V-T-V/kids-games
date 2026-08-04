/* 叶脉 Leaf Vein —— 叶子左半边画好叶脉（从主脉斜出的支脉），
   孩子在右半边的对称位置点击，补出镜像的叶脉。
   独特点：轴对称认知。每个左侧支脉在右侧有一个镜像"靶点"，点中即补全。
   视觉：叶子 SVG + 主脉 + 左侧实线支脉 + 右侧待补靶点。难度=支脉条数。通关=补全目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Vein {
  /** 左侧支脉沿主脉的相对位置 0..1（从顶到底） */
  t: number;
  /** 左侧支脉长度（相对叶宽） */
  len: number;
  /** 右侧靶点是否已补 */
  done: boolean;
}

export class LeafVeinGame extends BaseGame {
  constructor() {
    super("leaf-vein");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private veins: Vein[] = [];
  private busy = false;
  /** 容差（靶点像素半径内点中算对） */
  private hitR = 32;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* trackTimeout 自动清理 */
  }

  private veinCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 生成支脉：沿主脉均匀但有微小扰动，长度交替
    const n = this.veinCount();
    this.veins = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n + (Math.random() * 0.06 - 0.03);
      this.veins.push({
        t: Math.max(0.08, Math.min(0.92, t)),
        len: 0.18 + (i % 2 === 0 ? 0 : 0.04),
        done: false,
      });
    }

    const wrap = document.createElement("div");
    wrap.className = "lv-wrap";

    const task = document.createElement("div");
    task.className = "lv-task";
    task.innerHTML = `叶子右边缺了叶脉！点出和左边<b>对称</b>的位置补上～<br><span class="lv-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "lv-board";
    board.id = "lv-board";
    // SVG 叶子：使用 viewBox 0..400 宽，0..300 高
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 400 300");
    svg.setAttribute("class", "lv-svg");
    // 叶形（两半对称），用 path 画一个尖头椭圆叶
    const leaf = document.createElementNS("http://www.w3.org/2000/svg", "path");
    leaf.setAttribute(
      "d",
      "M200,20 C300,60 360,150 360,170 C360,240 280,280 200,280 C120,280 40,240 40,170 C40,150 100,60 200,20 Z",
    );
    leaf.setAttribute("class", "lv-leaf");
    svg.appendChild(leaf);
    // 中线（主脉）
    const mid = document.createElementNS("http://www.w3.org/2000/svg", "line");
    mid.setAttribute("x1", "200");
    mid.setAttribute("y1", "30");
    mid.setAttribute("x2", "200");
    mid.setAttribute("y2", "275");
    mid.setAttribute("class", "lv-mid");
    svg.appendChild(mid);

    // 左侧支脉（实线） + 右侧虚影靶点
    const mainTop = 40;
    const mainBottom = 265;
    this.veins.forEach((v, i) => {
      const y = mainTop + v.t * (mainBottom - mainTop);
      const len = v.len * 200; // 像素
      // 左支脉
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", "200");
      l.setAttribute("y1", String(y));
      l.setAttribute("x2", String(200 - len));
      l.setAttribute("y2", String(y + len * 0.5));
      l.setAttribute("class", "lv-vein-left");
      svg.appendChild(l);
      // 右侧靶点（虚线提示对称位置）
      const rx = 200 + len;
      const ry = y + len * 0.5;
      const ghost = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      ghost.setAttribute("cx", String(rx));
      ghost.setAttribute("cy", String(ry));
      ghost.setAttribute("r", "14");
      ghost.setAttribute("class", "lv-ghost");
      ghost.dataset.vein = String(i);
      svg.appendChild(ghost);
      // 右侧虚线支脉（未补时虚化）
      const rline = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      rline.setAttribute("x1", "200");
      rline.setAttribute("y1", String(y));
      rline.setAttribute("x2", String(rx));
      rline.setAttribute("y2", String(ry));
      rline.setAttribute("class", "lv-vein-right");
      rline.dataset.vein = String(i);
      svg.appendChild(rline);
    });

    board.appendChild(svg);
    wrap.appendChild(board);
    this.root.appendChild(wrap);

    // 点击 board（用 svg 坐标换算）
    board.addEventListener("pointerdown", (e: PointerEvent) =>
      this.onTap(e, board),
    );
  }

  private onTap(e: PointerEvent, board: HTMLElement): void {
    if (this.busy) return;
    const r = board.getBoundingClientRect();
    // 换算到 svg viewBox 坐标
    const sx = ((e.clientX - r.left) / r.width) * 400;
    const sy = ((e.clientY - r.top) / r.height) * 300;
    // 容差换算到 viewBox（约 32px 视觉 → 视图单位）
    const tol = (this.hitR / r.width) * 400;

    const mainTop = 40;
    const mainBottom = 265;
    let best = -1;
    let bestDist = Infinity;
    this.veins.forEach((v, i) => {
      if (v.done) return;
      const y = mainTop + v.t * (mainBottom - mainTop);
      const len = v.len * 200;
      const rx = 200 + len;
      const ry = y + len * 0.5;
      const d = Math.hypot(sx - rx, sy - ry);
      if (d < tol && d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best >= 0) {
      // 答对：补全该叶脉
      this.busy = true;
      const v = this.veins[best]!;
      v.done = true;
      // 把对应的 ghost 与 vein-right 标记为 done
      const ghosts = this.root.querySelectorAll<SVGCircleElement>(".lv-ghost");
      const lines =
        this.root.querySelectorAll<SVGLineElement>(".lv-vein-right");
      const g = ghosts[best];
      const l = lines[best];
      if (g) g.classList.add("lv-ghost--done");
      if (l) l.classList.add("lv-vein-right--done");
      sfxPop();
      const mainTop2 = 40;
      const mainBottom2 = 265;
      const len = v.len * 200;
      const px = r.left + ((200 + len) / 400) * r.width;
      const py =
        r.top +
        ((mainTop2 + v.t * (mainBottom2 - mainTop2) + len * 0.5) / 300) *
          r.height;
      this.onCorrect(px, py);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.busy = false;
        if (this.veins.every((vv) => vv.done)) {
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 700);
        }
      }, 200);
    } else {
      // 点空：温柔答错
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "左右两边是对称的，照着左边找右边一样的位置～",
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
    if (document.getElementById("lv-style")) return;
    const st = document.createElement("style");
    st.id = "lv-style";
    st.textContent = LV_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function LV_CSS(theme: string): string {
  return `
.lv-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.lv-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.lv-sub{font-size:.85rem;font-weight:600;color:var(--ink-soft,#888);}
.lv-board{position:relative;width:100%;background:linear-gradient(180deg,#f6fff0,#e3f6e3);border-radius:24px;box-shadow:var(--shadow);padding:8px;touch-action:none;cursor:crosshair;}
.lv-svg{width:100%;height:auto;display:block;}
.lv-leaf{fill:color-mix(in srgb,${theme} 35%,#fff);stroke:#3e8e3e;stroke-width:3;}
.lv-mid{stroke:#2f6b2f;stroke-width:4;stroke-linecap:round;}
.lv-vein-left{stroke:#2f6b2f;stroke-width:3.5;stroke-linecap:round;opacity:.95;}
.lv-vein-right{stroke:#9bca9b;stroke-width:3.5;stroke-linecap:round;stroke-dasharray:6 6;transition:all .3s;}
.lv-vein-right--done{stroke:#2f6b2f;stroke-dasharray:none;}
.lv-ghost{fill:rgba(255,255,255,.7);stroke:${theme};stroke-width:2;stroke-dasharray:4 3;cursor:pointer;transition:all .25s;}
.lv-ghost--done{opacity:0;}
`;
}

export function create(): LeafVeinGame {
  return new LeafVeinGame();
}
