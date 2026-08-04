/* 洗衣服 Laundry —— 一堆不同颜色的衣物，几个按颜色分的洗衣篮，
   孩子把衣物拖到对应颜色的篮子里。
   独特点：颜色分类 + 拖拽手感，衣物"掉进"篮子的入桶动画。
   视觉：衣物 emoji + 彩色篮子。难度=衣物数。通关=分对目标轮数。
   用 bindPointer 实现拖拽。巧思：每轮每种颜色篮子都至少有 1 件对应衣物（可解）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Color {
  name: string;
  hex: string;
  items: string[];
}

const COLORS: Color[] = [
  { name: "红色", hex: "#ef5350", items: ["👕", "🧦", "🧢"] },
  { name: "蓝色", hex: "#42a5f5", items: ["👖", "👕", "🧦"] },
  { name: "黄色", hex: "#ffca28", items: ["🧣", "🧢", "👕"] },
  { name: "绿色", hex: "#66bb6a", items: ["👕", "🧦", "🧢"] },
  { name: "紫色", hex: "#ab47bc", items: ["🧣", "👕", "🧦"] },
];

interface Cloth {
  color: Color;
  emoji: string;
  el: HTMLElement;
  placed: boolean;
}

const ENCOURAGE = ["分得真整齐！", "颜色都对啦！", "再放一件～", "你真棒！"];

export class LaundryGame extends BaseGame {
  constructor() {
    super("laundry");
  }

  private unbinds: (() => void)[] = [];
  private baskets: Record<string, HTMLElement> = {};
  private clothes: Cloth[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

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

  /** 篮子（颜色）数量 */
  private binCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }
  /** 衣物总数 */
  private clothCount(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 8
        : 11;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.clothes = [];
    this.baskets = {};
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const binN = this.binCount();
    const colors = shuffle([...COLORS]).slice(0, binN);
    const total = this.clothCount();

    // 生成衣物：先给每个篮子配 1 件对应色（保证可解），再随机补足
    const plan: Color[] = colors.map((c) => c);
    for (let i = colors.length; i < total; i++) {
      plan.push(sample(colors));
    }
    const cloths = shuffle(plan);

    const wrap = document.createElement("div");
    wrap.className = "la2-wrap";

    const task = document.createElement("div");
    task.className = "la2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把衣物拖到同色的篮子里 🧺`;
    wrap.appendChild(task);

    // 篮子区
    const bins = document.createElement("div");
    bins.className = "la2-bins";
    colors.forEach((c) => {
      const b = document.createElement("div");
      b.className = "la2-bin";
      b.dataset.color = c.name;
      b.style.setProperty("--la2-c", c.hex);
      b.innerHTML = `<div class="la2-bin__label" style="background:${c.hex}">${c.name}</div><div class="la2-bin__body" id="la2-body-${c.name}"></div>`;
      bins.appendChild(b);
      this.baskets[c.name] = b;
    });
    wrap.appendChild(bins);

    // 衣物托盘
    const tray = document.createElement("div");
    tray.className = "la2-tray";
    cloths.forEach((color) => {
      const emoji = sample(color.items);
      const el = document.createElement("div");
      el.className = "la2-cloth";
      el.textContent = emoji;
      el.style.setProperty("--la2-c", color.hex);
      el.dataset.color = color.name;
      tray.appendChild(el);
      const cl: Cloth = { color, emoji, el, placed: false };
      this.clothes.push(cl);
      this.enableDrag(cl);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
    this.remaining = this.clothes.length;
  }

  private enableDrag(cl: Cloth): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (cl.placed || this.locked) return;
      dragging = true;
      const r = cl.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = cl.el.parentElement;
      cl.el.classList.add("la2-cloth--drag");
      cl.el.style.position = "fixed";
      cl.el.style.left = `${p.x - offX}px`;
      cl.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(cl.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      cl.el.style.left = `${p.x - offX}px`;
      cl.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      cl.el.classList.remove("la2-cloth--drag");
      // 命中检测：指针落在哪个篮子
      let hit: string | null = null;
      for (const name of Object.keys(this.baskets)) {
        const b = this.baskets[name]!;
        const r = b.getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hit = name;
          break;
        }
      }
      if (hit === cl.color.name) {
        cl.placed = true;
        cl.el.style.position = "";
        cl.el.style.left = "";
        cl.el.style.top = "";
        cl.el.classList.add("la2-cloth--in");
        const body = this.root.querySelector(`#la2-body-${hit}`);
        if (body) body.appendChild(cl.el);
        this.remaining -= 1;
        const r = this.baskets[hit]!.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.locked = true;
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
      } else {
        // 归位
        cl.el.style.position = "";
        cl.el.style.left = "";
        cl.el.style.top = "";
        origin?.appendChild(cl.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(cl.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧺",
      variant: "rest",
      body: `看看衣服是什么颜色，找同色的篮子哦～ ${sample(ENCOURAGE)}`,
      primary: { text: "继续", icon: "👕", onClick: () => ov.destroy() },
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
    if (document.getElementById("la2-style")) return;
    const st = document.createElement("style");
    st.id = "la2-style";
    st.textContent = LA2_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function LA2_CSS(_theme: string): string {
  return `
.la2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.la2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.la2-bins{display:flex;gap:12px;justify-content:center;width:100%;flex-wrap:wrap;}
.la2-bin{flex:1;min-width:90px;max-width:130px;background:#fff;border-radius:0 0 18px 18px;box-shadow:var(--shadow);overflow:hidden;border:3px solid var(--la2-c,#42a5f5);}
.la2-bin__label{color:#fff;font-size:.9rem;font-weight:900;text-align:center;padding:5px 2px;text-shadow:0 1px 2px rgba(0,0,0,.25);}
.la2-bin__body{display:flex;flex-wrap:wrap;gap:3px;justify-content:center;align-content:flex-start;min-height:96px;padding:8px 6px;background:rgba(0,0,0,.04);}
.la2-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.65);border-radius:22px;box-shadow:var(--shadow);max-width:480px;min-height:72px;}
.la2-cloth{font-size:2.4rem;cursor:grab;touch-action:none;user-select:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.2));transition:transform .12s;background:var(--la2-c,#42a5f5);border-radius:12px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;}
.la2-cloth:active{transform:scale(1.12);}
.la2-cloth--drag{cursor:grabbing;transform:scale(1.25);z-index:100;}
.la2-cloth--in{animation:la2-drop .45s ease;cursor:default;}
@keyframes la2-drop{0%{transform:scale(1.2) translateY(-10px)}60%{transform:scale(.85)}100%{transform:scale(1)}}
@media (max-width:380px){.la2-cloth{font-size:2rem;width:44px;height:44px;}.la2-bin{min-width:78px;}}
`;
}

export function create(): LaundryGame {
  return new LaundryGame();
}
