/* 天气预测 Weather Forecast —— 给若干天气线索（如「乌云密布 + 闷热」），
   预测可能出现的天气（雷雨）。从选项中点选正确天气。
   独特点：天气 emoji 大图 + 线索卡片 + 选中后场景动画切换。
   巧思：难度=干扰项数 + 线索条数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface WeatherQ {
  weather: string;
  emoji: string;
  scene: string; // 场景背景描述（CSS 渐变）
  clues: string[];
  options: string[]; // 含正确答案 + 干扰
}

const QUESTIONS: WeatherQ[] = [
  {
    weather: "雷雨",
    emoji: "⛈️",
    scene: "linear-gradient(180deg,#3a4a6b,#1f2740)",
    clues: ["乌云密布 ☁️", "又闷又热 🥵"],
    options: ["雷雨", "晴天", "下雪", "大风"],
  },
  {
    weather: "晴天",
    emoji: "☀️",
    scene: "linear-gradient(180deg,#7ec8ff,#bfe9ff)",
    clues: ["天空很蓝 💙", "阳光很亮 ✨"],
    options: ["晴天", "雾天", "雷雨", "冰雹"],
  },
  {
    weather: "下雪",
    emoji: "🌨️",
    scene: "linear-gradient(180deg,#cfd8ff,#eef3ff)",
    clues: ["天气很冷 🥶", "云层厚厚的 ☁️"],
    options: ["下雪", "晴天", "彩虹", "大风"],
  },
  {
    weather: "彩虹",
    emoji: "🌈",
    scene: "linear-gradient(180deg,#9be7ff,#e7c6ff)",
    clues: ["刚下完雨 💧", "太阳出来了 ☀️"],
    options: ["彩虹", "下雪", "雾天", "晴天"],
  },
  {
    weather: "大风",
    emoji: "💨",
    scene: "linear-gradient(180deg,#9fb6c9,#cdd9e3)",
    clues: ["树叶被吹飞 🍃", "旗子飘得很快 🚩"],
    options: ["大风", "下雪", "雷雨", "晴天"],
  },
  {
    weather: "雾天",
    emoji: "🌫️",
    scene: "linear-gradient(180deg,#b8c0c8,#dfe4e8)",
    clues: ["白茫茫一片 ⚪", "看不清远处 👀"],
    options: ["雾天", "彩虹", "大风", "晴天"],
  },
  {
    weather: "多云",
    emoji: "⛅",
    scene: "linear-gradient(180deg,#a8c6e8,#cfe3f5)",
    clues: ["天空有些云 ☁️", "太阳时隐时现 🌤️"],
    options: ["多云", "晴天", "大风", "雷雨"],
  },
  {
    weather: "阴天",
    emoji: "🌩️",
    scene: "linear-gradient(180deg,#7c8aa0,#a3b0c2)",
    clues: ["天空灰灰的 🩶", "云层厚厚的遮住太阳 ☁️"],
    options: ["阴天", "晴天", "雾天", "大风"],
  },
  {
    weather: "下雨",
    emoji: "🌧️",
    scene: "linear-gradient(180deg,#6b8cae,#9fb6cf)",
    clues: ["天上有乌云 ☁️", "空气湿湿的 💧"],
    options: ["下雨", "下雪", "雾天", "大风"],
  },
  {
    weather: "冰雹",
    emoji: "🧊",
    scene: "linear-gradient(180deg,#c2d0e0,#e4ecf5)",
    clues: ["天上掉下硬硬的冰球 🧊", "打在窗户上叮叮响 🔔"],
    options: ["冰雹", "下雪", "雷雨", "晴天"],
  },
  {
    weather: "雷暴",
    emoji: "⛈️",
    scene: "linear-gradient(180deg,#2f3b55,#1a2238)",
    clues: ["闪电一道道 ⚡", "雷声轰隆隆 📢"],
    options: ["雷暴", "下雨", "大风", "雾天"],
  },
];

export class WeatherForecastGame extends BaseGame {
  constructor() {
    super("weather-forecast");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private order: WeatherQ[] = [];
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    // 按难度决定干扰项数（选项数）
    this.optCount =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 4;
    this.injectStyle();
    this.order = shuffle(QUESTIONS);
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private optCount = 4;
  private clueCount(): number {
    return this.difficulty === "easy" ? 1 : 2;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const q = this.order[this.roundsDone % this.order.length] ?? QUESTIONS[0]!;

    const wrap = document.createElement("div");
    wrap.className = "wf-wrap";

    const task = document.createElement("div");
    task.className = "wf-task";
    task.innerHTML = `看线索，猜猜会是什么<b>天气</b>？<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 题</small>`;
    wrap.appendChild(task);

    // 场景卡片（含线索）
    const scene = document.createElement("div");
    scene.className = "wf-scene";
    scene.style.background = q.scene;

    const clues = document.createElement("div");
    clues.className = "wf-clues";
    const useClues = q.clues.slice(0, this.clueCount());
    useClues.forEach((c) => {
      const chip = document.createElement("div");
      chip.className = "wf-clue";
      chip.textContent = c;
      clues.appendChild(chip);
    });
    scene.appendChild(clueIcon());
    scene.appendChild(clues);
    wrap.appendChild(scene);

    // 选项
    const opts = document.createElement("div");
    opts.className = "wf-opts";
    const shuffled = shuffle(q.options).slice(0, this.optCount);
    // 确保正确答案在选项中
    const finalOpts = shuffled.includes(q.weather)
      ? shuffled
      : [...shuffled, q.weather];
    shuffle(finalOpts).forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wf-opt";
      const w = QUESTIONS.find((x) => x.weather === opt);
      b.innerHTML = `<span class="wf-opt__emoji">${w?.emoji ?? "❓"}</span><span class="wf-opt__name">${opt}</span>`;
      b.addEventListener("click", () => this.onPick(opt, q, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private onPick(opt: string, q: WeatherQ, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    if (opt !== q.weather) {
      btn.classList.add("wf-opt--wrong");
      this.onWrong();
      // 短暂提示后允许重选（本题未算对）
      this.trackTimeout(() => {
        this.answered = false;
        btn.classList.remove("wf-opt--wrong");
      }, 700);
      return;
    }
    sfxPop();
    btn.classList.add("wf-opt--right");
    // 场景显示该天气大图
    const scene = this.root.querySelector(".wf-scene");
    const reveal = document.createElement("div");
    reveal.className = "wf-reveal";
    reveal.innerHTML = `<span>${q.emoji}</span><b>${q.weather}</b>`;
    scene?.appendChild(reveal);
    const r = btn.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.roundsDone += 1;
    this.resetWrongStreak();
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 1300);
  }

  private injectStyle(): void {
    if (document.getElementById("wf-style")) return;
    const st = document.createElement("style");
    st.id = "wf-style";
    st.textContent = WF_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

/** 场景里的放大镜装饰图标（提示「观察线索」） */
function clueIcon(): HTMLDivElement {
  const d = document.createElement("div");
  d.className = "wf-scene__icon";
  d.textContent = "🔎";
  return d;
}

