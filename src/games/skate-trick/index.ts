/* 滑板动作序列 Skate Trick —— 先播放一段滑板动作序列（如 左转→跳→右转），
   然后把动作卡片打乱，孩子按顺序点卡片复现。独特点：每个动作有滑板emoji
   动画，播放时卡片逐张高亮，复现时按顺序点亮进度灯。难度=序列长度
   （3/4/5）。通关=做对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { createButton } from "../../ui/Button.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Trick {
  id: string;
  name: string;
  emoji: string;
}

const TRICKS: Trick[] = [
  { id: "left", name: "左转", emoji: "⬅️" },
  { id: "jump", name: "跳跃", emoji: "⬆️" },
  { id: "right", name: "右转", emoji: "➡️" },
  { id: "spin", name: "转圈", emoji: "🔄" },
  { id: "flip", name: "翻板", emoji: "🌀" },
];

export class SkateTrickGame extends BaseGame {
  constructor() {
    super("skate-trick");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private sequence: Trick[] = [];
  private echoIdx = 0;
  private demoing = false;
  private replaying = false;
  private cardEls: HTMLButtonElement[] = [];
  private hint!: HTMLDivElement;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  private seqLen(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  /** 可用动作数（easy 用 4 种，medium/hard 用全部 5 种）。 */
  private poolCount(): number {
    return this.difficulty === "easy" ? 4 : 5;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.demoing = false;
    this.replaying = false;
    this.echoIdx = 0;

    // 生成本轮序列（从动作池里随机选，允许相邻重复但首尾不同更有趣）
    const pool = TRICKS.slice(0, this.poolCount());
    const len = this.seqLen();
    this.sequence = Array.from({ length: len }, () => sample(pool));

    const wrap = document.createElement("div");
    wrap.className = "skt-wrap";

    const task = document.createElement("div");
    task.className = "skt-task";
    task.innerHTML = `先看示范，再按顺序点卡片（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 滑板小人
    const skater = document.createElement("div");
    skater.className = "skt-skater";
    skater.id = "skt-skater";
    skater.textContent = "🛹";
    wrap.appendChild(skater);

    this.hint = document.createElement("div");
    this.hint.className = "skt-hint";
    this.hint.textContent = "看好咯～";
    wrap.appendChild(this.hint);

    // 进度灯
    const lamps = document.createElement("div");
    lamps.className = "skt-lamps";
    for (let i = 0; i < len; i++) {
      const d = document.createElement("div");
      d.className = "skt-lamp";
      lamps.appendChild(d);
    }
    wrap.appendChild(lamps);

    // 打乱的动作卡片（保证序列里用到的动作都出现）
    const usedIds = new Set(this.sequence.map((t) => t.id));
    const used = TRICKS.filter((t) => usedIds.has(t.id));
    const cards = shuffle(used);
    const board = document.createElement("div");
    board.className = "skt-board";
    this.cardEls = [];
    cards.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skt-card";
      btn.innerHTML = `<span class="skt-card__emoji">${c.emoji}</span><span class="skt-card__name">${c.name}</span>`;
      btn.addEventListener("click", () => this.press(c, btn));
      board.appendChild(btn);
      this.cardEls.push(btn);
    });
    wrap.appendChild(board);

    const actions = document.createElement("div");
    actions.className = "skt-actions";
    actions.appendChild(
      createButton({
        text: "再看一次",
        icon: "👀",
        variant: "secondary",
        onClick: () => {
          if (!this.replaying) this.playDemo();
        },
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
    this.trackTimeout(() => this.playDemo(), 600);
  }

  private flash(trick: Trick): void {
    const el = this.cardEls.find(
      (b) => b.querySelector(".skt-card__name")?.textContent === trick.name,
    );
    if (!el) return;
    el.classList.remove("skt-card--lit");
    void el.offsetWidth;
    el.classList.add("skt-card--lit");
    this.trackTimeout(() => el.classList.remove("skt-card--lit"), 360, true);
    // 滑板小人做对应动作动画
    this.animateSkater(trick);
    sfxPop();
  }

  private animateSkater(trick: Trick): void {
    const s = this.root.querySelector("#skt-skater") as HTMLDivElement | null;
    if (!s) return;
    s.classList.remove(
      "skt-skater--left",
      "skt-skater--right",
      "skt-skater--jump",
      "skt-skater--spin",
      "skt-skater--flip",
    );
    void s.offsetWidth;
    s.classList.add(`skt-skater--${trick.id}`);
  }

  /** 播放示范：逐张高亮。 */
  private playDemo(): void {
    if (this.demoing) return;
    this.demoing = true;
    this.replaying = false;
    this.echoIdx = 0;
    this.setHint("看好滑板动作～ 🛹");
    this.root
      .querySelectorAll(".skt-lamp")
      .forEach((l) => l.classList.remove("skt-lamp--on"));
    const stepMs = 760;
    this.sequence.forEach((t, i) => {
      this.trackTimeout(() => this.flash(t), i * stepMs);
    });
    this.trackTimeout(
      () => {
        this.demoing = false;
        this.replaying = true;
        this.echoIdx = 0;
        this.setHint("轮到你啦！按顺序点～");
      },
      this.sequence.length * stepMs + 250,
    );
  }

  private press(trick: Trick, btn: HTMLButtonElement): void {
    if (this.demoing) return;
    if (!this.replaying) return;
    const expected = this.sequence[this.echoIdx];
    if (!expected) return;
    if (trick.id === expected.id) {
      btn.classList.add("skt-card--done");
      this.animateSkater(trick);
      sfxPop();
      const lamps = this.root.querySelectorAll(".skt-lamp");
      const lamp = lamps[this.echoIdx];
      if (lamp) lamp.classList.add("skt-lamp--on");
      this.echoIdx += 1;
      if (this.echoIdx >= this.sequence.length) {
        this.replaying = false;
        const r = btn.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top);
        this.resetWrongStreak();
        this.roundsDone += 1;
        this.setHint("太酷啦！动作全对～ 🌟");
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      }
    } else {
      this.replaying = false;
      const paused = this.onWrong();
      this.setHint("差一点点，再看一次～");
      this.trackTimeout(() => {
        if (paused) this.showRest();
        else this.playDemo();
      }, 700);
    }
  }

  private setHint(t: string): void {
    if (this.hint) this.hint.textContent = t;
  }

  private showRest(): void {
    this.replaying = false;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先看一遍滑板小人的动作，再照着点卡片～",
      primary: {
        text: "再看一次",
        icon: "🛹",
        onClick: () => {
          ov.destroy();
          this.trackTimeout(() => this.playDemo(), 300);
        },
      },
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
    if (document.getElementById("skt-style")) return;
    const st = document.createElement("style");
    st.id = "skt-style";
    st.textContent = SKT_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SKT_CSS(theme: string): string {
  return `
.skt-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.skt-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.skt-skater{font-size:3rem;line-height:1;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));}
.skt-skater--left{animation:skt-left .5s ease;}
@keyframes skt-left{0%{transform:translateX(0)}50%{transform:translateX(-26px) rotate(-8deg)}100%{transform:translateX(0)}}
.skt-skater--right{animation:skt-right .5s ease;}
@keyframes skt-right{0%{transform:translateX(0)}50%{transform:translateX(26px) rotate(8deg)}100%{transform:translateX(0)}}
.skt-skater--jump{animation:skt-jump .5s ease;}
@keyframes skt-jump{0%,100%{transform:translateY(0)}50%{transform:translateY(-30px) rotate(180deg)}}
.skt-skater--spin{animation:skt-spin .5s ease;}
@keyframes skt-spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.skt-skater--flip{animation:skt-flip .5s ease;}
@keyframes skt-flip{0%{transform:rotateX(0)}100%{transform:rotateX(360deg)}}
.skt-hint{font-size:1.2rem;font-weight:800;color:${theme};min-height:1.4em;text-align:center;}
.skt-lamps{display:flex;gap:10px;}
.skt-lamp{width:18px;height:18px;border-radius:50%;background:#e3e3e3;box-shadow:inset 0 2px 3px rgba(0,0,0,.15);transition:all .2s;}
.skt-lamp--on{background:${theme};transform:scale(1.15);box-shadow:0 0 10px ${theme};}
.skt-board{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:18px;background:rgba(255,255,255,.5);border-radius:22px;box-shadow:var(--shadow);}
.skt-card{width:92px;height:104px;border:none;border-radius:18px;cursor:pointer;background:linear-gradient(180deg,#fff,#f3e8ff);box-shadow:0 4px 0 #d8c4f0,var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;transition:transform .08s ease;}
.skt-card:active{transform:translateY(3px);box-shadow:0 1px 0 #d8c4f0,var(--shadow);}
.skt-card__emoji{font-size:2.2rem;}
.skt-card__name{font-size:1rem;font-weight:900;color:var(--ink);}
.skt-card--lit{animation:skt-glow .36s ease;background:linear-gradient(180deg,#fff,color-mix(in srgb,${theme} 30%,#fff));}
@keyframes skt-glow{0%{filter:brightness(1.5);transform:translateY(-4px) scale(1.04)}100%{filter:brightness(1);transform:none}}
.skt-card--done{background:linear-gradient(180deg,#e7ffe9,#c8f0cf);}
.skt-actions{display:flex;gap:12px;}
@media (max-width:380px){.skt-card{width:76px;height:90px;}.skt-card__emoji{font-size:1.8rem;}}
`;
}

export function create(): SkateTrickGame {
  return new SkateTrickGame();
}
