/* 搭积木 Block Tower —— 把积木一块块叠上去，越准越稳越高。
   独特点：平衡堆叠（区别于静态拼图/排序），错位会越叠越窄。
   巧思：每块积木需点在合适位置放下，偏移累积会让塔变窄甚至倒。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Block {
  x: number;
  w: number;
  el: HTMLElement;
}

export class BlockTowerGame extends BaseGame {
  constructor() {
    super("block-tower");
  }
  private roundTotal = 0;
  private roundsDone = 0;
  private blocks: Block[] = [];
  private movingX = 0;
  private dir = 1;
  private speed = 0;
  private raf = 0;
  private current!: HTMLDivElement;
  private baseW = 0;
  private over = false;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.startRound();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";
    this.blocks = [];
    this.baseW = 140;
    this.speed =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.movingX = 0;
    this.dir = 1;
    this.over = false;

    const wrap = document.createElement("div");
    wrap.className = "bt-wrap";
    const task = document.createElement("div");
    task.className = "bt-task";
    task.innerHTML = `看准时机点屏幕，把积木叠上去！<br><span id="bt-h">高度：0</span>`;
    wrap.appendChild(task);

    const tower = document.createElement("div");
    tower.className = "bt-tower";
    tower.id = "bt-tower";
    wrap.appendChild(tower);

    const dropBtn = document.createElement("button");
    dropBtn.type = "button";
    dropBtn.className = "bt-drop";
    dropBtn.textContent = "👇 放下积木";
    dropBtn.addEventListener("click", () => this.drop());
    wrap.appendChild(dropBtn);
    this.root.appendChild(wrap);

    this.spawnMoving();
  }

  private spawnMoving(): void {
    const last = this.blocks[this.blocks.length - 1];
    const lastW = last ? last.w : this.baseW;
    this.current = document.createElement("div");
    this.current.className = "bt-block bt-block--moving";
    this.current.style.width = `${lastW}px`;
    this.current.style.bottom = `${this.blocks.length * 30}px`;
    document.getElementById("bt-tower")!.appendChild(this.current);
    this.movingX = 0;
    this.dir = 1;
    this.loop();
  }

  private fieldW(): number {
    const t = document.getElementById("bt-tower");
    return t ? t.getBoundingClientRect().width : 300;
  }

  private loop = (): void => {
    const w = this.fieldW();
    const curW = parseFloat(this.current.style.width) || this.baseW;
    this.movingX += this.dir * this.speed;
    if (this.movingX > w - curW) {
      this.movingX = w - curW;
      this.dir = -1;
    }
    if (this.movingX < 0) {
      this.movingX = 0;
      this.dir = 1;
    }
    this.current.style.left = `${this.movingX}px`;
    this.raf = requestAnimationFrame(this.loop);
  };

  private drop(): void {
    // over 守卫：已结束则忽略后续点击，防重复结算
    if (this.over) return;
    cancelAnimationFrame(this.raf);
    const last = this.blocks[this.blocks.length - 1];
    const lastX = last ? last.x : (this.fieldW() - this.baseW) / 2;
    const lastW = last ? last.w : this.baseW;
    const curW = parseFloat(this.current.style.width) || this.baseW;
    const curX = this.movingX;
    // 计算重叠
    const overlapL = Math.max(lastX, curX);
    const overlapR = Math.min(lastX + lastW, curX + curW);
    if (overlapR <= overlapL) {
      // 完全没对上，倒了
      this.current.classList.add("bt-block--fall");
      this.endGame();
      return;
    }
    const newW = overlapR - overlapL;
    this.current.classList.remove("bt-block--moving");
    this.current.style.left = `${overlapL}px`;
    this.current.style.width = `${newW}px`;
    this.blocks.push({ x: overlapL, w: newW, el: this.current });
    sfxPop();
    this.resetWrongStreak();
    const h = this.root.querySelector("#bt-h");
    if (h) h.textContent = `高度：${this.blocks.length}`;
    // 达到目标高度通关；按"叠塔精度"算星：顶部积木越宽（对得越准）星越多
    const target =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 9;
    if (this.blocks.length >= target) {
      this.over = true;
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      const topW = this.blocks[this.blocks.length - 1]!.w;
      const ratio = topW / this.baseW; // 1.0=完美对齐，越小越偏
      const stars = ratio > 0.6 ? 3 : ratio > 0.35 ? 2 : 1;
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) this.finishClear(stars);
      else
        this.trackTimeout(() => {
          this.over = false;
          this.spawnMoving();
        }, 800);
    } else {
      this.spawnMoving();
    }
  }

  private endGame(): void {
    this.over = true;
    this.onWrong();
    const stars = this.blocks.length >= 5 ? 3 : this.blocks.length >= 3 ? 2 : 1;
    this.trackTimeout(() => this.finishClear(stars), 800);
  }

  private injectStyle(): void {
    if (document.getElementById("bt-style")) return;
    const st = document.createElement("style");
    st.id = "bt-style";
    st.textContent = BT_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function BT_CSS(theme: string): string {
  return `
.bt-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.bt-task{font-size:1rem;font-weight:800;text-align:center;line-height:1.5;}
.bt-tower{position:relative;width:100%;height:50vh;min-height:280px;background:linear-gradient(180deg,#e1f5fe,#fff);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.bt-block{position:absolute;height:28px;border-radius:6px;background:hsl(${randInt(0, 360)},65%,60%);box-shadow:var(--shadow);}
.bt-block--moving{animation:bt-glow 1s ease infinite;}
.bt-block--fall{animation:bt-fall .6s ease forwards;}
.bt-drop{min-height:60px;padding:0 36px;font-size:1.2rem;font-weight:800;border-radius:999px;background:${theme};color:#fff;box-shadow:var(--shadow);}
@keyframes bt-glow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.2)}}
@keyframes bt-fall{to{transform:rotate(60deg) translateY(200px);opacity:0}}
`;
}

export function create(): BlockTowerGame {
  return new BlockTowerGame();
}
