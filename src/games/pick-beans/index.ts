/* 夹豆子 Pick Beans —— 盘里有不同颜色的豆子，题目说"夹起 X 色的"，
   孩子把对应颜色的豆子拖进碗里。独特点：颜色筛选 + 精细拖拽（模拟筷子）。
   视觉：木盘 + 彩色椭圆豆子（带高光）+ 碗（半圆）。
   巧思：拖错颜色的豆子会从碗里弹回盘子；拖对则豆子"落"进碗里伴清脆音。
   难度 = 豆子总数/干扰色数。通关 = 完成目标轮数。前缀 pkb-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, randInt } from "../../lobby/util.ts";

interface Bean {
  id: number;
  color: string;
  name: string;
  el: HTMLDivElement;
  inBowl: boolean;
  originParent: HTMLElement;
  originStyle: { left: string; top: string };
}

const COLORS = [
  { hex: "#ff5252", name: "红" },
  { hex: "#4d96ff", name: "蓝" },
  { hex: "#6bcf7f", name: "绿" },
  { hex: "#ffd93d", name: "黄" },
  { hex: "#a55eea", name: "紫" },
];

export class PickBeansGame extends BaseGame {
  constructor() {
    super("pick-beans");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private beans: Bean[] = [];
  private bowl!: HTMLDivElement;
  private targetColor = "";
  private targetName = "";
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private diff() {
    // 豆子总数 + 颜色种类
    if (this.difficulty === "easy") return { total: 5, colorKinds: 2 };
    if (this.difficulty === "medium") return { total: 8, colorKinds: 3 };
    return { total: 10, colorKinds: 4 };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.beans = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const d = this.diff();
    const picked = shuffle(COLORS).slice(0, d.colorKinds);
    const target = picked[0]!;
    this.targetColor = target.hex;
    this.targetName = target.name;

    // 生成豆子：保证目标色至少 2 颗，其余随机分配
    const targetCount = Math.max(2, Math.ceil(d.total / d.colorKinds));
    this.remaining = targetCount;
    const specs: { color: string; name: string }[] = [];
    for (let i = 0; i < targetCount; i++) {
      specs.push({ color: target.hex, name: target.name });
    }
    while (specs.length < d.total) {
      const c = picked[randInt(1, picked.length - 1)]!;
      specs.push({ color: c.hex, name: c.name });
    }
    const shuffled = shuffle(specs);

    const wrap = document.createElement("div");
    wrap.className = "pkb-wrap";

    const task = document.createElement("div");
    task.className = "pkb-task";
    task.innerHTML = `用筷子把<b style="color:${target.hex}">${target.name}色</b>的豆子夹进碗里～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 盘子区
    const plate = document.createElement("div");
    plate.className = "pkb-plate";

    // 在盘内随机散布位置（避免重叠）
    const slots: { x: number; y: number }[] = [];
    for (let i = 0; i < d.total; i++) {
      let tries = 0;
      let pos: { x: number; y: number };
      do {
        pos = { x: randInt(12, 88), y: randInt(20, 80) };
        tries++;
      } while (
        tries < 30 &&
        slots.some((s) => Math.hypot(s.x - pos.x, s.y - pos.y) < 16)
      );
      slots.push(pos);
    }

    shuffled.forEach((spec, i) => {
      const el = document.createElement("div");
      el.className = "pkb-bean";
      el.style.setProperty("--pkb-color", spec.color);
      const pos = slots[i]!;
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
      plate.appendChild(el);
      const bean: Bean = {
        id: i,
        color: spec.color,
        name: spec.name,
        el,
        inBowl: false,
        originParent: plate,
        originStyle: { left: el.style.left, top: el.style.top },
      };
      this.beans.push(bean);
    });
    wrap.appendChild(plate);

    // 碗区
    this.bowl = document.createElement("div");
    this.bowl.className = "pkb-bowl";
    this.bowl.innerHTML = `<div class="pkb-bowl__inner">🥣</div>`;
    wrap.appendChild(this.bowl);

    this.root.appendChild(wrap);

    this.beans.forEach((b) => this.enableDrag(b));
  }

  private enableDrag(b: Bean): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    const u = bindPointer(b.el, {
      down: (p) => {
        if (b.inBowl) return;
        dragging = true;
        const r = b.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        b.el.classList.add("pkb-bean--drag");
        b.el.style.position = "fixed";
        b.el.style.left = `${p.x - ox}px`;
        b.el.style.top = `${p.y - oy}px`;
        b.el.style.width = `${r.width}px`;
        b.el.style.height = `${r.height}px`;
        document.body.appendChild(b.el);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        b.el.style.left = `${p.x - ox}px`;
        b.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        b.el.classList.remove("pkb-bean--drag");
        // 是否落入碗
        const r = this.bowl.getBoundingClientRect();
        const inBowl =
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
        if (inBowl && b.color === this.targetColor) {
          // 夹对
          b.inBowl = true;
          b.el.classList.add("pkb-bean--in");
          this.bowl.appendChild(b.el);
          b.el.style.position = "absolute";
          b.el.style.left = `${randInt(20, 70)}%`;
          b.el.style.top = `${randInt(35, 70)}%`;
          b.el.style.width = "";
          b.el.style.height = "";
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.remaining -= 1;
          if (this.remaining <= 0) {
            this.roundsDone += 1;
            this.reportProgress(this.roundsDone, this.roundTotal);
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal) {
                this.finishClear(starsByAccuracy(this.wrongCount));
              } else {
                this.startRound();
              }
            }, 900);
          }
        } else {
          // 夹错色或没放碗里：弹回盘子原位
          this.snapBack(b);
          if (inBowl) {
            // 放进碗但颜色不对，才算错
            const paused = this.onWrong();
            if (paused) this.showRest();
          }
        }
      },
    });
    this.unbinds.push(u);
  }

  private snapBack(b: Bean): void {
    b.originParent.appendChild(b.el);
    b.el.style.position = "absolute";
    b.el.style.left = b.originStyle.left;
    b.el.style.top = b.originStyle.top;
    b.el.style.width = "";
    b.el.style.height = "";
    b.el.classList.add("pkb-bean--back");
    this.trackTimeout(() => b.el.classList.remove("pkb-bean--back"), 300);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🥢",
      variant: "rest",
      body: `题目要的是<b style="color:${this.targetColor}">${this.targetName}色</b>的豆子，看清颜色再夹～`,
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
    if (document.getElementById("pkb-style")) return;
    const st = document.createElement("style");
    st.id = "pkb-style";
    st.textContent = PKB_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function PKB_CSS(_theme: string): string {
  return `
.pkb-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.pkb-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;}
.pkb-plate{position:relative;width:min(360px,86vw);aspect-ratio:1.6/1;background:radial-gradient(ellipse at center,#f0e6d2 0%,#e0d4b8 70%,#c9bb98 100%);border-radius:50%;box-shadow:inset 0 0 18px rgba(120,90,40,.25),var(--shadow);touch-action:none;user-select:none;}
.pkb-bean{position:absolute;width:34px;height:22px;border-radius:50%;background:radial-gradient(ellipse at 35% 30%,#fff8,var(--pkb-color,#888));box-shadow:0 2px 3px rgba(0,0,0,.25);transform:translate(-50%,-50%);cursor:grab;touch-action:none;transition:none;}
.pkb-bean--drag{cursor:grabbing;transform:translate(-50%,-50%) scale(1.25);z-index:100;filter:drop-shadow(0 6px 6px rgba(0,0,0,.3));}
.pkb-bean--back{animation:pkb-bump .3s ease;}
.pkb-bean--in{animation:pkb-drop .4s ease;}
@keyframes pkb-bump{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,-50%) scale(1.15)}}
@keyframes pkb-drop{0%{transform:translate(-50%,-50%) scale(1.3)}60%{transform:translate(-50%,-50%) scale(.7)}100%{transform:translate(-50%,-50%) scale(1)}}
.pkb-bowl{position:relative;width:min(220px,60vw);height:120px;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%,#fff3 0%,transparent 50%),linear-gradient(180deg,#8a6a4a 0%,#6b4f33 100%);border-radius:0 0 120px 120px/0 0 90px 90px;box-shadow:inset 0 6px 12px rgba(0,0,0,.3),var(--shadow);touch-action:none;}
.pkb-bowl__inner{font-size:2.4rem;opacity:.4;pointer-events:none;}
@media (max-width:380px){.pkb-bean{width:28px;height:18px;}.pkb-bowl{height:100px;}}
`;
}

export function create(): PickBeansGame {
  return new PickBeansGame();
}
