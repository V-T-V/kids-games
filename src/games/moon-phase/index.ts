/* 月亮变化 Moon Phase —— 显示一个月相，孩子从选项选对应名称。
   独特点：天文认知。用 CSS（box-shadow / border-radius 伪元素遮罩）画出 8 种月相的明暗形状，
   区别于 clock/calendar 的机械时间概念。
   视觉：一个深色夜空圆盘里的"月亮"，下方 4 个名称按钮。难度 = 月相数。
   通关 = 答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 8 种月相。phase 字段对应 CSS 类，决定明暗形状。 */
const PHASES = [
  { id: "new", name: "新月", emoji: "🌑" },
  { id: "wax-cres", name: "蛾眉月", emoji: "🌒" },
  { id: "first-q", name: "上弦月", emoji: "🌓" },
  { id: "wax-gib", name: "盈凸月", emoji: "🌔" },
  { id: "full", name: "满月", emoji: "🌕" },
  { id: "wan-gib", name: "亏凸月", emoji: "🌖" },
  { id: "last-q", name: "下弦月", emoji: "🌗" },
  { id: "wan-cres", name: "残月", emoji: "🌘" },
] as const;

export class MoonPhaseGame extends BaseGame {
  constructor() {
    super("moon-phase");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 根据难度选候选月相池。easy：易辨识的 4 种；hard：全部 8 种。 */
  private pool(): readonly (typeof PHASES)[number][] {
    if (this.difficulty === "easy") {
      return PHASES.filter((p) =>
        ["new", "first-q", "full", "last-q"].includes(p.id),
      );
    }
    if (this.difficulty === "medium") {
      return PHASES.filter((p) =>
        ["new", "wax-cres", "first-q", "wax-gib", "full", "last-q"].includes(
          p.id,
        ),
      );
    }
    return PHASES;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    const pool = this.pool();
    const answer = shuffle(pool)[0]!;
    // 选项：答案 + 3 个干扰
    const distract = shuffle(pool.filter((p) => p.id !== answer.id)).slice(
      0,
      3,
    );
    const choices = shuffle([answer, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "mph-wrap";
    const task = document.createElement("div");
    task.className = "mph-task";
    task.textContent = `这是哪种月亮？选它的名字～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 夜空 + 月亮
    const sky = document.createElement("div");
    sky.className = "mph-sky";
    // 星星点缀
    for (let i = 0; i < 16; i++) {
      const star = document.createElement("span");
      star.className = "mph-star";
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDelay = `${Math.random() * 2}s`;
      sky.appendChild(star);
    }
    const moon = document.createElement("div");
    moon.className = `mph-moon mph-moon--${answer.id}`;
    moon.id = "mph-moon";
    sky.appendChild(moon);
    wrap.appendChild(sky);

    // 选项
    const opts = document.createElement("div");
    opts.className = "mph-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mph-opt";
      b.innerHTML = `<span class="mph-opt__emoji">${c.emoji}</span><span class="mph-opt__name">${c.name}</span>`;
      b.addEventListener("click", () => this.choose(c.id, answer.id, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(id: string, answerId: string, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (id === answerId) {
      this.answered = true;
      sfxPop();
      const moon = this.root.querySelector("#mph-moon");
      moon?.classList.add("mph-moon--win");
      btn.classList.add("mph-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1200);
    } else {
      btn.classList.add("mph-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("mph-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看月亮亮的部分朝哪边，圆的是满月，看不见的是新月～",
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
    if (document.getElementById("mph-style")) return;
    const st = document.createElement("style");
    st.id = "mph-style";
    st.textContent = MP_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function MP_CSS(theme: string): string {
  return `
.mph-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(480px,100%);}
.mph-task{font-size:1.15rem;font-weight:800;text-align:center;}
.mph-sky{position:relative;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#1a2452,#070a1f);box-shadow:0 0 40px ${theme}66,inset 0 0 30px #00000088;overflow:hidden;}
.mph-star{position:absolute;width:3px;height:3px;background:#fff;border-radius:50%;box-shadow:0 0 4px #fff;animation:mph-tw 2.4s ease infinite alternate;}
@keyframes mph-tw{0%{opacity:.2}100%{opacity:1}}
.mph-moon{position:absolute;left:50%;top:50%;width:120px;height:120px;transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 0 30px #fff8,0 0 60px #fff3;}
/* 月相用伪元素遮罩实现明暗。月亮本体=暗面，亮面用伪元素覆盖。 */
.mph-moon{background:#1a1a2e;}
.mph-moon::before{content:'';position:absolute;inset:0;border-radius:50%;background:#fdf6c2;}
/* 新月：几乎全暗 */
.mph-moon--new::before{background:#1a1a2e;}
/* 满月：全亮 */
.mph-moon--full::before{background:radial-gradient(circle at 35% 35%,#fffef0,#f5e9a8);}
/* 上弦月：右半亮——用左半圆遮罩盖住暗 */
.mph-moon--first-q::before{background:#1a1a2e;}
.mph-moon--first-q::after{content:'';position:absolute;inset:0;border-radius:50%;background:#fdf6c2;clip-path:polygon(50% 0,100% 0,100% 100%,50% 100%);}
/* 下弦月：左半亮 */
.mph-moon--last-q::before{background:#1a1a2e;}
.mph-moon--last-q::after{content:'';position:absolute;inset:0;border-radius:50%;background:#fdf6c2;clip-path:polygon(0 0,50% 0,50% 100%,0 100%);}
/* 蛾眉月：右侧细弯亮——亮区为右半圆减去一个右移的圆 */
.mph-moon--wax-cres::before{background:#1a1a2e;}
.mph-moon--wax-cres::after{content:'';position:absolute;inset:0;border-radius:50%;background:#fdf6c2;clip-path:polygon(50% 0,100% 0,100% 100%,50% 100%);}
.mph-moon--wax-cres{box-shadow:0 0 30px #fff8 inset;}
.mph-moon--wax-cres{overflow:hidden;}
.mph-moon--wax-cres::after{-webkit-mask:radial-gradient(circle at 78% 50%,transparent 60px,#000 60px);mask:radial-gradient(circle at 78% 50%,transparent 60px,#000 60px);}
/* 残月：左侧细弯亮 */
.mph-moon--wan-cres::before{background:#1a1a2e;}
.mph-moon--wan-cres::after{content:'';position:absolute;inset:0;border-radius:50%;background:#fdf6c2;clip-path:polygon(0 0,50% 0,50% 100%,0 100%);-webkit-mask:radial-gradient(circle at 22% 50%,transparent 60px,#000 60px);mask:radial-gradient(circle at 22% 50%,transparent 60px,#000 60px);}
/* 盈凸月：大部分亮，左侧暗弧 */
.mph-moon--wax-gib::before{background:radial-gradient(circle at 35% 35%,#fffef0,#f5e9a8);}
.mph-moon--wax-gib::after{content:'';position:absolute;inset:0;border-radius:50%;background:#1a1a2e;clip-path:polygon(0 0,38% 0,38% 100%,0 100%);-webkit-mask:radial-gradient(circle at 30% 50%,transparent 56px,#000 56px);mask:radial-gradient(circle at 30% 50%,transparent 56px,#000 56px);}
/* 亏凸月：大部分亮，右侧暗弧 */
.mph-moon--wan-gib::before{background:radial-gradient(circle at 35% 35%,#fffef0,#f5e9a8);}
.mph-moon--wan-gib::after{content:'';position:absolute;inset:0;border-radius:50%;background:#1a1a2e;clip-path:polygon(62% 0,100% 0,100% 100%,62% 100%);-webkit-mask:radial-gradient(circle at 70% 50%,transparent 56px,#000 56px);mask:radial-gradient(circle at 70% 50%,transparent 56px,#000 56px);}
.mph-moon--win{animation:mph-glow .6s ease;}
@keyframes mph-glow{0%{transform:translate(-50%,-50%) scale(.85)}60%{transform:translate(-50%,-50%) scale(1.1)}100%{transform:translate(-50%,-50%) scale(1)}}
.mph-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:380px;}
.mph-opt{display:flex;align-items:center;gap:8px;min-height:54px;padding:8px 14px;border-radius:14px;background:#fff;font-size:1.05rem;font-weight:700;box-shadow:var(--shadow);}
.mph-opt:active{transform:scale(.96);}
.mph-opt__emoji{font-size:1.5rem;}
.mph-opt--done{background:#d4f4dd;animation:mph-pop .4s ease;}
.mph-opt--wrong{animation:mph-shake .4s ease;}
@keyframes mph-pop{0%{transform:scale(.7)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes mph-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.mph-sky{width:220px;height:220px;}.mph-moon{width:100px;height:100px;}}
`;
}

export function create(): MoonPhaseGame {
  return new MoonPhaseGame();
}
