/* 卫星轨道 Satellite Orbit —— 几颗卫星在距星球不同距离的轨道上，
   孩子按"从近到远"的顺序依次点击卫星。
   独特点：通过轨道半径直观表达"距离"，每个卫星有独特配色和emoji；
   每个轨道半径随机生成且互不相同，近远关系唯一确定，保证有解。
   视觉：星空 + 中心星球 + 同心圆轨道 + 卫星。难度 = 卫星数。
   通关 = 顺序点对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { shuffle, randInt, getCssVar } from "../../lobby/util.ts";

interface Sat {
  /** 距离（用于排序，值越小越近） */
  dist: number;
  /** 轨道半径 px */
  radius: number;
  emoji: string;
  el: HTMLButtonElement;
  /** 在轨道上的角度（用于摆放） */
  angle: number;
}

const SAT_EMOJI = ["🛰️", "📡", "🛰️", "🛎️", "🛰️"] as const;
/* 用不同色环区分，emoji 配文字近/远概念由轨道半径承载 */

export class SatelliteOrbitGame extends BaseGame {
  constructor() {
    super("satellite-orbit");
  }

  private sceneEl!: HTMLDivElement;
  private sats: Sat[] = [];
  private nextIdx = 0; /* 下一个该点的（按 dist 升序排好后的下标） */
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private center = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.sats = [];
    this.nextIdx = 0;
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "sor-wrap";

    const task = document.createElement("div");
    task.className = "sor-task";
    task.innerHTML = `先点离地球最近的 🛰️，一个个往外点～<span class="sor-prog" id="sor-prog">${this.roundsDone + 1}/${this.roundTotal}</span>`;
    wrap.appendChild(task);

    this.sceneEl = document.createElement("div");
    this.sceneEl.className = "sor-scene";
    wrap.appendChild(this.sceneEl);

    const tip = document.createElement("div");
    tip.className = "sor-tip";
    tip.textContent = "越靠中心的卫星离星球越近 🪐";
    wrap.appendChild(tip);

    this.root.appendChild(wrap);

