/* 海洋清理 Ocean Clean —— 海里有垃圾和鱼，孩子点击垃圾（捞起），不能点鱼。
   限时内清完所有垃圾即可通关。
   独特点：环保主题 + 分类反应，锻炼辨别与快速点击。
   巧思：垃圾与鱼都缓慢游动，点击垃圾有水花动画；点鱼温柔提示（不计为硬失败）。
   难度 = 物品数 + 时间。通关 = 清完目标轮数。
   视觉：海洋渐变背景 + 垃圾/鱼 emoji + 气泡装饰。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, randInt } from "../../lobby/util.ts";

const TRASH = ["🥤", "🛍️", "🥫", "📰", "🧴", "🪣"];
const FISH = ["🐟", "🐠", "🐡", "🦈", "🐙", "🦑"];

interface Item {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isTrash: boolean;
  removed: boolean;
}

export class OceanCleanGame extends BaseGame {
  constructor() {
    super("ocean-clean");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private items: Item[] = [];
  private remaining = 0;
  private timeLeft = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private field!: HTMLDivElement;
  private timerEl: HTMLElement | null = null;
  private W = 0;
  private H = 0;
  /** 单局限时（秒） */
  private limit = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private trashCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.over = false;
    this.items = [];
    this.limit =
      this.difficulty === "easy" ? 30 : this.difficulty === "medium" ? 32 : 34;
    this.timeLeft = this.limit;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "oc-wrap";
    const task = document.createElement("div");
    task.className = "oc-task";
    task.innerHTML = `点击<b>垃圾</b>捞起来，别点小鱼！剩余垃圾 <b id="oc-left">0</b> · 时间 <b id="oc-time">${this.timeLeft}</b> 秒`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "oc-field";
    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.W = r.width;
      this.H = r.height;
      this.spawnItems();
      this.timerEl = this.root.querySelector("#oc-time");
      const left = this.root.querySelector("#oc-left");
      if (left) left.textContent = String(this.remaining);
      this.last = performance.now();
      this.loop();
    });
  }

  private spawnItems(): void {
    const trashN = this.trashCount();
    const fishN =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 5 : 7;
    const trashEmojis = shuffle(TRASH).slice(0, Math.min(TRASH.length, trashN));
    // 补足若需要更多
    let ti = 0;
    while (trashEmojis.length < trashN) {
      trashEmojis.push(TRASH[ti % TRASH.length]!);
      ti++;
    }
    // 先放垃圾
    for (const emoji of trashEmojis) {
      this.addItem(emoji, true);
    }
    const fishEmojis = shuffle(FISH).slice(0, Math.min(FISH.length, fishN));
    let fi = 0;
    while (fishEmojis.length < fishN) {
      fishEmojis.push(FISH[fi % FISH.length]!);
      fi++;
    }
    for (const emoji of fishEmojis) {
      this.addItem(emoji, false);
    }
    this.remaining = trashN;
  }

  private addItem(emoji: string, isTrash: boolean): void {
    const el = document.createElement("button");
    el.type = "button";
    el.className = isTrash ? "oc-item oc-item--trash" : "oc-item oc-item--fish";
    el.textContent = emoji;
    const x = randInt(40, this.W - 40);
    const y = randInt(40, this.H - 40);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.field.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const sp = randInt(20, 50);
    const item: Item = {
      el,
      x,
      y,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp,
      isTrash,
      removed: false,
    };
    el.addEventListener("click", () => this.tap(item));
    this.items.push(item);
  }

  private tap(item: Item): void {
    if (this.over || item.removed) return;
    if (item.isTrash) {
      item.removed = true;
      item.el.classList.add("oc-item--gone");
      this.trackTimeout(() => item.el.remove(), 400);
      this.remaining -= 1;
      sfxPop();
      this.resetWrongStreak();
      const r = this.field.getBoundingClientRect();
      this.onCorrect(r.left + item.x, r.top + item.y);
      const left = this.root.querySelector("#oc-left");
      if (left) left.textContent = String(this.remaining);
      if (this.remaining <= 0) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 700);
      }
    } else {
      // 点到鱼：温柔提示，不计硬失败
      this.onWrong();
      item.el.classList.add("oc-item--shake");
      this.trackTimeout(() => item.el.classList.remove("oc-item--shake"), 350);
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 倒计时
    this.timeLeft -= dt;
    if (this.timerEl)
      this.timerEl.textContent = String(Math.max(0, Math.ceil(this.timeLeft)));
    if (this.timeLeft <= 0) {
      // 时间到：本关重来（保证可通关）
      this.failTime();
      return;
    }

    // 物品移动 + 边界反弹
    for (const it of this.items) {
      if (it.removed) continue;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      if (it.x < 24 || it.x > this.W - 24) {
        it.vx *= -1;
        it.x = Math.max(24, Math.min(this.W - 24, it.x));
      }
      if (it.y < 24 || it.y > this.H - 24) {
        it.vy *= -1;
        it.y = Math.max(24, Math.min(this.H - 24, it.y));
      }
      it.el.style.left = `${it.x}px`;
      it.el.style.top = `${it.y}px`;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private failTime(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
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
      emoji: "🌊",
      variant: "rest",
      body: "时间到啦，加快手速捞垃圾吧～",
      primary: {
        text: "再清一次",
        icon: "🌊",
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
    if (document.getElementById("oc-style")) return;
    const st = document.createElement("style");
    st.id = "oc-style";
    st.textContent = OC_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function OC_CSS(theme: string): string {
  return `
.oc-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.oc-task{font-size:1.02rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.oc-field{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#1ca3c9 0%,#1278a8 45%,#0a4f78 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.oc-field::before{content:"∘ ∘ ∘ ∘ ∘ ∘ ∘ ∘";position:absolute;top:10px;left:0;width:100%;font-size:1rem;letter-spacing:30px;color:rgba(255,255,255,.4);white-space:nowrap;}
.oc-field::after{content:"🪸";position:absolute;bottom:-6px;left:20px;font-size:3rem;opacity:.7;}
.oc-item{position:absolute;font-size:2.4rem;line-height:1;transform:translate(-50%,-50%);background:none;border:none;cursor:pointer;z-index:3;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3));transition:transform .12s;padding:6px;}
.oc-item--trash{filter:drop-shadow(0 0 6px rgba(255,200,0,.4));}
.oc-item:active{transform:translate(-50%,-50%) scale(1.15);}
.oc-item--gone{animation:oc-pick .4s ease forwards;}
@keyframes oc-pick{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-150%) scale(.4);opacity:0}}
.oc-item--shake{animation:oc-shake .3s ease;}
@keyframes oc-shake{0%,100%{transform:translate(-50%,-50%) translateX(0)}25%{transform:translate(-50%,-50%) translateX(-5px)}75%{transform:translate(-50%,-50%) translateX(5px)}}
@media (max-width:380px){.oc-task{font-size:.9rem;}.oc-item{font-size:2rem;}}
.oc-theme{color:${theme};}
`;
}

export function create(): OceanCleanGame {
  return new OceanCleanGame();
}
