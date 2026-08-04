/* 刮刮乐 Scratch Card —— 卡片上覆盖灰色涂层，孩子用手指拖动刮开，
   揭开到一定面积后显示完整图案（动物/水果/数字），问"刮出来的是什么？"从选项选。
   独特点：触觉探索 + 悬念揭晓，刮的过程本身就是乐趣。
   视觉：Canvas destination-out 实现真实刮除效果。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Prize {
  emoji: string;
  name: string;
}

const POOL: Prize[] = [
  { emoji: "🐶", name: "小狗" },
  { emoji: "🐱", name: "小猫" },
  { emoji: "🐰", name: "兔子" },
  { emoji: "🍎", name: "苹果" },
  { emoji: "🍌", name: "香蕉" },
  { emoji: "🍓", name: "草莓" },
  { emoji: "⭐", name: "星星" },
  { emoji: "🌈", name: "彩虹" },
  { emoji: "🐠", name: "小鱼" },
  { emoji: "🦋", name: "蝴蝶" },
  { emoji: "🌸", name: "花朵" },
  { emoji: "🎈", name: "气球" },
];

export class ScratchCardGame extends BaseGame {
  constructor() {
    super("scratch-card");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private pickN = 2;
  private prize: Prize = POOL[0]!;
  private canvas: HTMLCanvasElement | null = null;
  private c2d: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private revealed = false;
  private scratching = false;
  private lastPos: { x: number; y: number } | null = null;
  /** 已刮除比例采样计数（避免每帧取样） */
  private sampleTick = 0;
  private unbinds: (() => void)[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.pickN = this.difficulty === "hard" ? 3 : 2;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private revealThreshold(): number {
    /* easy 揭少一点就能看见，hard 要多刮 */
    return this.difficulty === "easy" ? 0.45 : this.difficulty === "medium" ? 0.55 : 0.6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.revealed = false;
    this.scratching = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "scg-wrap";

    const task = document.createElement("div");
    task.className = "scg-task";
    task.innerHTML = `用手指拖动刮开卡片！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "scg-card";

    /* 底层图案 */
    this.prize = sample(POOL);
    const pic = document.createElement("div");
    pic.className = "scg-pic";
    pic.innerHTML = `<span class="scg-pic__emoji">${this.prize.emoji}</span>`;
    card.appendChild(pic);

    /* Canvas 涂层 */
    const cv = document.createElement("canvas");
    cv.className = "scg-cover";
    cv.width = 300;
    cv.height = 200;
    card.appendChild(cv);
    this.canvas = cv;
    const ctx = cv.getContext("2d");
    this.c2d = ctx;
    this.drawCoating(ctx!, cv.width, cv.height);

    /* 绑定拖动刮除 */
    this.bindScratch(cv);
    wrap.appendChild(card);

    /* 提示进度 */
    const hint = document.createElement("div");
    hint.className = "scg-hint";
    hint.id = "scg-hint";
    hint.textContent = "继续刮…";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  private drawCoating(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    /* 灰色金属涂层 + 斜纹 */
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#b8b8b8");
    grad.addColorStop(0.5, "#9a9a9a");
    grad.addColorStop(1, "#c8c8c8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    /* 斜纹纹理 */
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    for (let i = -h; i < w; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
    /* 提示文字 */
    ctx.fillStyle = "rgba(80,80,80,0.7)";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("刮开看看 ✋", w / 2, h / 2 + 8);
  }

  private bindScratch(cv: HTMLCanvasElement): void {
    const getPos = (e: PointerEvent): { x: number; y: number } => {
      const r = cv.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * cv.width,
        y: ((e.clientY - r.top) / r.height) * cv.height,
      };
    };
    const onDown = (e: PointerEvent): void => {
      if (this.revealed) return;
      e.preventDefault();
      this.isDrawing = true;
      this.scratching = true;
      this.lastPos = getPos(e);
      this.scratchAt(this.lastPos.x, this.lastPos.y);
    };
    const onMove = (e: PointerEvent): void => {
      if (!this.isDrawing || this.revealed) return;
      e.preventDefault();
      const pos = getPos(e);
      /* 用 lineTo 连续刮 */
      this.scratchLine(this.lastPos!.x, this.lastPos!.y, pos.x, pos.y);
      this.lastPos = pos;
      this.sampleTick += 1;
      if (this.sampleTick % 4 === 0) this.checkProgress();
    };
    const onUp = (): void => {
      this.isDrawing = false;
      if (!this.revealed) this.checkProgress();
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    this.unbinds.push(
      () => cv.removeEventListener("pointerdown", onDown),
      () => cv.removeEventListener("pointermove", onMove),
      () => window.removeEventListener("pointerup", onUp),
      () => cv.removeEventListener("pointercancel", onUp),
    );
  }

  private scratchAt(x: number, y: number): void {
    const ctx = this.c2d;
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    if (!this.scratching || Math.random() < 0.3) sfxPop();
  }

  private scratchLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    const ctx = this.c2d;
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 44;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private checkProgress(): void {
    const cv = this.canvas;
    const ctx = this.c2d;
    if (!cv || !ctx || this.revealed) return;
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let cleared = 0;
    const total = data.length / 4;
    /* 采样：每 8 像素取一个，提速 */
    for (let i = 3; i < data.length; i += 32) {
      if (data[i]! < 40) cleared += 1;
    }
    const ratio = cleared / (total / 8);
    const th = this.revealThreshold();
    const hint = this.root.querySelector("#scg-hint");
    if (ratio < th * 0.4) {
      if (hint) hint.textContent = "继续刮…";
    } else if (ratio < th) {
      if (hint) hint.textContent = "快看到啦！再多刮一点～";
    } else {
      this.revealFull();
    }
  }

  private revealFull(): void {
    if (this.revealed) return;
    this.revealed = true;
    /* 淡出涂层 */
    const cv = this.canvas;
    if (cv) {
      cv.style.transition = "opacity .4s ease";
      cv.style.opacity = "0";
      this.trackTimeout(() => cv.remove(), 450);
    }
    sfxPop();
    const hint = this.root.querySelector("#scg-hint");
    if (hint) hint.textContent = "🎉";
    this.trackTimeout(() => this.askName(), 500);
  }

  private askName(): void {
    const wrap = this.root.querySelector(".scg-wrap")!;
    const card = wrap.querySelector(".scg-card") as HTMLElement;
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const distractors = shuffle(POOL.filter((p) => p.name !== this.prize.name))
      .slice(0, this.pickN - 1)
      .map((p) => p.name);
    const choices = shuffle([this.prize.name, ...distractors]);

    const panel = document.createElement("div");
    panel.className = "scg-ask";
    const q = document.createElement("div");
    q.className = "scg-ask__q";
    q.textContent = "你刮出来的是什么？";
    panel.appendChild(q);

    const opts = document.createElement("div");
    opts.className = "scg-ask__opts";
    for (const c of choices) {
      const ob = document.createElement("button");
      ob.type = "button";
      ob.className = "scg-opt";
      ob.textContent = c;
      ob.addEventListener("click", () => this.answer(c, ob, cx, cy));
      opts.appendChild(ob);
    }
    panel.appendChild(opts);
    wrap.appendChild(panel);
  }

  private answer(
    choice: string,
    btn: HTMLButtonElement,
    cx: number,
    cy: number,
  ): void {
    const opts = btn.parentElement!;
    Array.from(opts.querySelectorAll(".scg-opt")).forEach((o) =>
      (o as HTMLButtonElement).setAttribute("disabled", "true"),
    );
    if (choice === this.prize.name) {
      btn.classList.add("scg-opt--ok");
      this.onCorrect(cx, cy);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      btn.classList.add("scg-opt--no");
      Array.from(opts.querySelectorAll(".scg-opt")).forEach((o) => {
        const el = o as HTMLButtonElement;
        if (el.textContent === this.prize.name)
          el.classList.add("scg-opt--ok");
      });
      const paused = this.onWrong();
      if (paused) {
        this.trackTimeout(() => this.showRest(), 900);
      } else {
        this.trackTimeout(() => this.startRound(), 1400);
      }
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想卡片上画的是什么～",
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
    if (document.getElementById("scg-style")) return;
    const st = document.createElement("style");
    st.id = "scg-style";
    st.textContent = SCG_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SCG_CSS(theme: string): string {
  return `
.scg-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.scg-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.scg-card{position:relative;width:min(300px,86%);height:200px;border-radius:20px;overflow:hidden;box-shadow:var(--shadow);background:#fff;border:4px solid ${theme};}
.scg-pic{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
.scg-pic__emoji{font-size:5.5rem;animation:scg-wiggle .8s ease;}
@keyframes scg-wiggle{0%{transform:scale(0) rotate(-20deg)}60%{transform:scale(1.3) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
.scg-cover{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none;}
.scg-cover:active{cursor:grabbing;}
.scg-hint{font-size:1rem;font-weight:700;color:#8a6a4a;min-height:1.4em;text-align:center;}
.scg-ask{display:flex;flex-direction:column;align-items:center;gap:12px;background:#fff;padding:18px 22px;border-radius:20px;box-shadow:var(--shadow);animation:scg-fadein .3s ease;}
@keyframes scg-fadein{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.scg-ask__q{font-size:1.15rem;font-weight:800;color:#333;}
.scg-ask__opts{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;}
.scg-opt{min-width:96px;min-height:52px;padding:10px 18px;font-size:1.15rem;font-weight:700;border-radius:14px;border:3px solid ${theme};background:#fff;color:#333;cursor:pointer;transition:transform .12s,background .2s;}
.scg-opt:hover{transform:translateY(-2px);}
.scg-opt:active{transform:scale(.95);}
.scg-opt--ok{background:${theme};color:#fff;border-color:${theme};}
.scg-opt--no{background:#eee;color:#999;border-color:#ccc;}
@media (max-width:380px){.scg-card{height:170px;}.scg-pic__emoji{font-size:4.4rem;}}
`;
}

export function create(): ScratchCardGame {
  return new ScratchCardGame();
}
