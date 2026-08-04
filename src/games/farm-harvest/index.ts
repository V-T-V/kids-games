/* 农场收成 Farm Harvest —— 几块田种了不同作物（麦子/玉米/南瓜/萝卜/葡萄），
   题目给出要收的作物（如"收玉米"），孩子点对应作物成熟的田来收割。
   独特点：季节/作物认知 + 多块田网格 + 收割动画（镰刀挥过，作物倒下）。
   视觉：田地色块 + 作物 emoji + 农舍背景。难度=作物种类数（田数）。
   巧思：每轮目标作物一定在田里至少一块（保证可解）；点错田会温和提示。
   通关=收对目标轮数。点击玩法。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Crop {
  name: string;
  emoji: string;
  color: string;
}

const CROPS: Crop[] = [
  { name: "麦子", emoji: "🌾", color: "#ffd54f" },
  { name: "玉米", emoji: "🌽", color: "#ffb74d" },
  { name: "南瓜", emoji: "🎃", color: "#ff8a65" },
  { name: "萝卜", emoji: "🥕", color: "#ff7043" },
  { name: "葡萄", emoji: "🍇", color: "#9575cd" },
  { name: "草莓", emoji: "🍓", color: "#ef5350" },
];

interface Field {
  crop: Crop;
  el: HTMLButtonElement;
  harvested: boolean;
}

export class FarmHarvestGame extends BaseGame {
  constructor() {
    super("farm-harvest");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target: Crop | null = null;
  private fields: Field[] = [];
  private remaining = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 本关田里出现的作物种类数 */
  private variety(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }
  /** 本关田块总数（目标作物可能不止一块） */
  private fieldCount(): number {
    return this.difficulty === "easy"
      ? 6
      : this.difficulty === "medium"
        ? 8
        : 9;
  }

  private startRound(): void {
    this.locked = false;
    this.fields = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 选 variety 种作物，目标从其中挑一种
    const chosen = shuffle([...CROPS]).slice(0, this.variety());
    this.target = sample(chosen);

    // 生成田块：目标作物至少 2 块，其余随机分布到 variety 种
    const total = this.fieldCount();
    const layout: Crop[] = [];
    layout.push(this.target, this.target); // 保底 2 块目标
    for (let i = 2; i < total; i++) {
      layout.push(sample(chosen));
    }
    const fields = shuffle(layout);

    const wrap = document.createElement("div");
    wrap.className = "fh-wrap";

    const task = document.createElement("div");
    task.className = "fh-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 收 <b>${this.target.emoji} ${this.target.name}</b>！还剩 <span id="fh-left">?</span> 块`;
    wrap.appendChild(task);

    const farm = document.createElement("div");
    farm.className = "fh-farm";
    farm.id = "fh-farm";
    fields.forEach((crop) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "fh-field";
      el.dataset.crop = crop.name;
      el.style.setProperty("--fh-c", crop.color);
      el.innerHTML = `<span class="fh-field__crop">${crop.emoji}</span><span class="fh-field__soil"></span>`;
      el.addEventListener("click", () => this.harvest(crop, el));
      farm.appendChild(el);
      this.fields.push({ crop, el, harvested: false });
    });

    // 计算本关目标田块数（用于显示与判定）
    this.remaining = this.fields.filter(
      (f) => f.crop.name === this.target!.name,
    ).length;

    wrap.appendChild(farm);
    this.root.appendChild(wrap);

    // 更新剩余数
    const leftEl = this.root.querySelector("#fh-left");
    if (leftEl) leftEl.textContent = String(this.remaining);
  }

  private harvest(crop: Crop, el: HTMLButtonElement): void {
    if (this.locked || el.classList.contains("fh-field--done")) return;
    if (crop.name === this.target?.name) {
      el.classList.add("fh-field--done");
      el.disabled = true;
      sfxPop();
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.remaining -= 1;
      const leftEl = this.root.querySelector("#fh-left");
      if (leftEl) leftEl.textContent = String(Math.max(0, this.remaining));
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
      // 点错田：温和提示，不算 done，可继续
      this.onWrong();
      el.classList.add("fh-field--shake");
      this.trackTimeout(() => el.classList.remove("fh-field--shake"), 400);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("fh-style")) return;
    const st = document.createElement("style");
    st.id = "fh-style";
    st.textContent = FH_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function FH_CSS(theme: string): string {
  return `
.fh-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.fh-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.fh-task b{color:${theme};}
.fh-task span{color:${theme};font-weight:900;}
.fh-farm{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px;background:linear-gradient(180deg,#a5d6a7,#81c784);border-radius:24px;box-shadow:var(--shadow);width:100%;max-width:480px;}
.fh-field{position:relative;height:96px;border:none;border-radius:16px;background:linear-gradient(180deg,var(--fh-c,#ffd54f) 0%,var(--fh-c,#ffd54f) 60%,#8d6e63 60%,#6d4c41 100%);box-shadow:inset 0 0 0 3px rgba(255,255,255,.45),0 3px 6px rgba(0,0,0,.15);cursor:pointer;transition:transform .12s;overflow:hidden;}
.fh-field:active{transform:scale(.95);}
.fh-field__crop{position:absolute;top:14px;left:0;right:0;text-align:center;font-size:2.2rem;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));animation:fh-sway 2.2s ease-in-out infinite alternate;}
@keyframes fh-sway{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
.fh-field__soil{position:absolute;bottom:0;left:0;right:0;height:38%;background:repeating-linear-gradient(90deg,rgba(0,0,0,.08) 0 8px,transparent 8px 16px);}
.fh-field--done{opacity:.5;}
.fh-field--done .fh-field__crop{animation:fh-cut .6s ease forwards;}
@keyframes fh-cut{0%{transform:rotate(0) translateY(0);opacity:1}100%{transform:rotate(70deg) translateY(30px);opacity:0}}
.fh-field--shake{animation:fh-shake .4s ease;}
@keyframes fh-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:380px){.fh-field{height:80px;}.fh-field__crop{font-size:1.8rem;}.fh-task{font-size:.95rem;}}
.fh-theme{color:${theme};}
`;
}

export function create(): FarmHarvestGame {
  return new FarmHarvestGame();
}
