/* 穿线板 Lace Board —— 木板上有带编号的孔洞，孩子从 1 号孔开始，
   按编号顺序拖动绳子依次穿过每个孔。独特点：编号顺序 + 拖拽精细动作。
   视觉：木纹背景板 + 编号孔 + 跟随手指的彩色绳子（用 SVG 路径绘制）。
   巧思：绳子用一条 SVG path 实时绘制，每穿过一孔亮起该孔并播放穿绳音效。
   难度 = 孔数（4/6/9）。通关 = 完成目标轮数。前缀 lcb-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Hole {
  /** 编号 1..n */
  num: number;
  x: number; // 百分比 0..100
  y: number; // 百分比 0..100
  el: HTMLDivElement;
  laced: boolean;
}

export class LaceBoardGame extends BaseGame {
  constructor() {
    super("lace-board");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private holes: Hole[] = [];
  /** 绳子已穿过的点位（用画板坐标，百分比） */
  private ropePts: { x: number; y: number }[] = [];
  /** 当前手指所在位置（百分比） */
  private cursor: { x: number; y: number } | null = null;
  private svg!: SVGSVGElement;
  private pathEl!: SVGPathElement;
  private nextNum = 1;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  /** 难度=孔数。 */
  private holeCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 9;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.holes = [];
    this.ropePts = [];
    this.cursor = null;
    this.nextNum = 1;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.holeCount();
    const wrap = document.createElement("div");
    wrap.className = "lcb-wrap";

    const head = document.createElement("div");
    head.className = "lcb-head";
    const task = document.createElement("div");
    task.className = "lcb-task";
    task.innerHTML = `从 <b>1</b> 号开始，按编号顺序拖绳子穿过每个孔～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    const helpBtn = document.createElement("button");
    helpBtn.type = "button";
    helpBtn.className = "lcb-help";
    helpBtn.textContent = "❓";
    helpBtn.setAttribute("aria-label", "怎么玩");
    helpBtn.addEventListener("click", () => this.showRest());
    head.appendChild(task);
    head.appendChild(helpBtn);
    wrap.appendChild(head);

    const board = document.createElement("div");
    board.className = "lcb-board";

    // SVG 层：绘制绳子
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "lcb-svg");
    this.svg.setAttribute("viewBox", "0 0 100 100");
    this.svg.setAttribute("preserveAspectRatio", "none");
    this.pathEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    this.pathEl.setAttribute("class", "lcb-rope");
    this.svg.appendChild(this.pathEl);
    board.appendChild(this.svg);

    // 生成孔洞位置：在板上铺一个网格 + 小扰动，保证可解且分布均匀
    const cols = n <= 4 ? 2 : n <= 6 ? 3 : 3;
    const rows = Math.ceil(n / cols);
    const positions: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (positions.length >= n) break;
        const jx = (Math.random() - 0.5) * 8;
        const jy = (Math.random() - 0.5) * 8;
        positions.push({
          x: ((c + 0.5) / cols) * 80 + 10 + jx,
          y: ((r + 0.5) / rows) * 80 + 10 + jy,
        });
      }
    }
    // 编号按 y 再 x 排序，让"自然阅读顺序"接近编号顺序（但仍需孩子辨识数字）
    positions.sort((a, b) => a.y - b.y || a.x - b.x);
    const shuffledPos = shuffle(positions);

    for (let i = 0; i < n; i++) {
      const pos = shuffledPos[i]!;
      const el = document.createElement("div");
      el.className = "lcb-hole";
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
      el.innerHTML = `<span class="lcb-hole__num">${i + 1}</span><span class="lcb-hole__ring"></span>`;
      board.appendChild(el);
      this.holes.push({ num: i + 1, x: pos.x, y: pos.y, el, laced: false });
    }
    wrap.appendChild(board);
    this.root.appendChild(wrap);

    // 用一个透明的覆盖层接收拖拽（覆盖整个板）
    const overlay = document.createElement("div");
    overlay.className = "lcb-drag";
    board.appendChild(overlay);

    const unbind = bindPointer(overlay, {
      down: (p) => this.onDown(p, board),
      move: (p) => this.onMove(p, board),
      up: () => this.onUp(),
    });
    this.unbinds.push(unbind);

    this.drawRope();
  }

  /** 把屏幕坐标转成板内百分比。 */
  private toLocal(
    p: { x: number; y: number },
    board: HTMLElement,
  ): { x: number; y: number } {
    const r = board.getBoundingClientRect();
    const x = ((p.x - r.left) / r.width) * 100;
    const y = ((p.y - r.top) / r.height) * 100;
    return { x, y };
  }

  private onDown(p: { x: number; y: number }, board: HTMLElement): void {
    // 必须从当前目标孔附近开始拖
    const target = this.holes.find((h) => h.num === this.nextNum);
    if (!target || target.laced) return;
    const local = this.toLocal(p, board);
    const dx = local.x - target.x;
    const dy = local.y - target.y;
    if (Math.hypot(dx, dy) > 12) return; // 必须从目标孔附近起手
    // 锚定到孔中心，开始穿绳
    this.ropePts = [{ x: target.x, y: target.y }];
    this.cursor = local;
    target.laced = true;
    target.el.classList.add("lcb-hole--done");
    sfxPop();
  }

  private onMove(p: { x: number; y: number }, board: HTMLElement): void {
    if (this.ropePts.length === 0) return;
    const local = this.toLocal(p, board);
    this.cursor = local;
    // 检测是否经过下一个孔
    const nextTarget = this.holes.find((h) => h.num === this.nextNum + 1);
    if (nextTarget && !nextTarget.laced) {
      const dx = local.x - nextTarget.x;
      const dy = local.y - nextTarget.y;
      if (Math.hypot(dx, dy) < 10) {
        // 穿过该孔
        this.ropePts.push({ x: nextTarget.x, y: nextTarget.y });
        nextTarget.laced = true;
        nextTarget.el.classList.add("lcb-hole--done");
        this.nextNum += 1;
        sfxPop();
        const r = nextTarget.el.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        // 若全部穿过则通关本关
        if (this.nextNum > this.holes.length) {
          this.cursor = null;
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 900);
          this.drawRope();
          return;
        }
      }
    }
    this.drawRope();
  }

  private onUp(): void {
    // 中途松手：如果还没完成，绳子收回（但不扣分，鼓励重试）
    if (this.nextNum <= this.holes.length) {
      // 保留已穿过的孔，绳子回缩到最后一个已穿过孔
      const lastDone = this.holes
        .filter((h) => h.laced)
        .sort((a, b) => a.num - b.num)
        .pop();
      if (lastDone) {
        this.ropePts = [{ x: lastDone.x, y: lastDone.y }];
      } else {
        this.ropePts = [];
      }
      this.cursor = null;
      this.drawRope();
    }
  }

  private drawRope(): void {
    const pts = [...this.ropePts];
    if (this.cursor && pts.length > 0) pts.push(this.cursor);
    if (pts.length === 0) {
      this.pathEl.setAttribute("d", "");
      return;
    }
    let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i]!.x} ${pts[i]!.y}`;
    }
    this.pathEl.setAttribute("d", d);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧵",
      variant: "rest",
      body: "看看下一个数字是几，把绳子拖到那个孔上～",
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
    if (document.getElementById("lcb-style")) return;
    const st = document.createElement("style");
    st.id = "lcb-style";
    st.textContent = LCB_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function LCB_CSS(theme: string): string {
  return `
.lcb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.lcb-head{display:flex;align-items:center;gap:10px;width:100%;justify-content:center;}
.lcb-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;flex:1;}
.lcb-help{flex:none;width:38px;height:38px;border-radius:50%;border:none;background:#fff;font-size:1.2rem;box-shadow:var(--shadow);cursor:pointer;}
.lcb-board{position:relative;width:min(380px,86vw);aspect-ratio:1/1;background:linear-gradient(135deg,#d8a06a,#c68b54);border-radius:22px;box-shadow:inset 0 0 24px rgba(90,50,20,.35),var(--shadow);background-image:repeating-linear-gradient(90deg,rgba(120,70,30,.08) 0 3px,transparent 3px 9px),linear-gradient(135deg,#d8a06a,#c68b54);touch-action:none;user-select:none;overflow:hidden;}
.lcb-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;}
.lcb-rope{fill:none;stroke:${theme};stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 1px rgba(0,0,0,.3));}
.lcb-hole{position:absolute;width:46px;height:46px;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;z-index:2;cursor:pointer;}
.lcb-hole__ring{position:absolute;inset:6px;border-radius:50%;background:radial-gradient(circle,#3a2515 0 38%,#5a3820 38% 60%,transparent 60%);box-shadow:0 2px 4px rgba(0,0,0,.4);}
.lcb-hole__num{position:relative;z-index:2;background:#fff;color:#333;width:22px;height:22px;border-radius:50%;font-size:.85rem;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.4);}
.lcb-hole--done .lcb-hole__num{background:${theme};color:#fff;animation:lcb-pop .35s ease;}
.lcb-hole--done .lcb-hole__ring{background:radial-gradient(circle,${theme} 0 38%,#a06030 38% 60%,transparent 60%);}
.lcb-drag{position:absolute;inset:0;z-index:5;cursor:grab;}
.lcb-drag:active{cursor:grabbing;}
@keyframes lcb-pop{0%{transform:scale(.5)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
@media (max-width:380px){.lcb-hole{width:38px;height:38px;}.lcb-hole__num{width:18px;height:18px;font-size:.72rem;}}
`;
}

export function create(): LaceBoardGame {
  return new LaceBoardGame();
}
