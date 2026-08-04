/* 叠甜筒 Ice Cream Stack —— 底部一个甜筒，上方左右移动的冰淇淋球，点按钮放下。
   独特点：类似 block-tower，但叠的是圆形球（甜点主题），偏移会让整串歪斜，错太多会倒。
   视觉：甜筒 + 彩色冰淇淋球，错位球叠加产生歪斜。难度=目标高度。通关=叠到目标。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { createRafLoop } from "../../core/loop.ts";
import { randInt, sample, getCssVar } from "../../lobby/util.ts";

interface Scoop {
  x: number; // 相对中心偏移 px
  color: string;
  el: HTMLElement;
}

const SCOOP_COLORS = [
  "#ff6b9d",
  "#ffd93d",
  "#4d96ff",
  "#6bcf7f",
  "#a55eea",
  "#ff9f43",
  "#ff8a80",
];

export class IceCreamStackGame extends BaseGame {
  constructor() {
    super("ice-cream-stack");
  }

  private scoops: Scoop[] = [];
  private movingX = 0;
  private dir = 1;
  private speed = 0;
  private stop?: () => void;
  private current!: HTMLElement;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private fieldW = 300;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
  }

  private targetHeight(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.scoops = [];
    this.over = false;
    this.speed =
      this.difficulty === "easy"
        ? 1.8
        : this.difficulty === "medium"
          ? 2.6
          : 3.4;
    this.movingX = 0;
    this.dir = 1;
    this.root.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "is-wrap";

    const task = document.createElement("div");
    task.className = "is-task";
    task.innerHTML = `看准时机点 <b>放下</b>，把冰淇淋球叠在甜筒正中！<br><span id="is-h">高度：0 / ${this.targetHeight()}</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "is-stage";
    stage.id = "is-stage";

    // 甜筒（固定底部居中）
    const cone = document.createElement("div");
    cone.className = "is-cone";
    cone.textContent = "🔻";
    stage.appendChild(cone);

    wrap.appendChild(stage);

    const dropBtn = document.createElement("button");
    dropBtn.type = "button";
    dropBtn.className = "is-drop";
    dropBtn.textContent = "🍦 放下冰淇淋";
    dropBtn.addEventListener("click", () => this.drop());
    wrap.appendChild(dropBtn);

    this.root.appendChild(wrap);

    this.fieldW = stage.getBoundingClientRect().width || 300;
    this.spawnMoving();
    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private spawnMoving(): void {
    this.current = document.createElement("div");
    this.current.className = "is-scoop is-scoop--moving";
    const color = sample(SCOOP_COLORS);
    this.current.style.background = `radial-gradient(circle at 35% 30%,#fff6,${color})`;
    this.current.style.bottom = `${24 + this.scoops.length * 38}px`;
    document.getElementById("is-stage")!.appendChild(this.current);
    this.movingX = 0;
    this.dir = Math.random() < 0.5 ? 1 : -1;
  }

  private tick = (dt: number): void => {
    if (this.over) {
      this.stop?.();
      this.stop = undefined;
      return;
    }
    void dt;
    const cur = this.current;
    const curW = 60;
    const maxX = this.fieldW / 2 - curW / 2;
    this.movingX += this.dir * this.speed;
    if (this.movingX > maxX) {
      this.movingX = maxX;
      this.dir = -1;
    }
    if (this.movingX < -maxX) {
      this.movingX = -maxX;
      this.dir = 1;
    }
    cur.style.left = `calc(50% + ${this.movingX}px - ${curW / 2}px)`;
  };

  private drop(): void {
    if (this.over) return;
    const dropX = this.movingX; // 相对中心偏移
    const color = sample(SCOOP_COLORS);
    // 计算相对上一个球的偏移（影响歪斜）
    const last = this.scoops[this.scoops.length - 1];
    const lastX = last ? last.x : 0;
    const relOffset = dropX - lastX;
    // 把移动球固化
    this.current.classList.remove("is-scoop--moving");
    this.current.style.left = `calc(50% + ${dropX}px - 30px)`;
    this.current.style.background = `radial-gradient(circle at 35% 30%,#fff6,${color})`;
    const scoop: Scoop = { x: dropX, color, el: this.current };
    this.scoops.push(scoop);
    sfxPop();
    this.resetWrongStreak();
    // 更新倾斜：累积偏移让所有球向偏移方向倾
    this.applyTilt();
    // 偏移过大→倒塌
    if (Math.abs(relOffset) > 34) {
      this.current.classList.add("is-scoop--fall");
      this.endGame();
      return;
    }
    const h = this.root.querySelector("#is-h");
    if (h)
      h.textContent = `高度：${this.scoops.length} / ${this.targetHeight()}`;
    if (this.scoops.length >= this.targetHeight()) {
      this.over = true;
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      // 按累积倾斜算星：越正越准
      const drift = Math.abs(this.scoops[this.scoops.length - 1]!.x);
      const stars = drift < 14 ? 3 : drift < 28 ? 2 : 1;
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(stars);
        } else {
          this.startRound();
        }
      }, 600);
    } else {
      this.spawnMoving();
    }
  }

  /** 让整串冰淇淋随累积偏移微微倾斜（视觉化歪斜）。 */
  private applyTilt(): void {
    const top = this.scoops[this.scoops.length - 1];
    if (!top) return;
    const drift = top.x;
    this.scoops.forEach((s) => {
      const k = drift * 0.05;
      s.el.style.transform = `rotate(${k}deg)`;
    });
  }

  private endGame(): void {
    this.over = true;
    this.stop?.();
    this.onWrong();
    const stars =
      this.scoops.length >= this.targetHeight() - 1
        ? 3
        : this.scoops.length >= 3
          ? 2
          : 1;
    this.trackTimeout(() => this.finishClear(stars), 800);
  }

  private injectStyle(): void {
    if (document.getElementById("is-style")) return;
    const st = document.createElement("style");
    st.id = "is-style";
    st.textContent = IS_CSS(getCssVar("--c-pink"), randInt(0, 360));
    document.head.appendChild(st);
  }
}

function IS_CSS(theme: string, _hue: number): string {
  return `
.is-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.is-task{font-size:1rem;font-weight:800;text-align:center;line-height:1.5;}
.is-stage{position:relative;width:100%;height:55vh;min-height:320px;background:linear-gradient(180deg,#fff3e0,#ffe0b2);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
.is-cone{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:4rem;line-height:1;z-index:1;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));}
.is-scoop{position:absolute;width:60px;height:60px;border-radius:50%;box-shadow:var(--shadow),inset 0 -6px 8px rgba(0,0,0,.12);transition:transform .2s ease;z-index:2;will-change:left;}
.is-scoop--moving{animation:is-glow 1s ease infinite;}
.is-scoop--fall{animation:is-fall .7s ease forwards;}
.is-drop{min-height:62px;padding:0 36px;font-size:1.2rem;font-weight:900;border-radius:999px;background:${theme};color:#fff;box-shadow:var(--shadow);transition:transform .08s;}
.is-drop:active{transform:scale(.94);}
@keyframes is-glow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.18)}}
@keyframes is-fall{to{transform:translateY(260px) rotate(80deg);opacity:0}}
`;
}

export function create(): IceCreamStackGame {
  return new IceCreamStackGame();
}
