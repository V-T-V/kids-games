/* 季节转盘 Seasons Wheel —— 转盘分四季，转一下停在某季（如冬天），
   孩子从下面的选项里选出属于这个季节的景物（雪人/梅花）。
   独特点：转盘动画 + 季节常识归类。
   巧思：转盘用 conic-gradient 涂四色扇区，CSS 旋转到目标季；
   每个季节有正确景物 + 干扰景物，点对闪光收集，点错弹一下。
   难度=选项数。注意前缀 sw2-（spider-web 用 sw-）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { shuffle, sample } from "../../lobby/util.ts";

interface Season {
  id: string;
  name: string;
  emoji: string;
  color: string;
  items: { emoji: string; name: string }[];
}

const SEASONS: Season[] = [
  {
    id: "spring",
    name: "春天",
    emoji: "🌸",
    color: "#ff9ec4",
    items: [
      { emoji: "🌱", name: "嫩芽" },
      { emoji: "🌷", name: "郁金香" },
      { emoji: "🐝", name: "蜜蜂" },
      { emoji: "🦋", name: "蝴蝶" },
    ],
  },
  {
    id: "summer",
    name: "夏天",
    emoji: "☀️",
    color: "#ffd166",
    items: [
      { emoji: "🍉", name: "西瓜" },
      { emoji: "🍦", name: "冰淇淋" },
      { emoji: "🌻", name: "向日葵" },
      { emoji: "🏖️", name: "沙滩" },
    ],
  },
  {
    id: "autumn",
    name: "秋天",
    emoji: "🍁",
    color: "#f0a050",
    items: [
      { emoji: "🍂", name: "落叶" },
      { emoji: "🎃", name: "南瓜" },
      { emoji: "🌰", name: "栗子" },
      { emoji: "🌽", name: "玉米" },
    ],
  },
  {
    id: "winter",
    name: "冬天",
    emoji: "❄️",
    color: "#9ed3ff",
    items: [
      { emoji: "⛄", name: "雪人" },
      { emoji: "🧣", name: "围巾" },
      { emoji: "🏵️", name: "梅花" },
      { emoji: "🎿", name: "滑雪" },
    ],
  },
];

interface Option {
  emoji: string;
  name: string;
  isTarget: boolean;
  el: HTMLButtonElement;
  picked: boolean;
}

export class SeasonsWheelGame extends BaseGame {
  constructor() {
    super("seasons-wheel");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private current: Season | null = null;
  private options: Option[] = [];
  private remaining = 0;
  private wheel!: HTMLDivElement;
  private spinning = false;

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
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.spinning = false;

    // 本轮随机一个季节
    this.current = sample(SEASONS);
    const targets = this.difficulty === "hard" ? 3 : 2;
    const distracts =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;

    // 正确景物
    const targetItems = shuffle(this.current.items).slice(0, targets);
    // 干扰景物：来自其它季节
    const otherItems = SEASONS.filter((s) => s.id !== this.current!.id).flatMap(
      (s) => s.items,
    );
    const distractItems = shuffle(otherItems).slice(0, distracts);

    const all = shuffle([
      ...targetItems.map((it) => ({ ...it, isTarget: true })),
      ...distractItems.map((it) => ({ ...it, isTarget: false })),
    ]);
    this.remaining = targetItems.length;
    this.options = [];

    const wrap = document.createElement("div");
    wrap.className = "sw2-wrap";
    const task = document.createElement("div");
    task.className = "sw2-task";
    task.textContent = "转一转转盘，选出属于停下季节的景物～";
    wrap.appendChild(task);

    /* —— 转盘 —— */
    const wheelWrap = document.createElement("div");
    wheelWrap.className = "sw2-wheel-wrap";
    this.wheel = document.createElement("div");
    this.wheel.className = "sw2-wheel";
    // 指针
    const pointer = document.createElement("div");
    pointer.className = "sw2-pointer";
    pointer.textContent = "🔽";
    wheelWrap.appendChild(pointer);
    wheelWrap.appendChild(this.wheel);
    // 四季标签
    const labels = document.createElement("div");
    labels.className = "sw2-labels";
    SEASONS.forEach((s) => {
      const l = document.createElement("span");
      l.className = "sw2-label";
      l.style.color = s.color;
      l.textContent = `${s.emoji}${s.name}`;
      labels.appendChild(l);
    });
    wrap.appendChild(wheelWrap);
    wrap.appendChild(labels);

    const spinBtn = document.createElement("button");
    spinBtn.type = "button";
    spinBtn.className = "sw2-spin";
    spinBtn.textContent = "🎲 转转盘";
    spinBtn.addEventListener("click", () => this.spin(spinBtn));
    wrap.appendChild(spinBtn);

    // 当前季提示 + 选项区（转之前隐藏）
    const seasonTip = document.createElement("div");
    seasonTip.className = "sw2-tip";
    seasonTip.id = "sw2-tip";
    seasonTip.textContent = "先转转盘吧～";
    wrap.appendChild(seasonTip);

    const opts = document.createElement("div");
    opts.className = "sw2-opts";
    opts.id = "sw2-opts";
    opts.style.visibility = "hidden";
    all.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sw2-opt";
      b.innerHTML = `<span class="sw2-opt__emoji">${it.emoji}</span><span class="sw2-opt__name">${it.name}</span>`;
      b.addEventListener("click", () => this.pick(it.emoji + it.name, b));
      opts.appendChild(b);
      this.options.push({
        emoji: it.emoji,
        name: it.name,
        isTarget: it.isTarget,
        el: b,
        picked: false,
      });
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private spin(btn: HTMLButtonElement): void {
    if (this.spinning || !this.current) return;
    this.spinning = true;
    btn.disabled = true;
    sfxPop();
    // 计算转到 current 季需要的角度（指针在顶部，顺时针）
    // 四季按 0/90/180/270 分布，扇区中心在 45/135/225/315（顺时针，从顶部）
    const idx = SEASONS.indexOf(this.current);
    // 转 4 圈 + 落到目标扇区中心
    const base = 360 * 4;
    const targetCenter = idx * 90 + 45; // 扇区中心（顺时针从顶部）
    const final = base + (360 - targetCenter);
    this.wheel.style.transform = `rotate(${final}deg)`;

    this.trackTimeout(() => {
      this.spinning = false;
      const tip = this.root.querySelector("#sw2-tip");
      if (tip)
        tip.innerHTML = `停在了 <b style="color:${this.current!.color}">${this.current!.emoji} ${this.current!.name}</b>！把属于${this.current!.name}的景物点出来～`;
      const opts = this.root.querySelector("#sw2-opts");
      if (opts) (opts as HTMLElement).style.visibility = "visible";
    }, 1700);
  }

  private pick(key: string, btn: HTMLButtonElement): void {
    // key 仅用于定位 option（emoji+name 唯一）
    const opt = this.options.find((o) => o.emoji + o.name === key);
    if (!opt || opt.picked) return;
    if (opt.isTarget) {
      opt.picked = true;
      btn.classList.add("sw2-opt--good");
      btn.disabled = true;
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.remaining -= 1;
      if (this.remaining <= 0) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1000);
      }
    } else {
      btn.classList.add("sw2-opt--shake");
      this.trackTimeout(() => btn.classList.remove("sw2-opt--shake"), 400);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想这个季节能看到什么～",
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
    if (document.getElementById("sw2-style")) return;
    const st = document.createElement("style");
    st.id = "sw2-style";
    st.textContent = SW2_CSS(
      SEASONS[0]!.color,
      SEASONS[1]!.color,
      SEASONS[2]!.color,
      SEASONS[3]!.color,
    );
    document.head.appendChild(st);
  }
}

