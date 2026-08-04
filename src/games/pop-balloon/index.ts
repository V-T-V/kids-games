/* 戳气球 Pop Balloon —— 题目说"戳红色的"或"戳最大的"，孩子戳对的。
   独特点：CSS 圆形气球带高光和绳子，缓慢上飘动画，戳爆时碎裂粒子。
   巧思：每关随机一个规则（颜色/最大/最小/指定形状贴纸），难度=气球数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface BalloonColor {
  id: string;
  name: string; // "红色"
  css: string; // 渐变色
}

const COLORS: BalloonColor[] = [
  { id: "red", name: "红色", css: "#ff6b6b" },
  { id: "blue", name: "蓝色", css: "#4d96ff" },
  { id: "yellow", name: "黄色", css: "#ffd93d" },
  { id: "green", name: "绿色", css: "#6bcf7f" },
  { id: "purple", name: "紫色", css: "#a55eea" },
  { id: "orange", name: "橙色", css: "#ff9f43" },
];

interface Balloon {
  color: BalloonColor;
  size: number; // 0=小, 1=中, 2=大
  sticker: string;
  correct: boolean;
  el: HTMLButtonElement;
}

const STICKERS = ["⭐", "💛", "🌟", "✨"];

export class PopBalloonGame extends BaseGame {
  constructor() {
    super("pop-balloon");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private balloons: Balloon[] = [];
  private taskEl: HTMLDivElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private balloonCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.balloonCount();
    const palette = shuffle(COLORS).slice(0, Math.min(4, COLORS.length));

    // 随机规则
    const ruleType = sample(["color", "biggest", "smallest"] as const);
    // 决定正确气球
    let ruleText = "";
    let targetColor: BalloonColor | null = null;

    // 生成气球
    const raw: { color: BalloonColor; size: number; sticker: string }[] = [];
    // 颜色规则下，先定 targetColor 并保证至少有 2 个该色气球，避免无解
    if (ruleType === "color") {
      targetColor = sample(palette);
      ruleText = `把 ${targetColor.name} 的气球全戳爆！`;
      // 先放 2 个目标色气球
      raw.push({
        color: targetColor,
        size: Math.floor(Math.random() * 3),
        sticker: sample(STICKERS),
      });
      raw.push({
        color: targetColor,
        size: Math.floor(Math.random() * 3),
        sticker: sample(STICKERS),
      });
      for (let i = 2; i < n; i++) {
        raw.push({
          color: sample(palette),
          size: Math.floor(Math.random() * 3),
          sticker: sample(STICKERS),
        });
      }
    } else {
      if (ruleType === "biggest") ruleText = "戳爆最大的那个气球！";
      else ruleText = "戳爆最小的那个气球！";
      for (let i = 0; i < n; i++) {
        raw.push({
          color: sample(palette),
          size: Math.floor(Math.random() * 3),
          sticker: sample(STICKERS),
        });
      }
    }
    // 打乱气球顺序
    raw.sort(() => Math.random() - 0.5);

    // 计算正确性
    const maxSize = Math.max(...raw.map((r) => r.size));
    const minSize = Math.min(...raw.map((r) => r.size));

    const wrap = document.createElement("div");
    wrap.className = "pbl-wrap";
    const task = document.createElement("div");
    task.className = "pbl-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · <b>${ruleText}</b>`;
    wrap.appendChild(task);
    this.taskEl = task;

    const field = document.createElement("div");
    field.className = "pbl-field";
    this.balloons = [];
    const positions = shuffle(Array.from({ length: n }, (_, i) => i));
    raw.forEach((r, i) => {
      let correct = false;
      if (ruleType === "color" && targetColor) {
        correct = r.color.id === targetColor.id;
      } else if (ruleType === "biggest") {
        correct = r.size === maxSize;
      } else {
        correct = r.size === minSize;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pbl-balloon";
      b.dataset.size = String(r.size);
      b.style.setProperty("--pbl-color", r.color.css);
      b.style.setProperty("--pbl-size", `${1.6 + r.size * 0.8}rem`);
      b.style.setProperty("--pbl-delay", `${(positions[i] ?? 0) * 0.4}s`);
      b.style.setProperty(
        "--pbl-drift",
        `${(Math.random() * 24 - 12).toFixed(0)}px`,
      );
      b.innerHTML = `
        <span class="pbl-balloon__body">${r.sticker}</span>
        <span class="pbl-balloon__knot"></span>
        <span class="pbl-balloon__string"></span>
      `;
      b.addEventListener("click", () => this.pop(b));
      field.appendChild(b);
      this.balloons.push({
        color: r.color,
        size: r.size,
        sticker: r.sticker,
        correct,
        el: b,
      });
    });
    wrap.appendChild(field);
    this.root.appendChild(wrap);
  }

  private pop(b: HTMLButtonElement): void {
    if (b.classList.contains("pbl-balloon--popped")) return;
    const balloon = this.balloons.find((x) => x.el === b);
    if (!balloon) return;
    b.classList.add("pbl-balloon--popped");
    b.disabled = true;
    sfxPop();
    const r = b.getBoundingClientRect();
    if (balloon.correct) {
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      const remainCorrect = this.balloons.filter(
        (x) => x.correct && !x.el.classList.contains("pbl-balloon--popped"),
      );
      if (remainCorrect.length === 0) {
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 700);
      }
    } else {
      b.classList.add("pbl-balloon--shake");
      this.trackTimeout(() => {
        b.classList.remove("pbl-balloon--popped");
        b.classList.remove("pbl-balloon--shake");
        b.disabled = false;
      }, 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看清楚题目要戳哪一个哦～",
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
    if (document.getElementById("pbl-style")) return;
    const st = document.createElement("style");
    st.id = "pbl-style";
    st.textContent = PB_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function PB_CSS(_theme: string): string {
  return `
.pbl-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(520px,100%);}
.pbl-task{font-size:1.12rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.pbl-field{position:relative;display:flex;flex-wrap:wrap;gap:18px 22px;justify-content:center;align-items:flex-end;padding:24px 12px;min-height:300px;background:linear-gradient(#e8f4ff,#d4ecff);border-radius:24px;box-shadow:var(--shadow);width:100%;max-width:480px;}
.pbl-balloon{position:relative;width:78px;height:96px;border:none;background:transparent;cursor:pointer;touch-action:manipulation;display:flex;flex-direction:column;align-items:center;animation:pbl-float 3s ease-in-out infinite;animation-delay:var(--pbl-delay,0s);}
@keyframes pbl-float{0%,100%{transform:translateY(0) translateX(0)}50%{transform:translateY(-14px) translateX(var(--pbl-drift,0))}}
.pbl-balloon__body{width:78px;height:92px;border-radius:50% 50% 50% 50% / 45% 45% 55% 55%;background:radial-gradient(circle at 32% 28%,#fff9,var(--pbl-color));box-shadow:inset -6px -8px 12px rgba(0,0,0,.18),0 4px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:1.5rem;position:relative;z-index:2;}
.pbl-balloon__body::after{content:"";position:absolute;top:14px;left:18px;width:14px;height:20px;background:rgba(255,255,255,.55);border-radius:50%;transform:rotate(-20deg);}
.pbl-balloon__knot{width:10px;height:8px;background:var(--pbl-color);clip-path:polygon(20% 0,80% 0,100% 100%,0 100%);margin-top:-2px;z-index:1;}
.pbl-balloon__string{width:2px;height:40px;background:linear-gradient(#888,transparent);margin-top:-1px;transform-origin:top;animation:pbl-sway 3s ease-in-out infinite;}
@keyframes pbl-sway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
.pbl-balloon:active .pbl-balloon__body{transform:scale(.9);}
.pbl-balloon--popped{animation:none;}
.pbl-balloon--popped .pbl-balloon__body{animation:pbl-burst .35s ease forwards;}
@keyframes pbl-burst{0%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.6}100%{transform:scale(0);opacity:0}}
.pbl-balloon--popped .pbl-balloon__knot,.pbl-balloon--popped .pbl-balloon__string{opacity:0;transition:opacity .2s;}
.pbl-balloon--shake{animation:pbl-shake .4s ease!important;}
@keyframes pbl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px) rotate(-5deg)}75%{transform:translateX(8px) rotate(5deg)}}
@media (max-width:380px){.pbl-balloon,.pbl-balloon__body{width:64px;height:78px;}.pbl-field{min-height:260px;gap:12px 16px;}}
`;
}

export function create(): PopBalloonGame {
  return new PopBalloonGame();
}