function WF_CSS(theme: string): string {
  return `
.wf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.wf-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.wf-task b{color:${theme};}
.wf-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.wf-scene{position:relative;width:min(420px,92%);min-height:160px;border-radius:24px;box-shadow:var(--shadow-lg);padding:20px;display:flex;flex-direction:column;align-items:center;gap:14px;overflow:hidden;}
.wf-scene__icon{font-size:2.2rem;animation:wf-float 2.6s ease-in-out infinite;filter:drop-shadow(0 4px 6px rgba(0,0,0,.2));}
@keyframes wf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.wf-clues{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.wf-clue{background:rgba(255,255,255,.86);padding:8px 14px;border-radius:999px;font-weight:800;font-size:.95rem;color:var(--ink);box-shadow:0 4px 10px rgba(0,0,0,.12);}
.wf-reveal{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(255,255,255,.35);backdrop-filter:blur(2px);animation:wf-reveal .5s ease;}
.wf-reveal span{font-size:4rem;animation:wf-pop .6s ease;}
.wf-reveal b{font-size:1.3rem;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.4);}
@keyframes wf-reveal{0%{opacity:0}100%{opacity:1}}
@keyframes wf-pop{0%{transform:scale(0) rotate(-30deg)}70%{transform:scale(1.3) rotate(10deg)}100%{transform:scale(1)}}
.wf-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:min(420px,92%);}
.wf-opt{border:none;background:#fff;border-radius:18px;padding:14px 8px;box-shadow:var(--shadow);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform .16s ease,box-shadow .16s ease;}
.wf-opt:hover{transform:translateY(-4px) scale(1.03);box-shadow:0 12px 22px rgba(58,46,74,.2);}
.wf-opt:active{transform:scale(.96);}
.wf-opt__emoji{font-size:2.2rem;}
.wf-opt__name{font-size:.9rem;font-weight:800;color:var(--ink);}
.wf-opt--right{background:#d4f4dd;box-shadow:0 0 16px #6bcf7faa;animation:wf-right .5s ease;}
.wf-opt--wrong{background:#ffe0d9;animation:wf-shake .4s ease;}
@keyframes wf-right{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes wf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}}
`;
}

export function create(): WeatherForecastGame {
  return new WeatherForecastGame();
}
