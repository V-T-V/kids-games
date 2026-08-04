/* 出门穿衣 Weather Dress —— 看天气选「全套」该穿的衣帽（帽子+外套+…），
   多选题。独特点：天气场景 + 多选确认，理解「按情境选齐物品」。
   视觉：天气场景 + 衣帽选项。难度=需选件数。通关=选对目标轮数。
   巧思：每件衣物标记「正确/错误」，需恰好选齐正确件（不漏不多选）才算对。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Clothing {
  emoji: string;
  name: string;
}
interface Weather {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  scene: string;
  /** 该天气正确的衣物 id 列表 */
  correct: string[];
}
interface ClothDef extends Clothing {
  id: string;
}

const CLOTHES: ClothDef[] = [
  { id: "hat", emoji: "🧢", name: "太阳帽" },
  { id: "beanie", emoji: "🧶", name: "毛线帽" },
  { id: "coat", emoji: "🧥", name: "外套" },
  { id: "tshirt", emoji: "👕", name: "短袖" },
  { id: "scarf", emoji: "🧣", name: "围巾" },
  { id: "gloves", emoji: "🧤", name: "手套" },
  { id: "raincoat", emoji: "🧥", name: "雨衣" },
  { id: "umbrella", emoji: "☂️", name: "雨伞" },
  { id: "boots", emoji: "🥾", name: "雨靴" },
  { id: "sunglasses", emoji: "🕶️", name: "墨镜" },
];

const WEATHERS: Weather[] = [
  {
    id: "snowy",
    emoji: "❄️",
    name: "下雪天",
    desc: "外面下大雪，好冷好冷！",
    scene: "linear-gradient(180deg,#cfe8ff,#8fb8e0)",
    correct: ["beanie", "coat", "scarf", "gloves"],
  },
  {
    id: "sunny",
    emoji: "☀️",
    name: "大晴天",
    desc: "太阳好大，好热呀！",
    scene: "linear-gradient(180deg,#ffe9a8,#ffb86b)",
    correct: ["hat", "tshirt", "sunglasses"],
  },
  {
    id: "rainy",
    emoji: "🌧️",
    name: "下雨天",
    desc: "哗啦啦下大雨啦！",
    scene: "linear-gradient(180deg,#9fb4d4,#5f7aa0)",
    correct: ["raincoat", "umbrella", "boots"],
  },
  {
    id: "cold",
    emoji: "🌬️",
    name: "刮风天",
    desc: "呼呼刮冷风，有点冷！",
    scene: "linear-gradient(180deg,#dfe6ee,#a9b6c6)",
    correct: ["coat", "scarf", "beanie"],
  },
];

const ENCOURAGE = [
  "穿得真整齐！",
  "想想还缺什么～",
  "真会照顾自己！",
  "差一点点！",
];

export class WeatherDressGame extends BaseGame {
  constructor() {
    super("weather-dress");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private selected = new Set<string>();
  private correctSet = new Set<string>();
  private locked = false;
  private doneBtn: HTMLButtonElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 不同难度选取「正确件数适中的天气」与干扰件数 */
  private distractorCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.selected.clear();
    this.correctSet.clear();
    this.locked = false;

    const weather = sample(WEATHERS);
    this.correctSet = new Set(weather.correct);

    /* 选项 = 正确衣物 + 干扰衣物（干扰数量按难度） */
    const correctClothes = weather.correct
      .map((id) => CLOTHES.find((c) => c.id === id)!)
      .filter(Boolean);
    const distractors = shuffle(
      CLOTHES.filter((c) => !weather.correct.includes(c.id)),
    ).slice(0, this.distractorCount());
    const opts = shuffle([...correctClothes, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "wd-wrap";

    const task = document.createElement("div");
    task.className = "wd-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · ${weather.desc} 选出该穿的<b>全部</b>衣物`;
    wrap.appendChild(task);

    /* 天气场景 */
    const scene = document.createElement("div");
    scene.className = "wd-scene";
    scene.style.background = weather.scene;
    scene.innerHTML = `
      <div class="wd-weather-emoji">${weather.emoji}</div>
      <div class="wd-weather-name">${weather.name}</div>
      <div class="wd-hint">该穿什么？点一点下面的衣服吧</div>
    `;
    wrap.appendChild(scene);

    /* 衣物选项 */
    const closet = document.createElement("div");
    closet.className = "wd-closet";
    opts.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wd-cloth";
      b.dataset.id = c.id;
      b.innerHTML = `<span class="wd-cloth-emoji">${c.emoji}</span><span class="wd-cloth-name">${c.name}</span>`;
      b.setAttribute("aria-label", c.name);
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => this.toggle(b, c.id));
      closet.appendChild(b);
    });
    wrap.appendChild(closet);

    /* 完成按钮 */
    const done = document.createElement("button");
    done.type = "button";
    done.className = "wd-done";
    done.textContent = "穿好啦！";
    done.addEventListener("click", () => this.check());
    wrap.appendChild(done);
    this.doneBtn = done;
    this.updateDone();

