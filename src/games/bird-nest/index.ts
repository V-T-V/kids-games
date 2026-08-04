/* 鸟巢蛋 Bird Nest —— 一个鸟巢里有几颗蛋，快速展示后盖住，
   问"有几颗蛋"，孩子从选项选。
   独特点：瞬时计数记忆——展示时间短，需要快速数清并记住。
   玩法：先看清鸟巢里蛋的数量，盖住后选数字。
   视觉：鸟巢（CSS 编织纹理）+ 蛋 emoji。难度 = 蛋数(2-8)。
   通关 = 答对目标轮数。前缀 bns- 不冲突。
   保证有解：答案选项一定包含正确数字。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, randInt } from "../../lobby/util.ts";

type Phase = "show" | "hide" | "ask";

/** 生成 4 个数字选项（含正确答案）。 */
function genOptions(correct: number): number[] {
  const set = new Set<number>([correct]);
  let guard = 0;
  while (set.size < 4 && guard < 60) {
    guard++;
    const delta = randInt(1, 2) * (Math.random() < 0.5 ? -1 : 1);
    const v = correct + delta;
    if (v >= 2 && v <= 8) set.add(v);
  }
  let fill = 2;
  while (set.size < 4) {
    if (!set.has(fill)) set.add(fill);
    fill++;
    if (fill > 8) fill = 2;
  }
  return shuffle([...set]);
}

/** 在巢内生成 n 颗蛋的位置（不重叠）。返回百分比坐标。 */
function genEggPos(n: number): { x: number; y: number; rot: number }[] {
  const out: { x: number; y: number; rot: number }[] = [];
  let tries = 0;
  while (out.length < n && tries < 600) {
    tries++;
    const x = randInt(22, 78);
    const y = randInt(40, 78);
    if (out.every((p) => Math.hypot(p.x - x, p.y - y) >= 14)) {
      out.push({ x, y, rot: randInt(-25, 25) });
    }
  }
  // 兜底：若重叠排不下，放宽间距
  if (out.length < n) {
    while (out.length < n) {
      out.push({
        x: 22 + (out.length * 56) / Math.max(1, n - 1),
        y: 50 + (out.length % 2) * 20,
        rot: randInt(-25, 25),
      });
    }
  }
  return out;
}

export class BirdNestGame extends BaseGame {
  constructor() {
    super("bird-nest");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answer = 0;
  private phase: Phase = "show";
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM/trackTimeout 由基类清理 */
  }

  private eggRange(): [number, number] {
    return this.difficulty === "easy"
      ? [2, 4]
      : this.difficulty === "medium"
        ? [3, 6]
        : [5, 8];
  }
  private showMs(): number {
    return this.difficulty === "easy"
      ? 3200
      : this.difficulty === "medium"
        ? 2600
        : 2200;
  }

