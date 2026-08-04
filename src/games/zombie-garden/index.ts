/* 僵尸园 Zombie Garden —— 花园里僵尸一步一步靠近，孩子在僵尸前方格子种下
   对应颜色的花来驱赶它们。
   独特点：颜色匹配 + 简单策略。每个僵尸头顶显示它"怕"的花色，孩子点花盘
   选色，再点僵尸前的空地种花；种对颜色僵尸被花香吓退消失。
   视觉：花园草地 + 慢慢挪动的僵尸 + 花盘。难度=僵尸数量。通关=驱赶目标轮数。
   解保证：每个僵尸的目标颜色都出现在花盘里。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const FLOWERS = [
  { emoji: "🌹", color: "#ff6b9d", name: "红" },
  { emoji: "🌻", color: "#ffd93d", name: "黄" },
  { emoji: "🌼", color: "#ff9f43", name: "橙" },
  { emoji: "🌷", color: "#a55eea", name: "紫" },
  { emoji: "💙", color: "#4d96ff", name: "蓝" },
] as const;

interface Zombie {
  el: HTMLDivElement;
  /** 怕的花色索引（FLOWERS 的下标）。 */
  flower: number;
  gone: boolean;
}

export class ZombieGardenGame extends BaseGame {
  constructor() {
    super("zombie-garden");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private curFlower = -1;
  private zombies: Zombie[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 + trackTimeout 自动清理 */
  }

  private zombieCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.zombies = [];
    this.curFlower = -1;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "zgb-wrap";

    const task = document.createElement("div");
    task.className = "zgb-task";
    task.innerHTML = `先选一朵花，再点僵尸把它赶走！（第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const garden = document.createElement("div");
    garden.className = "zgb-garden";

    // 目标颜色集合：保证花盘里有每个僵尸的目标色
    const n = this.zombieCount();
    const flowerPool = shuffle(FLOWERS.map((_, i) => i)).slice(
      0,
      Math.min(n, FLOWERS.length),
    );
    // 每个僵尸的目标色从 flowerPool 里取，确保花盘一定有解
    const targets: number[] = [];
    for (let i = 0; i < n; i++) targets.push(sample(flowerPool));

    // 僵尸分布在不同的"通道"行
    for (let i = 0; i < n; i++) {
      const z = document.createElement("div");
      z.className = "zgb-zombie";
      z.style.top = `${12 + i * (70 / Math.max(1, n - 1))}%`;
      const want = FLOWERS[targets[i]!]!;
      z.innerHTML = `<span class="zgb-bubble">${want.emoji}</span><span class="zgb-body">🧟</span>`;
      const zObj: Zombie = { el: z, flower: targets[i]!, gone: false };
      z.addEventListener("click", () => this.zap(zObj));
      garden.appendChild(z);
      this.zombies.push(zObj);
    }
    wrap.appendChild(garden);

    // 花盘：包含所有目标色 + 干扰
    const palette = document.createElement("div");
    palette.className = "zgb-palette";
    const targetSet = Array.from(new Set(targets));
    const distract = shuffle(
      FLOWERS.map((_, i) => i).filter((i) => !targetSet.includes(i)),
    ).slice(0, 1);
    for (const idx of shuffle([...targetSet, ...distract])) {
      const f = FLOWERS[idx]!;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "zgb-flower";
      b.dataset.idx = String(idx);
      b.style.setProperty("--zgb-color", f.color);
      b.innerHTML = `<span>${f.emoji}</span>`;
      b.addEventListener("click", () => this.pickFlower(idx));
      palette.appendChild(b);
    }
    wrap.appendChild(palette);
    this.root.appendChild(wrap);
  }

  private pickFlower(idx: number): void {
    this.curFlower = idx;
    sfxPop();
    this.root
      .querySelectorAll<HTMLButtonElement>(".zgb-flower")
      .forEach((b) =>
        b.classList.toggle("zgb-flower--sel", b.dataset.idx === String(idx)),
      );
  }

  private zap(z: Zombie): void {
    if (z.gone) return;
    if (this.curFlower < 0) {
      // 没选花：抖一下提示
      z.el.classList.remove("zgb-shake");
      void z.el.offsetWidth;
      z.el.classList.add("zgb-shake");
      return;
    }
    if (this.curFlower !== z.flower) {
      z.el.classList.remove("zgb-shake");
      void z.el.offsetWidth;
      z.el.classList.add("zgb-shake");
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    // 答对：种花 + 僵尸被赶走
    z.gone = true;
    const r = z.el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    z.el.classList.add("zgb-zombie--gone");
    this.trackTimeout(() => z.el.remove(), 700);

    // 本关全部赶走
    if (this.zombies.every((x) => x.gone)) {
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看僵尸头顶想要哪朵花，选一样的再点它～",
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
    if (document.getElementById("zgb-style")) return;
    const st = document.createElement("style");
    st.id = "zgb-style";
    st.textContent = ZGB_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function ZGB_CSS(theme: string): string {
  return `
.zgb-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.zgb-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.zgb-garden{position:relative;width:100%;height:56vh;min-height:300px;background:
  repeating-linear-gradient(90deg,#7ec850 0 24px,#74c045 24px 48px),
  linear-gradient(180deg,#a8e063,#56ab2f);
  border-radius:24px;box-shadow:var(--shadow);overflow:hidden;border:4px solid #4a8b3a;}
.zgb-garden::after{content:"🌻🌷🌼🌹🌻";position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:1.4rem;opacity:.5;letter-spacing:8px;}
.zgb-zombie{position:absolute;left:8px;font-size:2.6rem;transform:translateY(-50%);cursor:pointer;transition:left .3s ease,opacity .4s,transform .4s;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3));animation:zgb-walk 1.6s ease-in-out infinite;user-select:none;}
.zgb-zombie:hover{transform:translateY(-50%) scale(1.05);}
.zgb-bubble{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#fff;box-shadow:var(--shadow);font-size:1.1rem;position:relative;top:-14px;left:-6px;border:2px solid ${theme};}
.zgb-body{display:block;line-height:1;}
.zgb-zombie--gone{opacity:0;transform:translate(-40px,-60px) scale(.4) rotate(-20deg);}
.zgb-shake{animation:zgb-shake .4s ease;}
@keyframes zgb-walk{0%,100%{transform:translateY(-50%) rotate(-3deg)}50%{transform:translateY(-52%) rotate(3deg)}}
@keyframes zgb-shake{0%,100%{transform:translateY(-50%) translateX(0)}25%{transform:translateY(-50%) translateX(-6px)}75%{transform:translateY(-50%) translateX(6px)}}
.zgb-palette{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(255,255,255,.65);border-radius:20px;box-shadow:var(--shadow);}
.zgb-flower{width:54px;height:54px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#fff8,var(--zgb-color));box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 3px 6px rgba(0,0,0,.18);cursor:pointer;transition:transform .12s;display:flex;align-items:center;justify-content:center;font-size:1.6rem;}
.zgb-flower:active{transform:scale(.88);}
.zgb-flower--sel{transform:translateY(-6px) scale(1.14);box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 8px 12px rgba(0,0,0,.25),0 0 0 3px #fff,0 0 0 6px ${theme};}
`;
}

export function create(): ZombieGardenGame {
  return new ZombieGardenGame();
}