    this.root.appendChild(wrap);
  }

  private toggle(btn: HTMLButtonElement, id: string): void {
    if (this.locked) return;
    if (this.selected.has(id)) {
      this.selected.delete(id);
      btn.classList.remove("wd-cloth--on");
      btn.setAttribute("aria-pressed", "false");
    } else {
      this.selected.add(id);
      btn.classList.add("wd-cloth--on");
      btn.setAttribute("aria-pressed", "true");
      sfxPop();
    }
    this.updateDone();
  }

  private updateDone(): void {
    if (!this.doneBtn) return;
    const ok = this.selected.size === this.correctSet.size;
    this.doneBtn.classList.toggle("wd-done--ready", ok);
  }

  private check(): void {
    if (this.locked) return;
    /* 判定：选中集合 == 正确集合 */
    const same =
      this.selected.size === this.correctSet.size &&
      [...this.correctSet].every((id) => this.selected.has(id));
    if (same) {
      this.locked = true;
      sfxPop();
      const r = this.doneBtn!.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      /* 高亮所有正确衣物 */
      this.root
        .querySelectorAll(".wd-cloth--on")
        .forEach((el) => el.classList.add("wd-cloth--right"));
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 950);
    } else {
      /* 标记对错：选中的分别判定 */
      this.root
        .querySelectorAll<HTMLButtonElement>(".wd-cloth")
        .forEach((b) => {
          const id = b.dataset.id!;
          const picked = this.selected.has(id);
          const should = this.correctSet.has(id);
          if (picked && !should) b.classList.add("wd-cloth--wrong");
          if (!picked && should) b.classList.add("wd-cloth--miss");
        });
      const paused = this.onWrong();
      this.trackTimeout(() => {
        this.root
          .querySelectorAll(".wd-cloth--wrong,.wd-cloth--miss")
          .forEach((el) =>
            el.classList.remove("wd-cloth--wrong", "wd-cloth--miss"),
          );
      }, 700);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧥",
      variant: "rest",
      body: `要选齐该穿的，不能多也不能少哦。${sample(ENCOURAGE)}`,
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
    if (document.getElementById("wd-style")) return;
    const st = document.createElement("style");
    st.id = "wd-style";
    st.textContent = WD_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function WD_CSS(theme: string): string {
  return `
.wd-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.wd-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.wd-scene{width:min(440px,92vw);padding:26px 18px;border-radius:24px;text-align:center;box-shadow:var(--shadow);position:relative;overflow:hidden;}
.wd-weather-emoji{font-size:4.6rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.2));animation:wd-float 3s ease-in-out infinite;}
@keyframes wd-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.wd-weather-name{font-size:1.5rem;font-weight:900;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.35);margin-top:6px;}
.wd-hint{font-size:.95rem;color:rgba(255,255,255,.92);margin-top:4px;text-shadow:0 1px 3px rgba(0,0,0,.3);}
.wd-closet{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:460px;}
.wd-cloth{width:88px;height:96px;border:none;border-radius:18px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.1),0 5px 8px rgba(0,0,0,.1);transition:transform .12s,box-shadow .12s;border:3px solid transparent;}
.wd-cloth:active{transform:translateY(2px);}
.wd-cloth-emoji{font-size:2.4rem;line-height:1;}
.wd-cloth-name{font-size:.78rem;font-weight:700;color:#555;}
.wd-cloth--on{border-color:${theme};background:linear-gradient(180deg,#fff,${theme}33);transform:translateY(-2px);box-shadow:0 5px 0 rgba(0,0,0,.1),0 8px 14px rgba(0,0,0,.16);}
.wd-cloth--right{border-color:#6bcf7f;background:linear-gradient(180deg,#e0ffe4,#bff0c1);animation:wd-pop .4s ease;}
.wd-cloth--wrong{border-color:#ff6348;background:linear-gradient(180deg,#ffe0d8,#ffc4b8);animation:wd-shake .5s ease;}
.wd-cloth--miss{border-color:#ffd93d;background:linear-gradient(180deg,#fff7cf,#ffe88a);animation:wd-pulse .6s ease;}
@keyframes wd-pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes wd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@keyframes wd-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.wd-done{margin-top:4px;border:none;border-radius:999px;padding:14px 32px;font-size:1.2rem;font-weight:900;color:#fff;background:linear-gradient(180deg,#9aa6b5,#7a8696);cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.18);transition:all .15s;}
.wd-done--ready{background:linear-gradient(180deg,${theme},#0a9aa0);box-shadow:0 4px 0 #0a7a80,0 6px 12px rgba(0,0,0,.2);animation:wd-ready 1.2s ease-in-out infinite;}
@keyframes wd-ready{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.wd-done:active{transform:translateY(2px);}
@media (max-width:380px){.wd-cloth{width:74px;height:84px;}.wd-cloth-emoji{font-size:2rem;}.wd-weather-emoji{font-size:3.6rem;}}
`;
}

export function create(): WeatherDressGame {
  return new WeatherDressGame();
}
