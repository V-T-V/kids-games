/* 温度穿衣 Thermometer Dress —— 温度计显示某个温度，孩子选该温度该穿的衣物。
   巧思：冷(≤10)→棉衣 / 凉(11-20)→长袖 / 暖(21-30)→短袖 / 热(>30)→背心短裤。
   CSS 温度计 + 衣物卡片。难度=选项干扰数。通关=选对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

/** 温度带：每个区间对应一种正确衣物 */
const ZONES: {
  lo: number;
  hi: number;
  cloth: string;
  icon: string;
  tip: string;
}[] = [
  { lo: 0, hi: 8, cloth: "厚棉衣", icon: "🧥", tip: "很冷，要穿厚厚的" },
  { lo: 9, hi: 16, cloth: "长袖外套", icon: "🧶", tip: "有点凉，穿长袖" },
  { lo: 17, hi: 26, cloth: "短袖", icon: "👕", tip: "暖和，穿短袖就行" },
  { lo: 27, hi: 38, cloth: "背心短裤", icon: "🩳", tip: "很热，穿凉凉的" },
];

/** 干扰衣物池（错误的选项） */
const DISTRACTORS: { cloth: string; icon: string }[] = [
  { cloth: "厚棉衣", icon: "🧥" },
  { cloth: "长袖外套", icon: "🧶" },
  { cloth: "短袖", icon: "👕" },
  { cloth: "背心短裤", icon: "🩳" },
  { cloth: "雨衣", icon: "🧳" },
  { cloth: "毛衣", icon: "🧶" },
];

export class ThermometerDressGame extends BaseGame {
  constructor() {
    super("thermometer-dress");
  }

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
    /* DOM 由基类清空 */
  }

  /** 选项数量随难度 */
  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 随机一个温度
    const zone = sample(ZONES);
    const temp = randInt(zone.lo, zone.hi);
    const correct = { cloth: zone.cloth, icon: zone.icon };

    // 生成选项：正确 + 干扰（不重复 cloth）
    const n = this.optCount();
    const distractPool = shuffle(
      DISTRACTORS.filter((d) => d.cloth !== correct.cloth),
    );
    const opts = shuffle([correct, ...distractPool.slice(0, n - 1)]);

    const wrap = document.createElement("div");
    wrap.className = "td2-wrap";

    const task = document.createElement("div");
    task.className = "td2-task";
    task.textContent = `今天 ${temp} 度，该穿什么？（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 温度计
    const meter = this.buildMeter(temp);
    wrap.appendChild(meter);

    const tip = document.createElement("div");
    tip.className = "td2-tip";
    tip.textContent = zone.tip;
    wrap.appendChild(tip);

    // 选项
    const optsEl = document.createElement("div");
    optsEl.className = "td2-opts";
    opts.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "td2-opt";
      b.innerHTML = `<span class="td2-opt__icon">${o.icon}</span><span class="td2-opt__name">${o.cloth}</span>`;
      b.addEventListener("click", () =>
        this.choose(o.cloth === correct.cloth, b),
      );
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    this.root.appendChild(wrap);
  }

  /** 构建温度计 DOM */
  private buildMeter(temp: number): HTMLDivElement {
    const box = document.createElement("div");
    box.className = "td2-meter";
    // 温度范围固定 0-38，便于孩子直观
    const lo = 0;
    const hi = 38;
    const ratio = (temp - lo) / (hi - lo);
    const fillPct = Math.max(6, Math.min(100, 10 + ratio * 84));
    // 颜色：冷蓝 → 凉青 → 暖橙 → 热红
    const color =
      temp <= 8
        ? "#4d96ff"
        : temp <= 16
          ? "#22d3ee"
          : temp <= 26
            ? "#ff9f43"
            : "#ff5252";

    const tube = document.createElement("div");
    tube.className = "td2-tube";
    const fill = document.createElement("div");
    fill.className = "td2-fill";
    fill.style.height = `${fillPct}%`;
    fill.style.background = `linear-gradient(180deg,color-mix(in srgb,${color} 70%,#fff),${color})`;
    tube.appendChild(fill);
    const bulb = document.createElement("div");
    bulb.className = "td2-bulb";
    bulb.style.background = `radial-gradient(circle at 35% 30%,color-mix(in srgb,${color} 70%,#fff),${color})`;
    tube.appendChild(bulb);

    const num = document.createElement("div");
    num.className = "td2-num";
    num.innerHTML = `<b>${temp}</b><span>℃</span>`;

    box.appendChild(num);
    box.appendChild(tube);
    return box;
  }

  private choose(correct: boolean, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (correct) {
      this.locked = true;
      sfxPop();
      btn.classList.add("td2-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("td2-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("td2-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看温度计红柱升到哪：低冷高热～",
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
    if (document.getElementById("td2-style")) return;
    const st = document.createElement("style");
    st.id = "td2-style";
    st.textContent = TD2_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function TD2_CSS(theme: string): string {
  return `
.td2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(460px,100%);}
.td2-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.td2-meter{display:flex;align-items:flex-end;gap:14px;height:240px;}
.td2-num{font-size:.9rem;font-weight:800;color:var(--ink-soft);text-align:center;line-height:1.1;}
.td2-num b{display:block;font-size:2rem;color:${theme};}
.td2-tube{position:relative;width:36px;height:210px;background:#f1f1f4;border-radius:18px;border:3px solid var(--ink);box-shadow:var(--shadow);overflow:visible;}
.td2-fill{position:absolute;left:0;right:0;bottom:0;border-radius:0 0 14px 14px;transition:height .6s cubic-bezier(.34,1.56,.64,1);box-shadow:inset 2px 0 0 rgba(255,255,255,.35);}
.td2-bulb{position:absolute;left:50%;bottom:-22px;width:52px;height:52px;transform:translateX(-50%);border-radius:50%;border:3px solid var(--ink);box-shadow:var(--shadow);}
.td2-tip{font-size:1rem;font-weight:700;color:var(--ink-soft);background:rgba(255,255,255,.6);padding:6px 16px;border-radius:999px;}
.td2-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.td2-opt{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:96px;min-height:96px;padding:12px;font-size:1rem;font-weight:800;border-radius:18px;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .1s ease;border:none;cursor:pointer;}
.td2-opt:active{transform:scale(.94);}
.td2-opt__icon{font-size:2.4rem;line-height:1;}
.td2-opt--done{background:${theme};color:#fff;animation:td2-pop .4s ease;}
.td2-opt--wrong{animation:td2-shake .4s ease;}
@keyframes td2-pop{0%{transform:scale(.7)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes td2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.td2-opt{min-width:78px;min-height:84px;}.td2-opt__icon{font-size:2rem;}}
`;
}

export function create(): ThermometerDressGame {
  return new ThermometerDressGame();
}
