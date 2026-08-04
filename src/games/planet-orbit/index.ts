/* 行星轨道 Planet Orbit —— 太阳居中，行星沿椭圆轨道运动；题目问某行星，点击它。
   独特点：CSS 椭圆轨道 + 太阳脉动发光 + 行星实时公转（RAF）。
   巧思：每题随机抽一个目标行星，行星库按难度递增数量。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface PlanetDef {
  name: string;
  emoji: string;
  color: string;
  /** 公转半径倍率（相对基础半径） */
  radius: number;
  /** 公转角速度（弧度/帧 @60fps） */
  speed: number;
}

// 行星库：水星→土星，由近及远
const PLANETS: PlanetDef[] = [
  { name: "水星", emoji: "☿️", color: "#b0a090", radius: 0.5, speed: 0.03 },
  { name: "金星", emoji: "♀️", color: "#e8c07a", radius: 0.7, speed: 0.022 },
  { name: "地球", emoji: "🌍", color: "#4d96ff", radius: 0.92, speed: 0.018 },
  { name: "火星", emoji: "🔴", color: "#ff6348", radius: 1.12, speed: 0.015 },
  { name: "木星", emoji: "🟠", color: "#ffb74d", radius: 1.38, speed: 0.01 },
  { name: "土星", emoji: "🪐", color: "#ffd27d", radius: 1.62, speed: 0.008 },
];

export class PlanetOrbitGame extends BaseGame {
  constructor() {
    super("planet-orbit");
  }
  private raf = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  /** 过渡锁：答对后 850ms 动画期间禁止再点，防双击跳题。 */
  private busy = false;
  private active: PlanetDef[] = [];
  private angles: number[] = [];
  private planetEls: HTMLDivElement[] = [];
  private board!: HTMLDivElement;
  private target = "";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
  }

  /** 本轮参与公转的行星数（由近及远取前 N 个） */
  private count(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 6;
  }

  private startRound(): void {
    this.busy = false; // 解除过渡锁
    cancelAnimationFrame(this.raf);
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.count();
    this.active = PLANETS.slice(0, n);
    this.angles = this.active.map(
      (_, i) => (i * Math.PI * 2) / n + Math.random(),
    );
    this.planetEls = [];

    const wrap = document.createElement("div");
    wrap.className = "po-wrap";

    // 题目：随机选一个目标行星
    this.target = sample(this.active).name;
    const task = document.createElement("div");
    task.className = "po-task";
    task.innerHTML = `点一点：哪个是 <b>${this.target}</b>？<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 题</small>`;
    wrap.appendChild(task);

    this.board = document.createElement("div");
    this.board.className = "po-board";

    // 轨道椭圆（装饰）
    this.active.forEach((p) => {
      const o = document.createElement("div");
      o.className = "po-orbit";
      o.style.setProperty("--r", String(p.radius));
      this.board.appendChild(o);
    });

    // 太阳
    const sun = document.createElement("div");
    sun.className = "po-sun";
    sun.innerHTML = "<span>☀️</span>";
    this.board.appendChild(sun);

    // 行星
    this.active.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "po-planet";
      el.title = p.name;
      const emoji = document.createElement("span");
      emoji.className = "po-planet__emoji";
      emoji.textContent = p.emoji;
      el.appendChild(emoji);
      const lab = document.createElement("span");
      lab.className = "po-planet__name";
      lab.textContent = p.name;
      el.appendChild(lab);
      el.style.color = p.color;
      el.addEventListener("click", () => this.onPlanet(i));
      this.board.appendChild(el);
      this.planetEls.push(el);
    });

    wrap.appendChild(this.board);
    this.root.appendChild(wrap);

    this.loop();
  }

  private loop = (): void => {
    const rect = this.board.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const base = Math.min(rect.width, rect.height) * 0.16; // 基础半径
    for (let i = 0; i < this.active.length; i++) {
      const p = this.active[i]!;
      this.angles[i] = (this.angles[i]! + p.speed) % (Math.PI * 2);
      const a = this.angles[i]!;
      // 椭圆：x 方向稍大，y 方向略压
      const rx = base * p.radius * 1.15;
      const ry = base * p.radius * 0.92;
      const x = cx + rx * Math.cos(a);
      const y = cy + ry * Math.sin(a);
      const el = this.planetEls[i]!;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private onPlanet(i: number): void {
    if (this.busy) return; // 过渡锁：防双击跳题
    const p = this.active[i]!;
    if (p.name !== this.target) {
      const el = this.planetEls[i]!;
      el.classList.add("po-planet--shake");
      this.trackTimeout(() => el.classList.remove("po-planet--shake"), 360);
      this.onWrong();
      return;
    }
    this.busy = true; // 锁定
    sfxPop();
    const el = this.planetEls[i]!;
    el.classList.add("po-planet--hit");
    const r = el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.roundsDone += 1;
    this.resetWrongStreak();
    cancelAnimationFrame(this.raf);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 850);
  }

  private injectStyle(): void {
    if (document.getElementById("po-style")) return;
    const st = document.createElement("style");
    st.id = "po-style";
    st.textContent = PO_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function PO_CSS(theme: string): string {
  return `
.po-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(640px,100%);}
.po-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.po-task b{color:${theme};}
.po-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.po-board{position:relative;width:min(440px,92vw);height:min(440px,80vh);min-height:360px;background:radial-gradient(ellipse at 50% 50%,#1a2348,#070a1c 80%);border-radius:28px;box-shadow:var(--shadow-lg),inset 0 0 60px rgba(99,102,241,.2);overflow:hidden;}
.po-orbit{position:absolute;left:50%;top:50%;border:1.5px dashed rgba(180,190,255,.16);border-radius:50%;transform:translate(-50%,-50%);width:calc(var(--r,1) * 32%);height:calc(var(--r,1) * 25.6%);pointer-events:none;}
.po-sun{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:3rem;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:radial-gradient(circle,#fff6b0,#ffb300 60%,#ff6f00);box-shadow:0 0 30px #ffb300,0 0 60px #ff8f00aa;animation:po-pulse 2.4s ease-in-out infinite;pointer-events:none;}
.po-sun span{filter:drop-shadow(0 0 6px #fff);}
@keyframes po-pulse{0%,100%{box-shadow:0 0 30px #ffb300,0 0 60px #ff8f00aa}50%{box-shadow:0 0 46px #ffd54a,0 0 90px #ff9a2baa}}
.po-planet{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;transition:transform .15s ease;z-index:3;}
.po-planet__emoji{font-size:2rem;filter:drop-shadow(0 0 8px currentColor);transition:transform .15s ease;}
.po-planet__name{font-size:.7rem;font-weight:800;color:#fff;background:rgba(0,0,0,.35);padding:1px 6px;border-radius:999px;opacity:.85;}
.po-planet:hover .po-planet__emoji{transform:scale(1.22);}
.po-planet:active{transform:translate(-50%,-50%) scale(.9);}
.po-planet--hit .po-planet__emoji{transform:scale(1.6);animation:po-hit .8s ease;}
@keyframes po-hit{0%{filter:drop-shadow(0 0 8px currentColor)}50%{filter:drop-shadow(0 0 26px #fff) brightness(1.5)}100%{filter:drop-shadow(0 0 8px currentColor)}}
.po-planet--shake{animation:po-shake .36s ease;}
@keyframes po-shake{0%,100%{margin-left:0}25%{margin-left:-6px}50%{margin-left:6px}75%{margin-left:-4px}}
`;
}

export function create(): PlanetOrbitGame {
  return new PlanetOrbitGame();
}