  private startRound(): void {
    this.phase = "show";
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const [lo, hi] = this.eggRange();
    this.answer = randInt(lo, hi);
    const eggs = genEggPos(this.answer);

    const wrap = document.createElement("div");
    wrap.className = "bns-wrap";

    const task = document.createElement("div");
    task.className = "bns-task";
    task.innerHTML = `数清鸟巢里有<b>几颗蛋</b>，盖住后选数字！<br><span class="bns-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "bns-hint";
    hint.id = "bns-hint";
    hint.textContent = "仔细看，准备数…";
    wrap.appendChild(hint);

    // 鸟巢舞台
    const stage = document.createElement("div");
    stage.className = "bns-stage";
    stage.id = "bns-stage";
    const nest = document.createElement("div");
    nest.className = "bns-nest";
    eggs.forEach((e) => {
      const egg = document.createElement("div");
      egg.className = "bns-egg";
      egg.textContent = "🥚";
      egg.style.left = `${e.x}%`;
      egg.style.top = `${e.y}%`;
      egg.style.transform = `translate(-50%,-50%) rotate(${e.rot}deg)`;
      nest.appendChild(egg);
    });
    // 鸟妈妈停在巢边
    const bird = document.createElement("div");
    bird.className = "bns-bird";
    bird.textContent = "🐦";
    nest.appendChild(bird);
    // 盖布
    const cover = document.createElement("div");
    cover.className = "bns-cover";
    cover.id = "bns-cover";
    cover.textContent = "🍂";
    nest.appendChild(cover);
    stage.appendChild(nest);
    wrap.appendChild(stage);

    // 选项区（默认隐藏）
    const optBox = document.createElement("div");
    optBox.className = "bns-opts";
    optBox.id = "bns-opts";
    optBox.style.display = "none";
    wrap.appendChild(optBox);

    this.root.appendChild(wrap);

    // 展示阶段倒计时
    this.trackTimeout(() => {
      if (this.phase !== "show") return;
      this.phase = "hide";
      const cv = this.root.querySelector("#bns-cover") as HTMLElement | null;
      if (cv) cv.classList.add("bns-cover--on");
      const ht = this.root.querySelector("#bns-hint");
      if (ht) ht.textContent = "盖住啦！刚才有几颗蛋？";
      this.trackTimeout(() => this.ask(), 500);
    }, this.showMs());
  }

  private ask(): void {
    this.phase = "ask";
    const optBox = this.root.querySelector<HTMLElement>("#bns-opts");
    if (!optBox) return;
    optBox.style.display = "";
    optBox.innerHTML = "";
    const opts = genOptions(this.answer);
    opts.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bns-opt";
      b.textContent = String(v);
      b.addEventListener("click", () => this.pick(v, b));
      optBox.appendChild(b);
    });
    const ht = this.root.querySelector("#bns-hint");
    if (ht) ht.textContent = "选一个数字～";
  }

  private pick(v: number, btn: HTMLButtonElement): void {
    if (this.locked || this.phase !== "ask") return;
    if (v === this.answer) {
      this.locked = true;
      btn.classList.add("bns-opt--right");
      // 揭开盖布
      const cv = this.root.querySelector("#bns-cover");
      cv?.classList.remove("bns-cover--on");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("bns-opt--wrong");
      const paused = this.onWrong();
      const ht = this.root.querySelector("#bns-hint");
      if (ht) ht.textContent = `再想想，正确答案是 ${this.answer}`;
      this.trackTimeout(() => {
        btn.classList.remove("bns-opt--wrong");
      }, 600);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🪺",
      variant: "rest",
      body: "看的时候用手指点一颗数一颗，记住总数再选。",
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
    if (document.getElementById("bns-style")) return;
    const st = document.createElement("style");
    st.id = "bns-style";
    st.textContent = BNS_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function BNS_CSS(theme: string): string {
  return `
.bns-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.bns-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.bns-task b{color:${theme};}
.bns-sub{font-size:.85rem;font-weight:700;color:#888;}
.bns-hint{font-size:1rem;font-weight:700;color:#5a3d00;text-align:center;min-height:1.5rem;}
.bns-stage{display:flex;align-items:center;justify-content:center;width:100%;max-width:420px;padding:24px;background:linear-gradient(180deg,#e9f5e9,#cdeecf);border-radius:24px;box-shadow:var(--shadow);}
.bns-nest{position:relative;width:300px;height:230px;}
.bns-nest::before{content:"";position:absolute;left:50%;top:55%;transform:translate(-50%,-50%);width:260px;height:150px;background:radial-gradient(ellipse at 50% 40%,#c89668,#8a5a2a 70%,#5a3a1a);border-radius:50%;box-shadow:inset 0 -10px 18px rgba(0,0,0,.3),inset 0 8px 12px rgba(255,255,255,.2);}
.bns-nest::after{content:"";position:absolute;left:50%;top:55%;transform:translate(-50%,-50%);width:200px;height:100px;background:repeating-linear-gradient(45deg,rgba(90,58,26,.4) 0 8px,rgba(200,150,104,.3) 8px 16px);border-radius:50%;mix-blend-mode:multiply;}
.bns-egg{position:absolute;font-size:2rem;line-height:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));z-index:2;animation:bns-in .4s ease;}
@keyframes bns-in{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}100%{opacity:1}}
.bns-bird{position:absolute;left:-10px;top:-8px;font-size:2.4rem;z-index:3;animation:bns-bob 2s ease-in-out infinite;}
@keyframes bns-bob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-6px) rotate(4deg)}}
.bns-cover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:6rem;background:linear-gradient(180deg,rgba(255,255,255,.85),${theme});border-radius:50%;opacity:0;pointer-events:none;transform:scale(.5);transition:opacity .35s,transform .35s;z-index:5;}
.bns-cover--on{opacity:1;transform:scale(1);}
.bns-opts{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-width:440px;}
.bns-opt{width:72px;height:72px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,#f0f0f0);font-size:1.8rem;font-weight:900;color:#333;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.1);transition:transform .12s;border:3px solid transparent;}
.bns-opt:active{transform:translateY(2px);}
.bns-opt--right{border-color:#6bcf7f;background:linear-gradient(180deg,#e0ffe4,#bff0c1);color:#2e7d32;animation:bns-pop .4s ease;}
.bns-opt--wrong{border-color:${theme};background:linear-gradient(180deg,#ffe0d8,#ffc4b8);animation:bns-shake .5s ease;}
@keyframes bns-pop{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes bns-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:380px){.bns-nest{width:260px;height:200px;}.bns-nest::before{width:220px;height:128px;}.bns-egg{font-size:1.7rem;}.bns-opt{width:60px;height:60px;font-size:1.5rem;}.bns-cover{font-size:5rem;}}
`;
}

export function create(): BirdNestGame {
  return new BirdNestGame();
}