    requestAnimationFrame(() => this.layout());
  }

  private layout(): void {
    const r = this.sceneEl.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    this.center = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) / 2 - 26;
    const n = this.count();

    /* 生成 n 个互不相同的半径，保证间隔够大、最近>minR、最远<maxR */
    const minR = 46;
    const band = Math.max(8, (maxR - minR) / n);
    const radii: number[] = [];
    for (let i = 0; i < n; i++) {
      radii.push(minR + band * i + band * 0.5);
    }
    /* dist 用半径即可（半径越大越远），打乱摆放顺序但保留 dist */
    const order = shuffle(radii);

    /* 画轨道圆（SVG，按 dist 升序画细→粗 / 颜色由近到远） */
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "sor-orbits");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const sortedRadii = [...radii].sort((a, b) => a - b);
    for (const rad of sortedRadii) {
      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("cx", String(this.center));
      c.setAttribute("cy", String(cy));
      c.setAttribute("r", String(rad));
      svg.appendChild(c);
    }
    this.sceneEl.appendChild(svg);

    /* 中心星球 */
    const planet = document.createElement("div");
    planet.className = "sor-planet";
    planet.textContent = "🪐";
    planet.style.left = `${this.center}px`;
    planet.style.top = `${cy}px`;
    this.sceneEl.appendChild(planet);

    /* 卫星：每颗在不同角度摆放 */
    for (let i = 0; i < n; i++) {
      const radius = order[i]!;
      const angle = (i / n) * Math.PI * 2 + randInt(-15, 15) / 100;
      const sx = this.center + Math.cos(angle) * radius;
      const sy = cy + Math.sin(angle) * radius;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sor-sat";
      el.textContent = SAT_EMOJI[i % SAT_EMOJI.length]!;
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
      el.addEventListener("click", () => this.pick(sat));
      this.sceneEl.appendChild(el);
      const sat: Sat = {
        dist: radius,
        radius,
        emoji: el.textContent ?? "🛰️",
        el,
        angle,
      };
      this.sats.push(sat);
    }
    /* 按 dist 升序排好，作为正确顺序参考 */
    this.sats.sort((a, b) => a.dist - b.dist);
  }

  private pick(sat: Sat): void {
    if (this.locked) return;
    const expected = this.sats[this.nextIdx];
    if (sat === expected) {
      sat.el.classList.add("sor-sat--done");
      sat.el.disabled = true;
      sfxPop();
      this.nextIdx += 1;
      if (this.nextIdx >= this.sats.length) {
        this.roundDone();
      }
    } else {
      /* 点错：闪烁，温柔提示。不直接通关，可继续 */
      sat.el.classList.remove("sor-sat--bad");
      void sat.el.offsetWidth;
      sat.el.classList.add("sor-sat--bad");
      sfxTick();
      this.onWrong();
    }
  }

  private roundDone(): void {
    this.locked = true;
    const r = this.sceneEl.getBoundingClientRect();
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
    }, 800);
  }

  private injectStyle(): void {
    if (document.getElementById("sor-style")) return;
    const st = document.createElement("style");
    st.id = "sor-style";
    st.textContent = SOR_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function SOR_CSS(theme: string): string {
  return `
.sor-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.sor-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;}
.sor-prog{font-size:.85rem;background:${theme};color:#fff;padding:2px 10px;border-radius:999px;}
.sor-scene{position:relative;width:100%;height:62vh;min-height:340px;background:radial-gradient(circle at 30% 20%,#1a1a4a 0%,#0d0d2e 60%,#050518 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.sor-scene::before{content:"";position:absolute;inset:0;background-image:radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#fff,transparent),radial-gradient(1px 1px at 40% 80%,#fff,transparent),radial-gradient(2px 2px at 85% 25%,#fff,transparent),radial-gradient(1px 1px at 15% 70%,#fff,transparent),radial-gradient(1px 1px at 55% 15%,#fff,transparent);opacity:.7;pointer-events:none;}
.sor-orbits{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;}
.sor-orbits circle{fill:none;stroke:rgba(180,200,255,.25);stroke-width:1.5;stroke-dasharray:4 5;}
.sor-planet{position:absolute;font-size:2.6rem;transform:translate(-50%,-50%);z-index:2;filter:drop-shadow(0 0 10px rgba(120,150,255,.6));animation:sor-spin 8s linear infinite;}
@keyframes sor-spin{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
.sor-sat{position:absolute;font-size:1.7rem;width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.92);border:none;border-radius:50%;box-shadow:0 3px 8px rgba(0,0,0,.4),0 0 12px rgba(150,180,255,.5);transform:translate(-50%,-50%);z-index:3;cursor:pointer;padding:0;user-select:none;touch-action:manipulation;transition:transform .12s;}
.sor-sat:hover{transform:translate(-50%,-50%) scale(1.12);}
.sor-sat:active{transform:translate(-50%,-50%) scale(.94);}
.sor-sat--done{background:linear-gradient(135deg,#6bcf7f,#4CAF50);color:#fff;animation:sor-done .4s ease;}
@keyframes sor-done{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.4)}100%{transform:translate(-50%,-50%) scale(1.1)}}
.sor-sat--bad{animation:sor-bad .4s ease;}
@keyframes sor-bad{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-50%,-50%) rotate(-10deg)}75%{transform:translate(-50%,-50%) rotate(10deg)}}
.sor-tip{font-size:.9rem;color:#666;text-align:center;}
@media (max-width:380px){.sor-sat{font-size:1.4rem;width:36px;height:36px;}.sor-planet{font-size:2.2rem;}}
`;
}

export function create(): SatelliteOrbitGame {
  return new SatelliteOrbitGame();
}
