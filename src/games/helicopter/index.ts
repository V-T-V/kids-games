/* 直升机救援 Helicopter —— 直升机在上方，下方有遇险的小动物，
   拖拽直升机下降到动物位置吊起。避开中间的云/鸟。
   独特点：拖拽玩法 + 危险区设定（云/鸟在中段），需精准对位避免碰到障碍。
   视觉：天空场景 + 直升机 + 动物 + 障碍（云朵/小鸟）。
   使用 bindPointer 实现拖拽直升机。难度=动物数/障碍数。通关=救起目标数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { randInt, sample, shuffle, getCssVar } from "../../lobby/util.ts";

interface Animal {
  emoji: string;
  x: number;
  y: number;
  el: HTMLDivElement;
  rescued: boolean;
}

interface Hazard {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
}

const ANIMAL_EMOJI = ["🐰", "🐱", "🐻", "🦊", "🐼"] as const;
const HAZARD_EMOJI = ["☁️", "🐦", "☁️"] as const;

export class HelicopterGame extends BaseGame {
  constructor() {
    super("helicopter");
  }

  private scene!: HTMLDivElement;
  private heli!: HTMLDivElement;
  private animals: Animal[] = [];
  private hazards: Hazard[] = [];
  private score = 0;
  private need = 0;
  private stop?: () => void;
  private unbind: (() => void) | null = null;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private dragging = false;
  /** 直升机中心坐标（相对 scene） */
  private hx = 0;
  private hy = 0;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.over = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.score = 0;
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.animals = [];
    this.hazards = [];
    this.root.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "hc-wrap";

    const task = document.createElement("div");
    task.className = "hc-task";
    task.innerHTML = `拖动直升机，下降到小动物位置救援！避开云朵和小鸟～<br><span id="hc-score" class="hc-score">🚁 已救 0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.scene = document.createElement("div");
    this.scene.className = "hc-scene";

    // 直升机
    this.heli = document.createElement("div");
    this.heli.className = "hc-heli";
    this.heli.textContent = "🚁";
    this.scene.appendChild(this.heli);

    wrap.appendChild(this.scene);
    this.root.appendChild(wrap);

    requestAnimationFrame(() => {
      const r = this.scene.getBoundingClientRect();
      // 生成动物（底部一条线上散布）
      const animalCount =
        this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
      const chosen = shuffle([...ANIMAL_EMOJI]).slice(0, animalCount);
      // 均匀分散在底部，保证可救援
      const margin = 40;
      const usable = r.width - margin * 2;
      for (let i = 0; i < animalCount; i++) {
        const a = document.createElement("div");
        a.className = "hc-animal";
        const emoji = chosen[i] ?? "🐱";
        a.textContent = emoji;
        const x = margin + (usable * i) / (animalCount - 1);
        const y = r.height - 50;
        a.style.left = `${x}px`;
        a.style.top = `${y}px`;
        this.scene.appendChild(a);
        this.animals.push({ emoji, x, y, el: a, rescued: false });
      }
      // 生成障碍（中段云/鸟），确保避开动物所在底部和直升机起始顶
      const hazardCount =
        this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
      const topBand = 90;
      const bandH = r.height - topBand - 100;
      for (let i = 0; i < hazardCount; i++) {
        const e = document.createElement("div");
        e.className = "hc-hazard";
        const emoji = sample(HAZARD_EMOJI);
        e.textContent = emoji;
        const x = randInt(30, Math.max(60, r.width - 100));
        const y = randInt(topBand, Math.max(topBand + 20, topBand + bandH));
        e.style.left = `${x}px`;
        e.style.top = `${y}px`;
        this.scene.appendChild(e);
        const vx = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.8);
        this.hazards.push({ el: e, x, y, vx, w: 44, h: 36 });
      }
      // 直升机初始位置：顶部居中
      this.hx = r.width / 2;
      this.hy = 36;
      this.placeHeli();
    });

    this.unbind = bindPointer(this.scene, {
      down: (p) => {
        this.dragging = true;
        this.moveHeli(p);
      },
      move: (p) => {
        if (this.dragging) this.moveHeli(p);
      },
      up: () => {
        this.dragging = false;
      },
    });

    this.stop = createRafLoop(() => this.tick());
  }

  private moveHeli(p: { x: number; y: number }): void {
    if (this.over) return;
    const r = this.scene.getBoundingClientRect();
    const x = Math.max(28, Math.min(r.width - 28, p.x - r.left));
    const y = Math.max(28, Math.min(r.height - 28, p.y - r.top));
    this.hx = x;
    this.hy = y;
    this.placeHeli();
  }

  private placeHeli(): void {
    this.heli.style.left = `${this.hx}px`;
    this.heli.style.top = `${this.hy}px`;
  }

  private tick = (): void => {
    if (this.over) {
      this.stop?.();
      this.stop = undefined;
      return;
    }
    const r = this.scene.getBoundingClientRect();
    const w = r.width;
    // 障碍移动
    for (const h of this.hazards) {
      h.x += h.vx;
      if (h.x < 10) {
        h.x = 10;
        h.vx = Math.abs(h.vx);
      }
      if (h.x > w - 50) {
        h.x = w - 50;
        h.vx = -Math.abs(h.vx);
      }
      h.el.style.left = `${h.x}px`;
    }
    // 检测：直升机撞到障碍 → 重开（保证可通关）
    for (const h of this.hazards) {
      if (
        Math.abs(this.hx - (h.x + h.w / 2)) < 26 &&
        Math.abs(this.hy - (h.y + h.h / 2)) < 26
      ) {
        this.end();
        return;
      }
    }
    // 检测：直升机接近动物 → 救起
    for (const a of this.animals) {
      if (a.rescued) continue;
      if (Math.abs(this.hx - a.x) < 30 && Math.abs(this.hy - a.y) < 34) {
        this.rescue(a);
      }
    }
  };

  private rescue(a: Animal): void {
    if (this.over || a.rescued) return;
    a.rescued = true;
    this.score += 1;
    sfxPop();
    const ar = a.el.getBoundingClientRect();
    burst(ar.left + ar.width / 2, ar.top + ar.height / 2, 12, [
      "heart",
      "star",
    ]);
    this.resetWrongStreak();
    a.el.classList.add("hc-animal--saved");
    this.trackTimeout(() => {
      a.el.remove();
      this.animals = this.animals.filter((x) => x !== a);
    }, 600);

    const sc = this.root.querySelector("#hc-score");
    if (sc) sc.textContent = `🚁 已救 ${this.score} / ${this.need}`;

    if (this.score >= this.need) {
      this.over = true;
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(
            this.wrongCount === 0 ? 3 : this.wrongCount <= 2 ? 2 : 1,
          );
        } else {
          this.startRound();
        }
      }, 700);
    }
  }

  private end(): void {
    if (this.over) return;
    this.over = true;
    this.heli.classList.add("hc-heli--hit");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      this.trackTimeout(() => this.startRound(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "撞到云啦，再来救援吧～",
      primary: {
        text: "再试一次",
        icon: "🚁",
        onClick: () => {
          ov.destroy();
          this.startRound();
        },
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
    if (document.getElementById("hc-style")) return;
    const st = document.createElement("style");
    st.id = "hc-style";
    st.textContent = HC_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function HC_CSS(theme: string): string {
  return `
