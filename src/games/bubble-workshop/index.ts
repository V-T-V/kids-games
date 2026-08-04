/* 泡泡工坊 Bubble Workshop —— 自由吹泡泡 + 戳泡泡的纯探索游戏。
   孩子点屏幕吹出彩色泡泡（随机大小颜色，CSS 动画飘动），点泡泡就"啪"破掉。
   没有对错，纯探索 + 视觉享受。点"我玩好啦"通关。
   独特点：创造与破坏的循环惊喜——每个泡泡都是独特的随机色彩。
   视觉：泡泡随机大小颜色，飘动轨迹 + 破裂粒子效果。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

const COLORS = [
  "#ff6b9d",
  "#4d96ff",
  "#6bcf7f",
  "#ffd93d",
  "#a55eea",
  "#ff9f43",
  "#22d3ee",
];

interface Bubble {
  el: HTMLDivElement;
  /** 飘动方向：左右摆动相位 */
  drift: number;
  /** 自动破除计时 id（由 trackTimeout 管理） */
  alive: boolean;
}

export class BubbleWorkshopGame extends BaseGame {
  constructor() {
    super("bubble-workshop");
  }

  private bubbles: Bubble[] = [];
  private poppedCount = 0;
  /** 目标戳破数（easy 较少即给星，hard 需多戳） */
  private goal = 0;
  private cleared = false;

  protected mount(): void {
    this.goal =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 10 : 15;
    this.injectStyle();
    this.render();
  }
  protected unmount(): void {
    /* DOM 清空 + trackTimeout 自动清理 */
  }

  private render(): void {
    this.root.innerHTML = "";
    this.bubbles = [];
    this.poppedCount = 0;

    const wrap = document.createElement("div");
    wrap.className = "bpw-wrap";

    const task = document.createElement("div");
    task.className = "bpw-task";
    task.innerHTML = `点空白处吹泡泡，点泡泡戳破它！<br>已戳破 <b id="bpw-count">0</b> 个`;
    wrap.appendChild(task);

    /* 泡泡舞台 */
    const stage = document.createElement("div");
    stage.className = "bpw-stage";
    stage.id = "bpw-stage";
    stage.addEventListener("pointerdown", (e) => {
      /* 点舞台空白处（非泡泡）吹一个新泡泡 */
      if ((e.target as HTMLElement).classList.contains("bpw-bubble")) return;
      this.blow(e.offsetX, e.offsetY, stage);
    });
    wrap.appendChild(stage);

    /* 完成按钮 */
    const done = document.createElement("button");
    done.type = "button";
    done.className = "bpw-done";
    done.textContent = "我玩好啦 🎉";
    done.addEventListener("click", () => this.finish());
    wrap.appendChild(done);

    this.root.appendChild(wrap);

    /* 初始送几个泡泡，营造氛围 */
    const w = stage.clientWidth || 320;
    const h = stage.clientHeight || 360;
    for (let i = 0; i < 4; i++) {
      this.blow(randInt(40, w - 40), randInt(60, h - 40), stage);
    }
  }

