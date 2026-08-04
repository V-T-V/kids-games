/* 采蜜 Bee Garden —— 蜜蜂要采指定颜色的花，孩子拖蜜蜂到对应颜色的花上。
   独特点：颜色匹配 + 拖拽精确操作。任务文案如"采红色的花"。
   视觉：花园里若干彩色花朵 + 一只🐝。难度=花数/颜色干扰。通关=采完目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByMoves } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const FLOWERS = [
  { color: "#ff6348", name: "红" },
  { color: "#ffd93d", name: "黄" },
  { color: "#4d96ff", name: "蓝" },
  { color: "#6bcf7f", name: "绿" },
  { color: "#a55eea", name: "紫" },
  { color: "#ff9f43", name: "橙" },
];

interface Flower {
  color: string;
  name: string;
  el: HTMLElement;
}

export class BeeGardenGame extends BaseGame {
  constructor() {
    super("bee-garden");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private flowers: Flower[] = [];
  private targetColor = "";
  private targetName = "";
  private moves = 0;
  private busy = false;

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

  private flowerCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.moves = 0;
    this.busy = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 选目标颜色
    const colors = shuffle(FLOWERS).slice(0, this.flowerCount());
    const target = sample(colors);
    this.targetColor = target.color;
    this.targetName = target.name;

    const wrap = document.createElement("div");
    wrap.className = "bg3-wrap";

    const task = document.createElement("div");
    task.className = "bg3-task";
    task.innerHTML = `把蜜蜂拖到 <b style="color:${this.targetColor}">${this.targetName}色</b> 的花上采蜜～<br><span class="bg3-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const garden = document.createElement("div");
    garden.className = "bg3-garden";

    // 花朵随机位置摆放
    const positions = this.layoutPositions(colors.length);
    this.flowers = [];
    colors.forEach((c, i) => {
      const f = document.createElement("div");
      f.className = "bg3-flower";
      f.style.setProperty("--fc", c.color);
      const p = positions[i]!;
      f.style.left = `${p.x}%`;
      f.style.top = `${p.y}%`;
      f.innerHTML = `<div class="bg3-petal"></div><div class="bg3-center"></div>`;
      garden.appendChild(f);
      this.flowers.push({ color: c.color, name: c.name, el: f });
    });

    // 蜜蜂
    const bee = document.createElement("div");
    bee.className = "bg3-bee";
    bee.id = "bg3-bee";
    bee.textContent = "🐝";
    garden.appendChild(bee);

    wrap.appendChild(garden);
    this.root.appendChild(wrap);

    this.enableBeeDrag(bee);
  }

  /** 在花园里均匀但不重叠地摆花。 */
  private layoutPositions(n: number): { x: number; y: number }[] {
    const spots: { x: number; y: number }[] = [];
    // 3 列网格里挑 n 个，加小扰动
    const cols = 3;
    const rows = Math.ceil(n / cols);
    const all: { x: number; y: number }[] = [];
    for (let r = 0; r < rows + 1; r++) {
      for (let c = 0; c < cols; c++) {
        all.push({
          x: 12 + (c * 76) / (cols - 1) + (Math.random() * 8 - 4),
          y: 16 + (r * 64) / Math.max(1, rows) + (Math.random() * 6 - 3),
        });
      }
    }
    const picked = shuffle(all).slice(0, n);
    picked.forEach((p) => spots.push(p));
    return spots;
  }

  private enableBeeDrag(bee: HTMLElement): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    const originParent = bee.parentElement;
    let originLeft = bee.style.left;
    let originTop = bee.style.top;
    const onDown = (p: { x: number; y: number }) => {
      if (this.busy) return;
      dragging = true;
      const r = bee.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      originLeft = bee.style.left;
      originTop = bee.style.top;
      bee.classList.add("bg3-bee--drag");
      bee.style.position = "fixed";
      bee.style.left = `${p.x - offX}px`;
      bee.style.top = `${p.y - offY}px`;
      document.body.appendChild(bee);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      bee.style.left = `${p.x - offX}px`;
      bee.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      bee.classList.remove("bg3-bee--drag");
      this.moves += 1;
      // 找指针下的花
      const hit = this.flowers.find((f) => {
        if (f.el.classList.contains("bg3-flower--done")) return false;
        const r = f.el.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (hit && hit.color === this.targetColor) {
        // 采蜜成功
        this.busy = true;
        hit.el.classList.add("bg3-flower--done");
        const r = hit.el.getBoundingClientRect();
        // 蜜蜂停在花上
        bee.style.left = `${r.left + r.width / 2 - 22}px`;
        bee.style.top = `${r.top + r.height / 2 - 22}px`;
        this.onCorrect(r.left + r.width / 2, r.top);
        this.resetWrongStreak();
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(
              starsByMoves(this.moves, [this.roundTotal, this.roundTotal + 3]),
            );
          } else {
            this.startRound();
          }
        }, 750);
      } else {
        // 归位
        bee.style.position = "";
        bee.style.left = originLeft;
        bee.style.top = originTop;
        originParent?.appendChild(bee);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(bee, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `蜜蜂要采${this.targetName}色的花，看清楚颜色哦～`,
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
    if (document.getElementById("bg3-style")) return;
    const st = document.createElement("style");
    st.id = "bg3-style";
    st.textContent = BG3_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function BG3_CSS(theme: string): string {
  void theme;
  return `
.bg3-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(540px,100%);}
.bg3-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.bg3-sub{font-size:.85rem;font-weight:600;color:var(--ink-soft,#888);}
.bg3-garden{position:relative;width:100%;height:60vh;min-height:360px;background:radial-gradient(ellipse at 50% 30%,#fff7c2,transparent 70%),linear-gradient(180deg,#cdeacd,#a8d8a8);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;touch-action:none;}
.bg3-flower{position:absolute;width:64px;height:64px;transform:translate(-50%,-50%);transition:transform .25s,filter .25s;cursor:default;}
.bg3-petal{position:absolute;inset:0;background:var(--fc);border-radius:50%;box-shadow:0 4px 6px rgba(0,0,0,.18);}
/* 8 瓣花：用径向 + 多个伪花瓣简化，用 conic 营造花瓣感 */
.bg3-petal::before{content:"";position:absolute;inset:6px;background:repeating-conic-gradient(from 0deg,var(--fc) 0deg 22deg,rgba(255,255,255,.55) 22deg 45deg);border-radius:50%;mix-blend-mode:overlay;}
.bg3-center{position:absolute;left:50%;top:50%;width:22px;height:22px;transform:translate(-50%,-50%);background:radial-gradient(circle at 35% 30%,#fff1a8,#caa12a);border-radius:50%;box-shadow:inset 0 -2px 3px rgba(0,0,0,.3);}
.bg3-flower--done{filter:saturate(.4) brightness(1.15);transform:translate(-50%,-50%) scale(.85);}
.bg3-flower--done .bg3-center::after{content:"✨";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:1.2rem;}
.bg3-bee{position:absolute;left:14%;top:80%;width:44px;height:44px;font-size:2.4rem;line-height:44px;text-align:center;cursor:grab;touch-action:none;z-index:5;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));animation:bg3-hover 1.6s ease-in-out infinite;}
.bg3-bee--drag{cursor:grabbing;animation:none;transform:scale(1.15);}
@keyframes bg3-hover{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media (max-width:380px){.bg3-flower{width:54px;height:54px;}.bg3-bee{font-size:2rem;}}
`;
}

export function create(): BeeGardenGame {
  return new BeeGardenGame();
}
