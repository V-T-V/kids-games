/* 骑士盾 Knight Shield —— 几面盾牌有不同纹样（十字/狮子/鹰/龙），
   破损盾缺了纹样，孩子拖对应纹样到破损盾上修复。
   独特点：盾牌用 CSS 绘制 + 纹样 emoji；修复后盾牌闪光发亮。
   巧思：拖对应纹样到破损盾；难度=对数；通关=修复目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const EMBLEMS = [
  { emoji: "✚", name: "十字", color: "#ff6348" },
  { emoji: "🦁", name: "狮子", color: "#ffd93d" },
  { emoji: "🦅", name: "鹰", color: "#4d96ff" },
  { emoji: "🐉", name: "龙", color: "#6bcf7f" },
  { emoji: "⭐", name: "星", color: "#a55eea" },
  { emoji: "👑", name: "皇冠", color: "#ff9f43" },
];

interface Emblem {
  emoji: string;
  name: string;
  color: string;
  el: HTMLElement;
  used: boolean;
}

export class KnightShieldGame extends BaseGame {
  constructor() {
    super("knight-shield");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private shields: HTMLDivElement[] = [];
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

  private pairCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const pairs = this.pairCount();
    const chosen = shuffle(EMBLEMS).slice(0, pairs);
    this.remaining = pairs;

    const wrap = document.createElement("div");
    wrap.className = "ksh-wrap";

    const task = document.createElement("div");
    task.className = "ksh-task";
    task.innerHTML = `把纹样拖到<span style="color:${getCssVar("--c-blue")}">破损</span>的盾牌上修复～<span class="ksh-prog">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    // 纹样区（可拖）
    const emblemArea = document.createElement("div");
    emblemArea.className = "ksh-emblems";

    // 盾牌区（破损，待修复）
    const shieldRow = document.createElement("div");
    shieldRow.className = "ksh-shields";
    this.shields = [];

    // 每种纹样生成 1 个可拖 emblem，对应 1 个破损盾
    // 两边顺序各自打乱，避免位置一一对应
    const shieldOrder = shuffle(chosen);
    const emblemOrder = shuffle(chosen);
    shieldOrder.forEach((e) => {
      // 盾
      const s = document.createElement("div");
      s.className = "ksh-shield";
      s.dataset.emblem = e.name;
      s.innerHTML = `
        <div class="ksh-shield__body">
          <div class="ksh-shield__boss"></div>
          <div class="ksh-shield__crack" title="破损"></div>
          <div class="ksh-shield__slot"></div>
        </div>
        <div class="ksh-shield__name">要：${e.name}</div>`;
      shieldRow.appendChild(s);
      this.shields.push(s);
    });
    emblemOrder.forEach((e) => {
      const el = document.createElement("div");
      el.className = "ksh-emblem";
      el.style.setProperty("--ec", e.color);
      el.innerHTML = `<span class="ksh-emblem__icon">${e.emoji}</span><span class="ksh-emblem__name">${e.name}</span>`;
      emblemArea.appendChild(el);
      const item: Emblem = { ...e, el, used: false };
      this.enableDrag(item);
    });

    wrap.appendChild(emblemArea);
    wrap.appendChild(shieldRow);
    this.root.appendChild(wrap);
  }

  private enableDrag(item: Emblem): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (item.used) return;
      dragging = true;
      const r = item.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = item.el.parentElement;
      item.el.classList.add("ksh-emblem--drag");
      item.el.style.position = "fixed";
      item.el.style.left = `${p.x - offX}px`;
      item.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(item.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      item.el.style.left = `${p.x - offX}px`;
      item.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      item.el.classList.remove("ksh-emblem--drag");
      const shield = this.shields.find((b) => {
        const r = b.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (shield && shield.dataset.emblem === item.name) {
        // 修复！把纹样嵌入槽位
        item.used = true;
        item.el.remove();
        const slot = shield.querySelector(".ksh-shield__slot")!;
        slot.innerHTML = `<span style="color:${item.color};font-size:2rem;font-weight:800">${item.emoji}</span>`;
        shield.classList.add("ksh-shield--fixed");
        const crack = shield.querySelector(".ksh-shield__crack");
        if (crack) crack.classList.add("ksh-shield__crack--healed");
        this.remaining -= 1;
        const r = shield.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top);
        this.resetWrongStreak();
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
        // 归位
        item.el.style.position = "";
        item.el.style.left = "";
        item.el.style.top = "";
        origin?.appendChild(item.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(item.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看盾牌下面写的是哪种纹样，找对应的拖过去～",
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
    if (document.getElementById("ksh-style")) return;
    const st = document.createElement("style");
    st.id = "ksh-style";
    st.textContent = KSH_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function KSH_CSS(theme: string): string {
  void theme;
  return `
.ksh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(540px,100%);}
.ksh-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ksh-prog{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.ksh-emblems{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;min-height:90px;padding:12px;background:linear-gradient(180deg,#f0e6d2,#e0d4b8);border-radius:18px;box-shadow:var(--shadow);}
.ksh-emblem{display:flex;flex-direction:column;align-items:center;gap:2px;width:60px;cursor:grab;touch-action:none;}
.ksh-emblem__icon{width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,var(--ec));display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);box-shadow:inset -3px -3px 0 rgba(0,0,0,.15),var(--shadow);}
.ksh-emblem__name{font-size:.75rem;font-weight:700;color:var(--ink);}
.ksh-emblem--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
.ksh-shields{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.ksh-shield{display:flex;flex-direction:column;align-items:center;gap:4px;}
.ksh-shield__body{position:relative;width:80px;height:96px;background:linear-gradient(180deg,#9a9a9a,#6a6a6a);clip-path:polygon(50% 0,100% 12%,100% 55%,50% 100%,0 55%,0 12%);box-shadow:inset -4px -4px 0 rgba(0,0,0,.2);transition:background .3s ease;}
.ksh-shield__boss{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ddd,#888);box-shadow:inset -2px -2px 0 rgba(0,0,0,.3);}
.ksh-shield__crack{position:absolute;top:10%;left:40%;width:3px;height:60%;background:linear-gradient(180deg,#1a1a1a,transparent);transform:rotate(15deg);opacity:.7;transition:opacity .4s ease;}
.ksh-shield__crack::before{content:'';position:absolute;top:30%;left:-8px;width:16px;height:3px;background:#1a1a1a;transform:rotate(-20deg);}
.ksh-shield__crack--healed{opacity:0;}
.ksh-shield__slot{position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);width:50px;height:50px;display:flex;align-items:center;justify-content:center;}
.ksh-shield__name{font-size:.78rem;font-weight:700;color:var(--ink-soft);}
.ksh-shield--fixed .ksh-shield__body{background:linear-gradient(180deg,#c9b06b,#9a7d2e);box-shadow:0 0 14px #ffd93d,inset -4px -4px 0 rgba(0,0,0,.2);}
@keyframes ksh-flash{0%{filter:brightness(1)}50%{filter:brightness(1.5)}100%{filter:brightness(1)}}
.ksh-shield--fixed .ksh-shield__body{animation:ksh-flash .6s ease;}
@media (max-width:380px){.ksh-shield__body{width:66px;height:80px;}.ksh-emblem__icon{width:46px;height:46px;font-size:1.5rem;}}
`;
}

export function create(): KnightShieldGame {
  return new KnightShieldGame();
}