function SW2_CSS(c1: string, c2: string, c3: string, c4: string): string {
  return `
.sw2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.sw2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.sw2-wheel-wrap{position:relative;width:220px;height:220px;display:flex;align-items:center;justify-content:center;}
.sw2-pointer{position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:2rem;z-index:3;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));}
.sw2-wheel{
  width:200px;height:200px;border-radius:50%;border:8px solid #fff;box-shadow:var(--shadow);
  background:conic-gradient(
    from -45deg,
    ${c1} 0deg 90deg,
    ${c2} 90deg 180deg,
    ${c3} 180deg 270deg,
    ${c4} 270deg 360deg
  );
  transition:transform 1.6s cubic-bezier(.18,.74,.22,1);
  position:relative;
}
.sw2-wheel::after{content:'🎯';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:var(--shadow);}
.sw2-labels{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;font-weight:800;font-size:.95rem;}
.sw2-spin{font-size:1.1rem;font-weight:900;color:#fff;background:#4d96ff;border:none;padding:12px 26px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;}
.sw2-spin:active{transform:scale(.95);}
.sw2-spin:disabled{opacity:.5;cursor:default;}
.sw2-tip{font-size:1.05rem;font-weight:800;text-align:center;min-height:1.6em;}
.sw2-opts{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.sw2-opt{display:flex;flex-direction:column;align-items:center;gap:2px;width:78px;padding:8px 4px;border-radius:16px;border:2px solid #eee;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;}
.sw2-opt:active{transform:scale(.94);}
.sw2-opt__emoji{font-size:2rem;}
.sw2-opt__name{font-size:.8rem;font-weight:700;color:var(--ink-soft);}
.sw2-opt--good{background:#e6ffe9;border-color:#6bcf7f;animation:sw2-pop .4s ease;}
@keyframes sw2-pop{0%{transform:scale(1);}40%{transform:scale(1.2);}100%{transform:scale(1);}}
.sw2-opt--shake{animation:sw2-shake .4s ease;}
@keyframes sw2-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
@media (max-width:380px){.sw2-wheel-wrap{width:184px;height:184px;}.sw2-wheel{width:168px;height:168px;}.sw2-opt{width:66px;}}
`;
}

export function create(): SeasonsWheelGame {
  return new SeasonsWheelGame();
}
