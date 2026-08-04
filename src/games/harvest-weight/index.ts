/* 收成称 Harvest Weight —— 两堆收成放在天平两端，天平倾斜显示哪边重，
   孩子选出"哪边更重"。
   独特点：天平会真实倾斜（重的一端下沉），用收成堆叠数量直观体现轻重。
   视觉：木天平 + 两堆不同种类的收成 emoji。难度=数量差异大小（差异越小越难）。
   通关=答对目标轮数。前缀 hw-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

interface Crop {
  emoji: string;
  name: string;
}

const CROPS: Crop[] = [
  { emoji: "🎃", name: "南瓜" },
  { emoji: "🌽", name: "玉米" },
  { emoji: "🥕", name: "胡萝卜" },
  { emoji: "🥔", name: "土豆" },
  { emoji: "🍎", name: "苹果" },
  { emoji: "🍆", name: "茄子" },
];

export class HarvestWeightGame extends BaseGame {
  constructor() {
    super("harvest-weight");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 哪边更重："left" | "right" */
  private answer: "left" | "right" = "left";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 难度档：差异大小（小=难）。返回 [左数, 右数] */
  private genPair(): [number, number] {
    const diff =
      this.difficulty === "easy"
        ? randInt(4, 6)
        : this.difficulty === "medium"
          ? randInt(2, 3)
          : 1;
    const base = randInt(3, 6);
    // 保证两边数量 >=2，且左右随机分配"多的"
    const left = base;
    const right = base + diff;
    return Math.random() < 0.5 ? [left, right] : [right, left];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const [ln, rn] = this.genPair();
    this.answer = ln > rn ? "left" : "right";

    // 两种不同收成
    const pool = [...CROPS];
    const leftCrop = sample(pool);
    // 移除已选，保证右边收成不同
    const li = pool.findIndex((c) => c.emoji === leftCrop.emoji);
    if (li >= 0) pool.splice(li, 1);
    const rightCrop = sample(pool);

    const wrap = document.createElement("div");
    wrap.className = "hw-wrap";

    const task = document.createElement("div");
    task.className = "hw-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 看天平，<b>哪边更重</b>？`;
    wrap.appendChild(task);

    // 天平区
    const scale = document.createElement("div");
    scale.className = "hw-scale";

    // 横梁 + 倾斜：重的一端下沉（旋转角度按比例）
    const tilt = this.answer === "left" ? 1 : -1;
    const diff = Math.abs(ln - rn);
    const deg = Math.min(16, 5 + diff * 1.8) * tilt;

    const beamWrap = document.createElement("div");
    beamWrap.className = "hw-beam-wrap";
    const beam = document.createElement("div");
    beam.className = "hw-beam";
    beam.style.setProperty("--hw-tilt", `${deg}deg`);
    // 左盘
    const leftPan = document.createElement("div");
    leftPan.className = "hw-pan hw-pan--left";
    leftPan.appendChild(this.makePile(leftCrop, ln));
    // 右盘
    const rightPan = document.createElement("div");
    rightPan.className = "hw-pan hw-pan--right";
    rightPan.appendChild(this.makePile(rightCrop, rn));
    beam.appendChild(leftPan);
    beam.appendChild(rightPan);
    beamWrap.appendChild(beam);
    scale.appendChild(beamWrap);

    // 支柱 + 底座
    const stand = document.createElement("div");
    stand.className = "hw-stand";
    scale.appendChild(stand);
    wrap.appendChild(scale);

    // 选项
    const opts = document.createElement("div");
    opts.className = "hw-options";
    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "hw-option";
    leftBtn.innerHTML = `<span class="hw-option__arrow">⬅️</span><span>左边更重</span>`;
    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "hw-option";
    rightBtn.innerHTML = `<span>右边更重</span><span class="hw-option__arrow">➡️</span>`;
    leftBtn.addEventListener("click", () =>
      this.choose(leftBtn, rightBtn, "left"),
    );
    rightBtn.addEventListener("click", () =>
      this.choose(leftBtn, rightBtn, "right"),
    );
    opts.appendChild(leftBtn);
    opts.appendChild(rightBtn);
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private makePile(crop: Crop, n: number): HTMLElement {
    const pile = document.createElement("div");
    pile.className = "hw-pile";
    for (let i = 0; i < n; i++) {
      const e = document.createElement("span");
      e.className = "hw-crop";
      e.textContent = crop.emoji;
      e.style.setProperty("--hw-rx", `${randInt(-6, 6)}px`);
      e.style.setProperty("--hw-ry", `${randInt(-4, 4)}px`);
      pile.appendChild(e);
    }
    return pile;
  }

  private choose(
    leftBtn: HTMLButtonElement,
    rightBtn: HTMLButtonElement,
    side: "left" | "right",
  ): void {
    if (this.locked) return;
    if (side === this.answer) {
      this.locked = true;
      const btn = side === "left" ? leftBtn : rightBtn;
      btn.classList.add("hw-option--right");
      sfxPop();
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
      }, 850);
    } else {
      const btn = side === "left" ? leftBtn : rightBtn;
      btn.classList.add("hw-option--wrong");
      this.trackTimeout(() => btn.classList.remove("hw-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "⚖️",
      variant: "rest",
      body: "天平沉下去的那一边，就是比较重的哦～再看看哪边低？",
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
    if (document.getElementById("hw-style")) return;
    const st = document.createElement("style");
    st.id = "hw-style";
    st.textContent = HW_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function HW_CSS(theme: string): string {
  return `
.hw-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.hw-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.hw-scale{position:relative;width:100%;height:280px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:20px;}
.hw-beam-wrap{position:absolute;left:0;right:0;top:60px;height:0;}
.hw-beam{position:relative;width:100%;height:6px;background:linear-gradient(180deg,#b08968,#8a6a4a);border-radius:3px;transform:rotate(var(--hw-tilt,0deg));transform-origin:50% 50%;transition:transform .6s cubic-bezier(.34,1.56,.64,1);box-shadow:0 3px 4px rgba(0,0,0,.2);}
.hw-beam::before{content:"";position:absolute;left:50%;top:-12px;transform:translateX(-50%);width:24px;height:24px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d8a878,#8a6a4a);box-shadow:var(--shadow);}
.hw-pan{position:absolute;top:6px;width:120px;display:flex;flex-direction:column;align-items:center;}
.hw-pan--left{left:calc(50% - 130px);}
.hw-pan--right{right:calc(50% - 130px);}
.hw-pan::before{content:"";display:block;width:110px;height:14px;background:linear-gradient(180deg,#c89a6a,#9a7048);border-radius:0 0 60px 60px / 0 0 14px 14px;box-shadow:0 2px 3px rgba(0,0,0,.2);margin-bottom:-2px;}
.hw-pan::after{content:"";position:absolute;top:0;width:2px;height:30px;background:#8a6a4a;left:50%;transform:translateX(-50%);}
.hw-pile{display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-end;width:108px;min-height:40px;gap:0;padding:2px;}
.hw-crop{font-size:1.6rem;line-height:1;transform:translate(var(--hw-rx,0),var(--hw-ry,0));filter:drop-shadow(0 1px 1px rgba(0,0,0,.2));}
.hw-stand{width:14px;height:90px;background:linear-gradient(180deg,#b08968,#8a6a4a);border-radius:4px;box-shadow:var(--shadow);}
.hw-stand::before,.hw-stand::after{content:"";position:absolute;}
.hw-scale::after{content:"";position:absolute;bottom:8px;width:120px;height:14px;background:linear-gradient(180deg,#8a6a4a,#5a4a2a);border-radius:50%;box-shadow:0 4px 6px rgba(0,0,0,.25);}
.hw-options{display:flex;gap:20px;width:100%;justify-content:center;}
.hw-option{display:flex;align-items:center;gap:8px;font-size:1.15rem;font-weight:800;padding:14px 26px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,${theme}22);color:#333;box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:pointer;transition:transform .1s;}
.hw-option:active{transform:translateY(3px);}
.hw-option__arrow{font-size:1.4rem;}
.hw-option--right{background:linear-gradient(180deg,#bff0c1,#6bcf7f);color:#1d6b2c;animation:hw-bounce .5s ease;}
.hw-option--wrong{background:linear-gradient(180deg,#ffd0c4,#ff8a72);animation:hw-shake .5s ease;}
@keyframes hw-bounce{0%,100%{transform:scale(1)}40%{transform:scale(1.12)}}
@keyframes hw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.hw-scale{height:240px;}.hw-pan{width:96px;}.hw-pan--left{left:calc(50% - 104px);}.hw-pan--right{right:calc(50% - 104px);}.hw-pile{width:88px;}.hw-crop{font-size:1.4rem;}.hw-option{font-size:1rem;padding:12px 18px;}}
`;
}

export function create(): HarvestWeightGame {
  return new HarvestWeightGame();
}
