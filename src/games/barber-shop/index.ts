/* 理发师 Barber Shop —— 照目标发型，从选项里选出完全一样的发型给顾客。
   独特点：多特征配对（发型形状 + 颜色），训练观察 + 一致性判断。
   视觉：顾客头像 + 发型样式块 + 发型选项。难度=发型复杂度（选项数/相似度）。
   通关=剪对目标轮数。巧思：选项含 1 个正确 + 若干"差一项"的干扰，保证唯一正确。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

type Style = "short" | "long" | "spiky" | "curly" | "pony";

interface Haircut {
  style: Style;
  color: string;
}

const STYLE_META: Record<Style, { name: string; emoji: string }> = {
  short: { name: "短发", emoji: "👧" },
  long: { name: "长发", emoji: "👩" },
  spiky: { name: "刺猬头", emoji: "👱" },
  curly: { name: "卷发", emoji: "🧑" },
  pony: { name: "马尾", emoji: "🧒" },
};

const COLORS = [
  "#ff6b9d",
  "#4d96ff",
  "#6bcf7f",
  "#ffd93d",
  "#a55eea",
  "#ff9f43",
  "#b08968",
];

const ENCOURAGE = [
  "剪得一模一样！",
  "眼睛真亮！",
  "你是金牌理发师！",
  "仔细比一比哦～",
];

export class BarberShopGame extends BaseGame {
  constructor() {
    super("barber-shop");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target: Haircut | null = null;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    // 生成目标发型
    const styles = Object.keys(STYLE_META) as Style[];
    const style = sample(styles);
    const color = sample(COLORS);
    this.target = { style, color };

    // 生成选项：1 个正确 + (optCount-1) 个"差一项"的干扰
    const opts: Haircut[] = [{ style, color }];
    const optSet = new Set<string>([`${style}|${color}`]);
    let guard = 0;
    while (opts.length < this.optCount() && guard < 200) {
      guard += 1;
      // 干扰项：随机改样式或颜色（但不同时改两项以确保"接近"）
      const flipStyle = Math.random() < 0.5;
      const ns = flipStyle ? sample(styles.filter((s) => s !== style)) : style;
      const nc = flipStyle ? color : sample(COLORS.filter((c) => c !== color));
      const key = `${ns}|${nc}`;
      if (!optSet.has(key)) {
        optSet.add(key);
        opts.push({ style: ns, color: nc });
      }
    }
    // 兜底补够
    while (opts.length < this.optCount()) {
      opts.push({ style: sample(styles), color: sample(COLORS) });
    }

    const wrap = document.createElement("div");
    wrap.className = "bs2-wrap";

    const task = document.createElement("div");
    task.className = "bs2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 照左边的样子，选一模一样的发型 ✂️`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "bs2-stage";

    // 目标展示（不能点）
    const targetCard = document.createElement("div");
    targetCard.className = "bs2-target";
    targetCard.innerHTML = `<div class="bs2-label">目标发型</div>${this.renderHair(this.target)}`;
    stage.appendChild(targetCard);

    // 顾客（待剪）
    const customer = document.createElement("div");
    customer.className = "bs2-customer";
    customer.id = "bs2-customer";
    customer.innerHTML = `<div class="bs2-label">顾客</div><div class="bs2-face">😊</div>`;
    stage.appendChild(customer);

    wrap.appendChild(stage);

    // 选项
    const optsEl = document.createElement("div");
    optsEl.className = "bs2-options";
    shuffle(opts).forEach((h) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bs2-option";
      b.innerHTML = this.renderHair(h);
      b.addEventListener("click", () => this.choose(b, h));
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    this.root.appendChild(wrap);
  }

  /** 渲染一个发型样式：颜色块 + emoji。 */
  private renderHair(h: Haircut): string {
    const m = STYLE_META[h.style];
    return `<div class="bs2-hair" style="--bs2-color:${h.color}">${m.emoji}</div>`;
  }

  private choose(btn: HTMLButtonElement, h: Haircut): void {
    if (this.locked || !this.target) return;
    const correct =
      h.style === this.target.style && h.color === this.target.color;
    if (correct) {
      this.locked = true;
      btn.classList.add("bs2-option--right");
      sfxPop();
      // 把发型"戴"到顾客头上
      const customer = this.root.querySelector("#bs2-customer");
      if (customer) {
        customer.innerHTML = `<div class="bs2-label">顾客</div>${this.renderHair(this.target)}`;
        customer.classList.add("bs2-customer--done");
      }
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 950);
    } else {
      btn.classList.add("bs2-option--wrong");
      this.trackTimeout(() => btn.classList.remove("bs2-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "💈",
      variant: "rest",
      body: `比一比发型的样子和颜色，要完全一样哦～ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("bs2-style")) return;
    const st = document.createElement("style");
    st.id = "bs2-style";
    st.textContent = BS2_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function BS2_CSS(theme: string): string {
  return `
.bs2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.bs2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.bs2-stage{display:flex;gap:18px;align-items:flex-start;justify-content:center;}
.bs2-label{font-size:.8rem;font-weight:900;color:#888;text-align:center;margin-bottom:4px;}
.bs2-target,.bs2-customer{display:flex;flex-direction:column;align-items:center;padding:14px 16px;background:#fff;border-radius:20px;box-shadow:var(--shadow);min-width:108px;}
.bs2-target{border:3px solid ${theme};}
.bs2-customer{transition:transform .3s ease;}
.bs2-customer--done{animation:bs2-happy .6s ease;}
.bs2-face{font-size:3rem;line-height:1;}
.bs2-hair{font-size:3rem;line-height:1;filter:drop-shadow(0 2px 3px var(--bs2-color,#00000066));animation:bs2-pop .35s ease;}
@keyframes bs2-pop{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes bs2-happy{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.bs2-options{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.bs2-option{display:flex;align-items:center;justify-content:center;min-width:76px;height:84px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,${theme}22);box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:pointer;transition:transform .1s;}
.bs2-option:active{transform:translateY(3px);}
.bs2-option--right{background:linear-gradient(180deg,#bff0c1,#6bcf7f);animation:bs2-pop .5s ease;}
.bs2-option--wrong{background:linear-gradient(180deg,#ffd0c4,#ff8a72);animation:bs2-shake .5s ease;}
@keyframes bs2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.bs2-target,.bs2-customer{min-width:92px;padding:10px;}.bs2-hair,.bs2-face{font-size:2.4rem;}.bs2-option{min-width:64px;height:72px;}}
`;
}

export function create(): BarberShopGame {
  return new BarberShopGame();
}
