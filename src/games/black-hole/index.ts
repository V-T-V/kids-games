/* 黑洞 Black Hole —— 中心是黑洞，周围有不同颜色的星球。
   题目给出颜色要求（如"吸走红色的"），孩子点对应色的星球，
   星球被黑洞引力吸入。点错色提示温柔反馈。
   独特点：点击 + 颜色匹配 + 引力吸入动画；每关目标色至少存在一个星球，
   保证有解。视觉：星空 + 中心黑洞 + 彩色星球。难度 = 星球数。
   通关 = 吸对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { shuffle, sample, getCssVar } from "../../lobby/util.ts";

interface Planet {
  el: HTMLButtonElement;
  color: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  gone: boolean;
}

const COLORS = [
  { hex: "#ff6348", name: "红色" },
  { hex: "#ffd93d", name: "黄色" },
  { hex: "#4d96ff", name: "蓝色" },
  { hex: "#6bcf7f", name: "绿色" },
  { hex: "#a55eea", name: "紫色" },
  { hex: "#ff9f43", name: "橙色" },
];

const PLANET_EMOJI = ["🔵", "🔴", "🟡", "🟢", "🟣", "🟠"] as const;

export class BlackHoleGame extends BaseGame {
  constructor() {
    super("black-hole");
  }

  private sceneEl!: HTMLDivElement;
  private holeEl!: HTMLDivElement;
  private planets: Planet[] = [];
  private targetColor = "";
  private targetName = "";
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private cx = 0;
  private cy = 0;

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
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.planets = [];
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 选目标色 */
    const target = sample(COLORS);
    this.targetColor = target.hex;
    this.targetName = target.name;

    const wrap = document.createElement("div");
    wrap.className = "bhl-wrap";

    const task = document.createElement("div");
    task.className = "bhl-task";
    task.innerHTML = `点 <span class="bhl-chip" style="background:${target.hex}">${target.name}</span> 的星球，让黑洞吸走它！<span class="bhl-prog">${this.roundsDone + 1}/${this.roundTotal}</span>`;
    wrap.appendChild(task);

    this.sceneEl = document.createElement("div");
    this.sceneEl.className = "bhl-scene";
    this.holeEl = document.createElement("div");
    this.holeEl.className = "bhl-hole";
    this.sceneEl.appendChild(this.holeEl);
    wrap.appendChild(this.sceneEl);

    this.root.appendChild(wrap);

    requestAnimationFrame(() => this.layout(target));
  }

  private layout(target: { hex: string; name: string }): void {
    const r = this.sceneEl.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    this.cx = w / 2;
    this.cy = h / 2;
    this.holeEl.style.left = `${this.cx}px`;
    this.holeEl.style.top = `${this.cy}px`;

    const n = this.count();
    const radius = Math.min(w, h) / 2 - 40;
    /* 颜色集合：必含目标色 + 其余随机；保证目标色至少 1 个 */
    const others = shuffle(COLORS.filter((c) => c.hex !== target.hex));
    const palette = [target, ...others.slice(0, n - 1)];
    const colors = shuffle(palette);

    for (let i = 0; i < n; i++) {
      const c = colors[i] ?? target;
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = this.cx + Math.cos(angle) * radius;
      const py = this.cy + Math.sin(angle) * radius;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "bhl-planet";
      const emojiIdx = COLORS.findIndex((cc) => cc.hex === c.hex);
      const emoji = PLANET_EMOJI[emojiIdx >= 0 ? emojiIdx : 0] ?? "🔵";
      el.textContent = emoji;
      el.style.setProperty("--bhl-c", c.hex);
      el.style.left = `${px}px`;
      el.style.top = `${py}px`;
      el.addEventListener("click", () => this.pick(planet, c));
      this.sceneEl.appendChild(el);
      const planet: Planet = {
        el,
        color: c.hex,
        name: c.name,
        emoji,
        x: px,
        y: py,
        gone: false,
      };
      this.planets.push(planet);
    }
  }

  private pick(planet: Planet, c: { hex: string; name: string }): void {
    if (this.locked || planet.gone) return;
    if (c.hex === this.targetColor) {
      this.locked = true;
      planet.gone = true;
      planet.el.classList.add("bhl-planet--suck");
      /* 计算飞向黑洞的位移 */
      const dx = this.cx - planet.x;
      const dy = this.cy - planet.y;
      planet.el.style.setProperty("--bhl-dx", `${dx}px`);
      planet.el.style.setProperty("--bhl-dy", `${dy}px`);
      sfxPop();
      const r = this.holeEl.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => planet.el.remove(), 600);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    } else {
      /* 点错：星球闪一下 */
      planet.el.classList.remove("bhl-planet--bad");
      void planet.el.offsetWidth;
      planet.el.classList.add("bhl-planet--bad");
      this.onWrong();
    }
  }

  private injectStyle(): void {
    if (document.getElementById("bhl-style")) return;
    const st = document.createElement("style");
    st.id = "bhl-style";
    st.textContent = BHL_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function BHL_CSS(theme: string): string {
  return `
.bhl-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.bhl-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;}
.bhl-chip{color:#fff;padding:3px 12px;border-radius:999px;font-size:.95rem;box-shadow:0 2px 4px rgba(0,0,0,.2);}
.bhl-prog{background:${theme};color:#fff;padding:2px 10px;border-radius:999px;font-size:.85rem;}
.bhl-scene{position:relative;width:100%;height:64vh;min-height:380px;background:radial-gradient(circle at 50% 50%,#1a1a3a 0%,#0a0a22 60%,#050510 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.bhl-scene::before{content:"";position:absolute;inset:0;background-image:radial-gradient(1px 1px at 10% 15%,#fff,transparent),radial-gradient(1px 1px at 25% 40%,#fff,transparent),radial-gradient(2px 2px at 60% 20%,#fff,transparent),radial-gradient(1px 1px at 80% 50%,#fff,transparent),radial-gradient(1px 1px at 45% 80%,#fff,transparent),radial-gradient(1px 1px at 90% 75%,#fff,transparent);opacity:.6;pointer-events:none;}
.bhl-hole{position:absolute;width:90px;height:90px;transform:translate(-50%,-50%);z-index:2;border-radius:50%;background:radial-gradient(circle,#000 35%,#2a0a3a 60%,transparent 80%);box-shadow:0 0 30px 8px rgba(150,80,220,.6),inset 0 0 20px #000;animation:bhl-swirl 4s linear infinite;}
.bhl-hole::after{content:"";position:absolute;inset:-14px;border-radius:50%;border:3px dashed rgba(180,140,255,.5);animation:bhl-spin 3s linear infinite;}
@keyframes bhl-swirl{0%,100%{box-shadow:0 0 30px 8px rgba(150,80,220,.6),inset 0 0 20px #000}50%{box-shadow:0 0 42px 12px rgba(180,100,255,.85),inset 0 0 20px #000}}
@keyframes bhl-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.bhl-planet{position:absolute;font-size:2rem;line-height:1;width:46px;height:46px;display:flex;align-items:center;justify-content:center;background:var(--bhl-c);border:none;border-radius:50%;transform:translate(-50%,-50%);z-index:3;box-shadow:0 4px 8px rgba(0,0,0,.4),0 0 0 3px rgba(255,255,255,.4) inset;cursor:pointer;padding:0;user-select:none;touch-action:manipulation;transition:transform .12s;animation:bhl-orbit 3s ease-in-out infinite alternate;}
@keyframes bhl-orbit{from{transform:translate(-50%,-50%) scale(1)}to{transform:translate(-50%,-50%) scale(1.06)}}
.bhl-planet:hover{transform:translate(-50%,-50%) scale(1.18);}
.bhl-planet:active{transform:translate(-50%,-50%) scale(.92);}
.bhl-planet--bad{animation:bhl-shake .4s ease;}
@keyframes bhl-shake{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-50%,-50%) rotate(-12deg)}75%{transform:translate(-50%,-50%) rotate(12deg)}}
.bhl-planet--suck{animation:bhl-suck .55s ease forwards;pointer-events:none;}
@keyframes bhl-suck{0%{transform:translate(-50%,-50%) scale(1)}60%{transform:translate(calc(-50% + var(--bhl-dx,0)*.6),calc(-50% + var(--bhl-dy,0)*.6)) scale(.6)}100%{transform:translate(calc(-50% + var(--bhl-dx,0)),calc(-50% + var(--bhl-dy,0))) scale(.1);opacity:0}}
@media (max-width:380px){.bhl-hole{width:72px;height:72px;}.bhl-planet{font-size:1.6rem;width:38px;height:38px;}}
`;
}

export function create(): BlackHoleGame {
  return new BlackHoleGame();
}
