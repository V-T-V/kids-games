/* 天气小助手 Weather —— 根据天气场景选对应物品。
   巧思：天气背景动画（雨/雪/云动），答对场景放晴。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Weather {
  id: string;
  name: string;
  emoji: string;
  bg: string;
  items: string[];
}
const WEATHERS: Weather[] = [
  {
    id: "sunny",
    name: "晴天",
    emoji: "☀️",
    bg: "linear-gradient(180deg,#ffe082,#fff3c4)",
    items: ["🕶️", "🧢", "🍦"],
  },
  {
    id: "rain",
    name: "下雨",
    emoji: "🌧️",
    bg: "linear-gradient(180deg,#90a4ae,#cfd8dc)",
    items: ["☂️", "🥿", "🧥"],
  },
  {
    id: "snow",
    name: "下雪",
    emoji: "❄️",
    bg: "linear-gradient(180deg,#b3e5fc,#e1f5fe)",
    items: ["🧣", "🧤", "⛄"],
  },
  {
    id: "wind",
    name: "大风",
    emoji: "💨",
    bg: "linear-gradient(180deg,#a5d6a7,#c8e6c9)",
    items: ["🪖", "🧥", "🪁"],
  },
  {
    id: "hot",
    name: "酷暑",
    emoji: "🥵",
    bg: "linear-gradient(180deg,#ff8a65,#ffab91)",
    items: ["🥤", "🏊", "🧴"],
  },
];
const ALL_ITEMS = [
  "🕶️",
  "🧢",
  "🍦",
  "☂️",
  "🥿",
  "🧥",
  "🧣",
  "🧤",
  "⛄",
  "🪖",
  "🪁",
  "🥤",
  "🏊",
  "🧴",
  "📚",
  "🖥️",
];

export class WeatherGame extends BaseGame {
  constructor() {
    super("weather");
  }
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const w = sample(WEATHERS);
    const correctItems = shuffle(w.items).slice(0, 2);
    // 干扰项
    const distract: string[] = [];
    while (distract.length < 2) {
      const it = sample(ALL_ITEMS);
      if (!w.items.includes(it) && !distract.includes(it)) distract.push(it);
    }
    const choices = shuffle([...correctItems, ...distract]);
    const needed = correctItems.length;
    const picked = new Set<string>();

    const wrap = document.createElement("div");
    wrap.className = "wt-wrap";

    const task = document.createElement("div");
    task.className = "wt-task";
    task.textContent = `${w.emoji} ${w.name}天，该带哪 ${needed} 样？`;
    wrap.appendChild(task);

    // 天气场景
    const scene = document.createElement("div");
    scene.className = "wt-scene wt-scene--" + w.id;
    scene.style.background = w.bg;
    scene.innerHTML = `<div class="wt-sun">${w.emoji}</div>`;
    wrap.appendChild(scene);

    // 选项
    const opts = document.createElement("div");
    opts.className = "wt-opts";
    const pickEls: HTMLButtonElement[] = [];
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wt-choice";
      b.textContent = c;
      b.addEventListener("click", () => {
        if (b.classList.contains("wt-choice--done")) return;
        if (correctItems.includes(c)) {
          b.classList.add("wt-choice--done");
          sfxPop();
          picked.add(c);
          const r = b.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          if (picked.size >= needed) {
            this.roundsDone += 1;
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal)
                this.finishClear(starsByAccuracy(this.wrongCount));
              else this.startRound();
            }, 1100);
          }
        } else {
          b.classList.add("wt-choice--wrong");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("wt-choice--wrong"), 400);
          if (paused) this.showRest();
        }
      });
      pickEls.push(b);
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想这种天气出门需要什么～",
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
    if (document.getElementById("wt-style")) return;
    const st = document.createElement("style");
    st.id = "wt-style";
    st.textContent = WT_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function WT_CSS(_theme: string): string {
  return `
.wt-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.wt-task{font-size:1.2rem;font-weight:800;text-align:center;}
.wt-scene{width:100%;height:180px;border-radius:20px;box-shadow:var(--shadow);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;}
.wt-sun{font-size:4.5rem;animation:wt-float 2.5s ease-in-out infinite;z-index:2;}
.wt-scene--rain::before,.wt-scene--snow::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,#fff 2px,transparent 2px);background-size:30px 30px;animation:wt-fall 1s linear infinite;opacity:.6;}
.wt-scene--rain::before{background-image:linear-gradient(180deg,transparent,#b3e5fc 50%,transparent);}
.wt-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.wt-choice{width:76px;height:76px;font-size:2.4rem;border-radius:18px;background:#fff;box-shadow:var(--shadow);}
.wt-choice:active{transform:scale(.92);}
.wt-choice--done{background:#d4f4dd;animation:wt-pop .4s ease;}
.wt-choice--wrong{animation:wt-shake .4s ease;}
@keyframes wt-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes wt-fall{0%{background-position:0 0}100%{background-position:0 30px}}
@keyframes wt-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes wt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): WeatherGame {
  return new WeatherGame();
}
