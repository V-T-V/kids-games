/* 足球传球 Soccer Pass —— 球场上有几个编号球员，孩子按 1→2→…→N 的顺序
   点击球员，让球从一号开始依次传到最后。独特点：每次点对，足球带轨迹
   "飞"到下一名球员脚下，连线形成传球路线。难度=球员数（3/4/5/6）。
   通关=传完目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

interface PlayerPos {
  x: number; // 百分比坐标（相对场地）
  y: number;
}

/** 预设的球员阵型（不同人数有不同布局，保证编号顺序直观）。
 *  按 1..N 从左/上到右/下排列。 */
const FORMATIONS: Record<number, PlayerPos[]> = {
  3: [
    { x: 18, y: 50 },
    { x: 50, y: 28 },
    { x: 82, y: 50 },
  ],
  4: [
    { x: 16, y: 35 },
    { x: 38, y: 68 },
    { x: 62, y: 35 },
    { x: 84, y: 68 },
  ],
  5: [
    { x: 14, y: 50 },
    { x: 34, y: 28 },
    { x: 50, y: 64 },
    { x: 66, y: 28 },
    { x: 86, y: 50 },
  ],
  6: [
    { x: 14, y: 34 },
    { x: 34, y: 66 },
    { x: 44, y: 30 },
    { x: 56, y: 66 },
    { x: 66, y: 30 },
    { x: 86, y: 66 },
  ],
};

export class SoccerPassGame extends BaseGame {
  constructor() {
    super("soccer-pass");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private playerCount = 0;
  private nextIdx = 0; // 下一个该点的球员序号（0-based）
  private passed = 0;
  private ball!: HTMLDivElement;
  private positions: PlayerPos[] = [];
  private playerEls: HTMLButtonElement[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.playerCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.nextIdx = 0;
    this.passed = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const positions = FORMATIONS[this.playerCount]!;
    this.positions = positions;

    const wrap = document.createElement("div");
    wrap.className = "scp-wrap";

    const task = document.createElement("div");
    task.className = "scp-task";
    task.innerHTML = `按 <b>1→${this.playerCount}</b> 的顺序点球员传球（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const field = document.createElement("div");
    field.className = "scp-field";

    // SVG 连线层（传球轨迹）
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("scp-svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    field.appendChild(svg);

    // 球员
    this.playerEls = [];
    positions.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scp-player";
      btn.style.left = `${p.x}%`;
      btn.style.top = `${p.y}%`;
      btn.innerHTML = `<span class="scp-player__num">${i + 1}</span><span class="scp-player__body">🧑</span>`;
      if (i === 0) btn.classList.add("scp-player--next");
      btn.addEventListener("click", () => this.tap(i, btn, svg));
      field.appendChild(btn);
      this.playerEls.push(btn);
    });

    // 球（初始在 1 号脚下）
    this.ball = document.createElement("div");
    this.ball.className = "scp-ball";
    this.ball.textContent = "⚽";
    const first = positions[0]!;
    this.ball.style.left = `${first.x}%`;
    this.ball.style.top = `${first.y + 9}%`;
    field.appendChild(this.ball);

    wrap.appendChild(field);
    this.root.appendChild(wrap);
  }

  private tap(i: number, btn: HTMLButtonElement, svg: SVGSVGElement): void {
    if (btn.disabled) return;
    if (i === this.nextIdx) {
      btn.disabled = true;
      btn.classList.remove("scp-player--next");
      btn.classList.add("scp-player--done");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();

      // 画连线（从上一名球员到当前）
      const prev = this.positions[i - 1] ?? this.positions[i]!;
      const cur = this.positions[i]!;
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute("x1", String(prev.x));
      line.setAttribute("y1", String(prev.y));
      line.setAttribute("x2", String(cur.x));
      line.setAttribute("y2", String(cur.y));
      line.classList.add("scp-line");
      svg.appendChild(line);

      // 球飞过去
      this.ball.classList.add("scp-ball--fly");
      this.ball.style.left = `${cur.x}%`;
      this.ball.style.top = `${cur.y + 9}%`;
      this.trackTimeout(() => this.ball.classList.remove("scp-ball--fly"), 450);

      this.nextIdx += 1;
      this.passed += 1;
      // 标记下一个为高亮
      const next = this.playerEls[this.nextIdx];
      if (next) next.classList.add("scp-player--next");

      if (this.passed >= this.playerCount) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 900);
      }
    } else {
      btn.classList.add("scp-player--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("scp-player--wrong"), 420);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `先点编号 <b>${this.nextIdx + 1}</b> 的球员，让球传过去～`,
      primary: {
        text: "继续",
        icon: "⚽",
        onClick: () => ov.destroy(),
      },
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
    if (document.getElementById("scp-style")) return;
    const st = document.createElement("style");
    st.id = "scp-style";
    st.textContent = SCP_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SCP_CSS(theme: string): string {
  return `
.scp-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.scp-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.scp-task b{color:${theme};}
.scp-field{position:relative;width:100%;height:58vh;min-height:360px;background:linear-gradient(180deg,#4caf50,#388e3c);background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 10%,transparent 10% 20%);border-radius:20px;box-shadow:var(--shadow-lg);overflow:hidden;}
.scp-field::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 49.6%,rgba(255,255,255,.6) 49.6% 50.4%,transparent 50.4%),linear-gradient(180deg,transparent 49.6%,rgba(255,255,255,.6) 49.6% 50.4%,transparent 50.4%);opacity:.5;pointer-events:none;}
.scp-field::after{content:"";position:absolute;left:50%;top:50%;width:24%;height:24%;transform:translate(-50%,-50%);border:3px solid rgba(255,255,255,.6);border-radius:50%;pointer-events:none;}
.scp-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.scp-line{stroke:${theme};stroke-width:1.2;stroke-dasharray:2.4 1.8;opacity:.95;animation:scp-dash .6s linear infinite;}
@keyframes scp-dash{to{stroke-dashoffset:-4.2}}
.scp-player{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:transparent;cursor:pointer;transition:transform .1s ease;}
.scp-player:active{transform:translate(-50%,-50%) scale(.92);}
.scp-player__num{width:30px;height:30px;border-radius:50%;background:#fff;color:var(--ink);font-weight:900;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,.3);}
.scp-player__body{font-size:2.2rem;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));}
.scp-player--next .scp-player__num{background:${theme};color:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.6),0 0 12px ${theme};animation:scp-pulse 1s ease-in-out infinite;}
.scp-player--next .scp-player__body{transform:scale(1.08);}
@keyframes scp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.scp-player--done .scp-player__num{background:#ffd93d;}
.scp-player--wrong .scp-player__body{animation:scp-shake .4s ease;}
@keyframes scp-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.scp-ball{position:absolute;transform:translate(-50%,-50%);font-size:1.7rem;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));z-index:5;transition:left .42s cubic-bezier(.4,0,.5,1),top .42s cubic-bezier(.4,0,.5,1);}
.scp-ball--fly{animation:scp-arc .42s ease;}
@keyframes scp-arc{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.2) rotate(180deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(360deg)}}
@media (max-width:380px){.scp-player__body{font-size:1.8rem;}.scp-ball{font-size:1.4rem;}}
`;
}

export function create(): SoccerPassGame {
  return new SoccerPassGame();
}
