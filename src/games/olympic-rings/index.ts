/* 五环 Olympic Rings —— 5 个奥运环（蓝·黄·黑·绿·红）打乱摆在下方，
   孩子按从左到右的正确顺序（蓝→黄→黑→绿→红）依次点环，
   每点对下一个颜色，环飞到上方对应位置；点错抖动。
   独特点：固定序列记忆 + 顺序点击。视觉：彩色圆环 + 上方目标位（互锁五环造型）。
   难度=打乱程度（顺序偏离量）。通关=排对目标轮数。前缀 olr-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Ring {
  id: string;
  name: string;
  color: string;
}

/** 标准奥运五环从左到右颜色顺序 */
const ORDER: Ring[] = [
  { id: "blue", name: "蓝", color: "#4d96ff" },
  { id: "yellow", name: "黄", color: "#ffd93d" },
  { id: "black", name: "黑", color: "#2a2a2a" },
  { id: "green", name: "绿", color: "#6bcf7f" },
  { id: "red", name: "红", color: "#ff6348" },
];

export class OlympicRingsGame extends BaseGame {
  constructor() {
    super("olympic-rings");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 当前已正确排到第几个（0..5） */
  private placed = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.placed = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "olr-wrap";

    const task = document.createElement("div");
    task.className = "olr-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 按顺序点环：<b style="color:#4d96ff">蓝</b>→<b style="color:#caa12a">黄</b>→<b style="color:#333">黑</b>→<b style="color:#6bcf7f">绿</b>→<b style="color:#ff6348">红</b>`;
    wrap.appendChild(task);

    // 上方目标位：5 个互锁环位
    const target = document.createElement("div");
    target.className = "olr-target";
    for (let i = 0; i < ORDER.length; i++) {
      const slot = document.createElement("div");
      slot.className = "olr-slot";
      slot.dataset.index = String(i);
      // 奇数位（黄、绿）下移一点，做出互锁造型
      if (i === 1 || i === 3) slot.classList.add("olr-slot--low");
      target.appendChild(slot);
    }
    wrap.appendChild(target);

    // 下方：乱序的环
    const pool = document.createElement("div");
    pool.className = "olr-pool";
    pool.id = "olr-pool";
    const shuffled = shuffle(ORDER.map((r) => r));
    // 困难：再加一个干扰轮次（让乱序更严重）——通过重复 shuffle 增加打乱程度
    let extraShuffles =
      this.difficulty === "easy" ? 0 : this.difficulty === "medium" ? 2 : 5;
    let poolRings = shuffled;
    while (extraShuffles > 0) {
      poolRings = shuffle(poolRings);
      // 确保不是天然顺序
      if (poolRings.some((r, idx) => r.id !== ORDER[idx]!.id)) break;
      extraShuffles -= 1;
    }
    // 兜底：保证至少一个环不在原位
    if (poolRings.every((r, idx) => r.id === ORDER[idx]!.id)) {
      poolRings = shuffle(poolRings);
    }
    poolRings.forEach((r) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "olr-ring-btn";
      btn.dataset.ringId = r.id;
      btn.setAttribute("aria-label", `${r.name}色环`);
      btn.innerHTML = `<span class="olr-ring-circle" style="border-color:${r.color}"></span><span class="olr-ring-name" style="color:${r.color === "#2a2a2a" ? "#333" : r.color}">${r.name}</span>`;
      btn.addEventListener("click", () => this.pickRing(r, btn));
      pool.appendChild(btn);
    });
    wrap.appendChild(pool);