  private blow(x: number, y: number, stage: HTMLElement): void {
    if (this.cleared) return;
    const size = randInt(40, 84);
    const color = sample(COLORS);
    const el = document.createElement("div");
    el.className = "bpw-bubble";
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x - size / 2}px`;
    el.style.top = `${y - size / 2}px`;
    el.style.setProperty("--bpw-c", color);
    el.style.setProperty("--bpw-drift", `${randInt(-40, 40)}px`);
    el.style.setProperty("--bpw-dur", `${randInt(4, 8)}s`);

    const b: Bubble = { el, drift: randInt(-30, 30), alive: true };
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.pop(b, stage);
    });
    stage.appendChild(el);
    this.bubbles.push(b);
    sfxPop();

    /* 一段时间后自动飘走（避免无限堆积） */
    this.trackTimeout(() => {
      if (b.alive) {
        b.alive = false;
        el.classList.add("bpw-bubble--fade");
        this.trackTimeout(() => el.remove(), 1200);
        this.bubbles = this.bubbles.filter((x) => x !== b);
      }
    }, randInt(6000, 11000));
  }

  private pop(b: Bubble, stage: HTMLElement): void {
    if (!b.alive) return;
    b.alive = false;
    sfxPop();
    const r = b.el.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const cx = r.left - sr.left + r.width / 2;
    const cy = r.top - sr.top + r.height / 2;
    const color = b.el.style.getPropertyValue("--bpw-c") || "#4d96ff";

    /* 破裂粒子 */
    for (let i = 0; i < 6; i++) {
      const p = document.createElement("span");
      p.className = "bpw-shard";
      p.style.background = color;
      const ang = (Math.PI * 2 * i) / 6;
      p.style.setProperty("--bx", `${Math.cos(ang) * 28}px`);
      p.style.setProperty("--by", `${Math.sin(ang) * 28}px`);
      p.style.left = `${cx}px`;
      p.style.top = `${cy}px`;
      stage.appendChild(p);
      this.trackTimeout(() => p.remove(), 600);
    }

    b.el.classList.add("bpw-bubble--pop");
    this.trackTimeout(() => b.el.remove(), 400);
    this.bubbles = this.bubbles.filter((x) => x !== b);

    this.poppedCount += 1;
    const cnt = this.root.querySelector("#bpw-count");
    if (cnt) cnt.textContent = String(this.poppedCount);
    this.resetWrongStreak();
    /* 戳够数量给一次正反馈鼓励 */
    if (this.poppedCount === this.goal) {
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }
  }

  private finish(): void {
    if (this.cleared) return;
    /* 星级按戳破数量：达目标 3 星，达 60% 2 星，否则 1 星 */
    const rate = this.poppedCount / this.goal;
    let stars = 1;
    if (rate >= 1) stars = 3;
    else if (rate >= 0.6) stars = 2;
    this.cleared = true;
    this.finishClear(stars);
  }

  private injectStyle(): void {
    if (document.getElementById("bpw-style")) return;
    const st = document.createElement("style");
    st.id = "bpw-style";
    st.textContent = BPW_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function BPW_CSS(theme: string): string {
  return `
.bpw-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.bpw-task{font-size:1.05rem;font-weight:700;text-align:center;line-height:1.5;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.bpw-stage{position:relative;width:min(460px,100%);height:min(56vh,420px);background:linear-gradient(180deg,#e0f7ff,#b3e5fc 60%,#81d4fa);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;cursor:crosshair;touch-action:manipulation;}
.bpw-bubble{position:absolute;border-radius:50%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.9),rgba(255,255,255,.2) 40%,var(--bpw-c,#4d96ff) 100%);box-shadow:inset 0 -6px 10px rgba(0,0,0,.1),inset 0 4px 8px rgba(255,255,255,.4);cursor:pointer;transition:transform .12s;animation:bpw-float var(--bpw-dur,6s) ease-in-out infinite alternate;will-change:transform,top;}
.bpw-bubble:hover{transform:scale(1.06);}
.bpw-bubble:active{transform:scale(.9);}
@keyframes bpw-float{0%{transform:translateY(0) translateX(0)}50%{transform:translateY(-18px) translateX(var(--bpw-drift,0))}100%{transform:translateY(-36px) translateX(0)}}
.bpw-bubble--pop{animation:bpw-pop .35s ease forwards!important;pointer-events:none;}
@keyframes bpw-pop{0%{transform:scale(1.15);opacity:1}50%{transform:scale(1.4);opacity:.6}100%{transform:scale(0);opacity:0}}
.bpw-bubble--fade{opacity:0;transition:opacity 1s;}
.bpw-shard{position:absolute;width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;animation:bpw-shard .55s ease-out forwards;}
@keyframes bpw-shard{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + var(--bx)),calc(-50% + var(--by))) scale(0);opacity:0}}
.bpw-done{margin-top:4px;padding:14px 32px;font-size:1.2rem;font-weight:800;color:#fff;background:${theme};border:none;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;transition:transform .15s;}
.bpw-done:hover{transform:translateY(-2px);}
.bpw-done:active{transform:scale(.95);}
`;
}

export function create(): BubbleWorkshopGame {
  return new BubbleWorkshopGame();
}