.hc-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.hc-task{font-size:1rem;font-weight:800;text-align:center;line-height:1.5;}
.hc-score{display:inline-block;margin-top:4px;padding:3px 16px;border-radius:999px;background:#fff;color:${theme};box-shadow:var(--shadow);font-size:.95rem;}
.hc-scene{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#aee3ff 0%,#d6f0ff 45%,#bfe9d8 80%,#a5d6a7 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:grab;}
.hc-scene:active{cursor:grabbing;}
.hc-scene::before{content:"☁️ ☁️ ☁️";position:absolute;top:8px;left:0;font-size:1.6rem;letter-spacing:120px;opacity:.55;z-index:1;animation:hc-cloud 30s linear infinite;}
@keyframes hc-cloud{from{transform:translateX(0)}to{transform:translateX(-280px)}}
.hc-heli{position:absolute;font-size:2.4rem;z-index:6;transform:translate(-50%,-50%);filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));will-change:left,top;pointer-events:none;animation:hc-spin .18s linear infinite;}
@keyframes hc-spin{from{transform:translate(-50%,-50%) rotate(-3deg)}to{transform:translate(-50%,-50%) rotate(3deg)}}
.hc-animal{position:absolute;font-size:2rem;z-index:3;transform:translate(-50%,-50%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));animation:hc-wave 1s ease-in-out infinite alternate;pointer-events:none;}
@keyframes hc-wave{from{transform:translate(-50%,-50%) translateY(0)}to{transform:translate(-50%,-50%) translateY(-4px)}}
.hc-animal--saved{animation:hc-fly .6s ease forwards;}
@keyframes hc-fly{0%{transform:translate(-50%,-50%) scale(1)}100%{transform:translate(-50%,-120%) scale(.6);opacity:0}}
.hc-hazard{position:absolute;font-size:1.8rem;z-index:4;transform:translate(-50%,-50%);will-change:left;pointer-events:none;opacity:.95;}
.hc-heli--hit{animation:hc-shake .5s ease;}
@keyframes hc-shake{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(-55%,-50%)}75%{transform:translate(-45%,-50%)}}
`;
}

export function create(): HelicopterGame {
  return new HelicopterGame();
}