    this.root.appendChild(wrap);
  }

  private pickRing(ring: Ring, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (btn.classList.contains("olr-ring-btn--used")) return;
    const expected = ORDER[this.placed]!;
    if (ring.id === expected.id) {
      // 正确：飞到上方对应位置
      btn.classList.add("olr-ring-btn--used");
      btn.disabled = true;
      sfxPop();
      this.placeRing(ring, this.placed);
      this.placed += 1;
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.resetWrongStreak();
      if (this.placed >= ORDER.length) {
        this.locked = true;
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 900);
      }
    } else {
      // 错误：抖动
      btn.classList.add("olr-ring-btn--shake");
      this.trackTimeout(() => btn.classList.remove("olr-ring-btn--shake"), 500);
      this.onWrong();
    }
  }

  private placeRing(ring: Ring, index: number): void {
    const slots = this.root.querySelectorAll(".olr-slot");
    const slot = slots[index];
    if (!slot) return;
    slot.classList.add("olr-slot--filled");
    const ringEl = document.createElement("div");
    ringEl.className = "olr-placed-ring";
    ringEl.innerHTML = `<span class="olr-ring-circle olr-ring-circle--lg" style="border-color:${ring.color}"></span>`;
    slot.appendChild(ringEl);
    // 触发落位动画
    requestAnimationFrame(() => ringEl.classList.add("olr-placed-ring--in"));
  }

  private injectStyle(): void {
    if (document.getElementById("olr-style")) return;
    const st = document.createElement("style");
    st.id = "olr-style";
    st.textContent = OLR_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function OLR_CSS(theme: string): string {
  void theme;
  return `
.olr-wrap{display:flex;flex-direction:column;align-items:center;gap:26px;width:min(560px,100%);}
.olr-task{font-size:1.12rem;font-weight:800;text-align:center;background:linear-gradient(180deg,#fff,#fff6e0);padding:14px 24px;border-radius:20px;box-shadow:var(--shadow);line-height:1.7;border:2px solid #ffd84d;}
.olr-target{position:relative;display:flex;justify-content:center;align-items:flex-start;gap:0;min-height:150px;padding:24px 8px 46px;background:linear-gradient(180deg,#f6f9ff 0%,#e4edf8 60%,#c9d6e8 100%);border-radius:24px;box-shadow:var(--shadow),inset 0 0 0 3px rgba(255,255,255,.5);width:100%;flex-wrap:nowrap;overflow:hidden;}
.olr-target::before{content:"";position:absolute;left:0;right:0;bottom:0;height:18px;background:linear-gradient(180deg,#b0bec5,#78909c);}
.olr-target::after{content:"🥇🥈🥉";position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:1.3rem;letter-spacing:8px;opacity:.85;}
.olr-slot{position:relative;width:100px;height:100px;margin-right:-28px;display:flex;align-items:center;justify-content:center;}
.olr-slot--low{margin-top:42px;}
.olr-slot--filled{ }
.olr-placed-ring{display:flex;align-items:center;justify-content:center;width:100px;height:100px;}
.olr-placed-ring--in{animation:olr-drop .4s cubic-bezier(.3,1.5,.5,1);}
@keyframes olr-drop{0%{transform:translateY(-50px) scale(.6);opacity:0;}60%{transform:translateY(6px) scale(1.1);}100%{transform:translateY(0) scale(1);opacity:1;}}
.olr-ring-circle{display:block;width:58px;height:58px;border-radius:50%;border:9px solid var(--bc,#4d96ff);box-sizing:border-box;filter:drop-shadow(0 3px 5px rgba(0,0,0,.22));}
.olr-ring-circle--lg{width:92px;height:92px;border-width:14px;}
.olr-pool{display:flex;justify-content:center;flex-wrap:wrap;gap:18px;padding:22px 18px;background:linear-gradient(180deg,#fff,#f6faff);border-radius:22px;box-shadow:var(--shadow),inset 0 0 0 2px rgba(255,216,77,.4);width:100%;}
.olr-ring-btn{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 12px;border:none;background:linear-gradient(180deg,#fafafa,#ececec);border-radius:16px;cursor:pointer;transition:transform .15s,box-shadow .15s;box-shadow:0 3px 6px rgba(0,0,0,.12);}
.olr-ring-btn:hover{transform:translateY(-4px) scale(1.06);box-shadow:0 8px 16px rgba(0,0,0,.2);}
.olr-ring-btn:active{transform:scale(.9);}
.olr-ring-btn--used{opacity:.25;filter:grayscale(.8);pointer-events:none;}
.olr-ring-btn--shake{animation:olr-shake .4s ease;}
@keyframes olr-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px) rotate(-6deg);}75%{transform:translateX(6px) rotate(6deg);}}
.olr-ring-name{font-size:1.1rem;font-weight:900;}
@media (max-width:380px){.olr-slot{width:78px;height:78px;margin-right:-22px;}.olr-ring-circle--lg{width:70px;height:70px;border-width:11px;}.olr-ring-circle{width:46px;height:46px;border-width:7px;}.olr-task{font-size:1rem;}}
`;
}

export function create(): OlympicRingsGame {
  return new OlympicRingsGame();
}
