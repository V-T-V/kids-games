/* 浮游喂 Plankton Feed —— 鲸鱼张嘴游来，当前要吃某一颜色，孩子把对应色
   浮游生物拖到鲸鱼嘴里。独特点：鲸鱼嘴上挂着"想吃的颜色"提示牌，
   只有对应色浮游才吃，错的会弹回。视觉：海洋背景 + 鲸鱼 + 彩色浮游。
   用 bindPointer 拖拽。难度=浮游数量。通关=喂对目标轮数。前缀 plk-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const COLORS = [
  { color: "#ff6b9d", name: "粉" },
  { color: "#4d96ff", name: "蓝" },
  { color: "#6bcf7f", name: "绿" },
  { color: "#ffd93d", name: "黄" },
  { color: "#a55eea", name: "紫" },
];

interface Plankton {
  color: string;
  el: HTMLElement;
  fed: boolean;
}

export class PlanktonFeedGame extends BaseGame {
  constructor() {
    super("plankton-feed");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private plankton: Plankton[] = [];
  private whale: HTMLDivElement | null = null;
  private mouthZone: HTMLDivElement | null = null;
  private wantColor = "";
  private wantName = "";
  private fed = 0;
  private goal = 0;

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

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.plankton = [];

    // 难度=颜色种类（决定浮游池大小与目标轮数）
    const colorCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const pool = shuffle(COLORS).slice(0, colorCount);
    this.goal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 6;
    this.fed = 0;

    const wrap = document.createElement("div");
    wrap.className = "plk-wrap";
    const task = document.createElement("div");
    task.className = "plk-task";
    task.innerHTML = `鲸鱼 🐋 想吃 <b id="plk-count">${this.fed}</b>/${this.goal} 个 <span id="plk-cname"></span>浮游生物！<br><small>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</small>`;
    wrap.appendChild(task);

    // 海洋区
    const sea = document.createElement("div");
    sea.className = "plk-sea";

    // 鲸鱼 + 嘴 + 想吃颜色提示
    const whale = document.createElement("div");
    whale.className = "plk-whale";
    whale.innerHTML = `<div class="plk-whale__body">🐋</div><div class="plk-whale__mouth"></div><div class="plk-whale__want" id="plk-want"></div>`;
    sea.appendChild(whale);
    this.whale = whale;
    this.mouthZone = whale.querySelector(".plk-whale__mouth");

    // 生成浮游生物：保证目标色足够喂够 goal 个
    const wantC = sample(pool);
    this.wantColor = wantC.color;
    this.wantName = wantC.name;
    const others = pool.filter((c) => c.color !== this.wantColor);

    const feedList: { color: string }[] = [];
    // 至少 goal 个目标色
    for (let i = 0; i < this.goal; i++)
      feedList.push({ color: this.wantColor });
    // 干扰色
    const distractorCount = Math.min(6, this.goal);
    for (let i = 0; i < distractorCount; i++) {
      feedList.push({ color: sample(others.length ? others : pool).color });
    }

    // 浮游散布区（在鲸鱼下方）
    const foodArea = document.createElement("div");
    foodArea.className = "plk-food";

    shuffle(feedList).forEach((f, i) => {
      const el = document.createElement("div");
      el.className = "plk-plankton";
      el.style.setProperty("--pk-color", f.color);
      el.style.setProperty("--pk-pos", String(i));
      foodArea.appendChild(el);
      const p: Plankton = { color: f.color, el, fed: false };
      this.plankton.push(p);
      this.enableDrag(p);
    });

    sea.appendChild(foodArea);
    wrap.appendChild(sea);
    this.root.appendChild(wrap);

    // 更新提示文案颜色
    this.refreshWant();
  }

  private refreshWant(): void {
    const wantEl = this.root.querySelector("#plk-want") as HTMLElement | null;
    if (wantEl) {
      wantEl.style.background = this.wantColor;
      wantEl.style.boxShadow = `0 0 12px ${this.wantColor}`;
    }
    const nameEl = this.root.querySelector("#plk-cname") as HTMLElement | null;
    if (nameEl) {
      nameEl.style.color = this.wantColor;
      nameEl.textContent = this.wantName;
    }
  }

  private enableDrag(p: Plankton): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (pt: { x: number; y: number }) => {
      if (p.fed) return;
      dragging = true;
      const r = p.el.getBoundingClientRect();
      offX = pt.x - r.left;
      offY = pt.y - r.top;
      origin = p.el.parentElement;
      p.el.classList.add("plk-plankton--drag");
      p.el.style.position = "fixed";
      p.el.style.left = `${pt.x - offX}px`;
      p.el.style.top = `${pt.y - offY}px`;
      document.body.appendChild(p.el);
      sfxPop();
    };
    const onMove = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      p.el.style.left = `${pt.x - offX}px`;
      p.el.style.top = `${pt.y - offY}px`;
    };
    const onUp = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      p.el.classList.remove("plk-plankton--drag");
      const r = this.mouthZone?.getBoundingClientRect();
      const hit =
        r != null &&
        pt.x >= r.left &&
        pt.x <= r.right &&
        pt.y >= r.top &&
        pt.y <= r.bottom;
      if (hit && p.color === this.wantColor) {
        p.fed = true;
        p.el.classList.add("plk-plankton--eaten");
        this.trackTimeout(() => p.el.remove(), 350);
        this.fed += 1;
        this.onCorrect(r!.left + r!.width / 2, r!.top + r!.height / 2);
        this.resetWrongStreak();
        const cnt = this.root.querySelector("#plk-count");
        if (cnt) cnt.textContent = String(this.fed);
        if (this.fed >= this.goal) {
          this.trackTimeout(() => {
            this.roundsDone += 1;
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 700);
        }
      } else {
        p.el.style.position = "";
        p.el.style.left = "";
        p.el.style.top = "";
        origin?.appendChild(p.el);
        if (hit) {
          // 放进嘴但颜色不对
          const paused = this.onWrong();
          if (paused) this.showRest();
        }
      }
    };
    const u = bindPointer(p.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看鲸鱼头上想吃什么颜色～",
      primary: { text: "继续", icon: "🐋", onClick: () => ov.destroy() },
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
    if (document.getElementById("plk-style")) return;
    const st = document.createElement("style");
    st.id = "plk-style";
    st.textContent = PLK_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function PLK_CSS(_theme: string): string {
  return `
.plk-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.plk-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.plk-sea{position:relative;width:100%;max-width:480px;min-height:380px;background:linear-gradient(180deg,#7ec8ff,#3a7bd5 60%,#1e4f8a);border-radius:24px;box-shadow:var(--shadow-lg),inset 0 0 40px rgba(0,0,0,.2);overflow:hidden;padding:14px;}
.plk-whale{position:relative;height:120px;display:flex;align-items:center;justify-content:center;animation:plk-swim 4s ease-in-out infinite;}
.plk-whale__body{font-size:5rem;filter:drop-shadow(0 6px 8px rgba(0,0,0,.3));}
.plk-whale__mouth{position:absolute;width:54px;height:40px;left:50%;top:58%;transform:translate(-50%,-50%);border-radius:0 0 30px 30px;background:rgba(40,20,10,.25);box-shadow:inset 0 4px 8px rgba(0,0,0,.3);}
.plk-whale__want{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:34px;height:34px;border-radius:50%;border:4px solid #fff;background:#fff;box-shadow:0 4px 10px rgba(0,0,0,.25);animation:plk-bob 1.2s ease-in-out infinite;}
.plk-food{position:relative;margin-top:30px;display:flex;flex-wrap:wrap;justify-content:center;gap:14px;min-height:80px;}
.plk-plankton{width:42px;height:42px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,var(--pk-color));box-shadow:0 3px 6px rgba(0,0,0,.25);cursor:grab;touch-action:none;animation:plk-float 2.5s ease-in-out infinite;animation-delay:calc(var(--pk-pos) * 0.25s);}
.plk-plankton:hover{transform:scale(1.12);}
.plk-plankton--drag{cursor:grabbing;transform:scale(1.3);z-index:100;animation:none;}
.plk-plankton--eaten{transition:transform .3s ease,opacity .3s ease;transform:scale(0) translateY(-20px);opacity:0;}
@keyframes plk-swim{0%,100%{transform:translateX(-12px) rotate(-2deg)}50%{transform:translateX(12px) rotate(2deg)}}
@keyframes plk-bob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-6px)}}
@keyframes plk-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@media (max-width:380px){.plk-whale__body{font-size:4rem;}.plk-plankton{width:36px;height:36px;}}
`;
}

export function create(): PlanktonFeedGame {
  return new PlanktonFeedGame();
}
