/* 看地图找宝藏 Map Read —— 网格地图上标了起点（角色）和宝藏位置，
   孩子按方向按钮（上下左右）一步步走到宝藏。
   独特点：网格空间导航——把"宝藏方位"转成方向按键序列。
   巧思：地图无障碍（空旷），起点到宝藏一定可达；走到即胜。难度=网格大小。
   视觉：网格地图 + 角色 + 宝藏（带脉冲光环）。通关=找到目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class MapReadGame extends BaseGame {
  constructor() {
    super("map-read");
  }

  private n = 5;
  private player: [number, number] = [0, 0]; // [col, row]，row 0 在顶
  private treasure: [number, number] = [0, 0];
  private cellSize = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private moving = false;

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空，无 RAF */
  }

  /** 生成保证可解的关卡：空旷网格，起点在左上区域、宝藏在右下区域，
   *  保证两者距离足够远（曼哈顿距离 >= n），让题目有意义。 */
  private genLevel(): { start: [number, number]; treasure: [number, number] } {
    const n = this.n;
    const minDist = Math.max(2, n - 1);
    for (let attempt = 0; attempt < 80; attempt++) {
      const sc = randInt(0, Math.floor(n / 2));
      const sr = randInt(0, Math.floor(n / 2));
      const tc = randInt(Math.floor(n / 2), n - 1);
      const tr = randInt(Math.floor(n / 2), n - 1);
      const dist = Math.abs(sc - tc) + Math.abs(sr - tr);
      if (dist >= minDist && !(sc === tc && sr === tr)) {
        return { start: [sc, sr], treasure: [tc, tr] };
      }
    }
    // 兜底
    return { start: [0, 0], treasure: [n - 1, n - 1] };
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    const lv = this.genLevel();
    this.player = [lv.start[0], lv.start[1]];
    this.treasure = [lv.treasure[0], lv.treasure[1]];
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "mpr-wrap";

    const task = document.createElement("div");
    task.className = "mpr-task";
    task.innerHTML = `帮小人走到 <b>宝藏 🎁</b> 那里！按方向键走。 ${this.roundsDone + 1} / ${this.roundTotal}`;
    wrap.appendChild(task);

    // 网格地图
    const map = document.createElement("div");
    map.className = "mpr-map";
    map.id = "mpr-map";
    map.style.gridTemplateColumns = `repeat(${this.n},1fr)`;
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        const cell = document.createElement("div");
        cell.className = "mpr-cell";
        if (c === this.treasure[0] && r === this.treasure[1]) {
          cell.classList.add("mpr-cell--treasure");
          cell.innerHTML = `<span class="mpr-chest">🎁</span>`;
        }
        map.appendChild(cell);
      }
    }
    // 角色（绝对定位浮层）
    const hero = document.createElement("div");
    hero.className = "mpr-hero";
    hero.id = "mpr-hero";
    hero.textContent = "🧒";
    map.appendChild(hero);
    wrap.appendChild(map);

    // 方向键（十字布局）
    const pad = document.createElement("div");
    pad.className = "mpr-pad";
    const mk = (
      dir: "up" | "down" | "left" | "right",
      label: string,
      cls: string,
    ) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mpr-dir mpr-dir--${dir}`;
      b.innerHTML = `<span class="${cls}">${label}</span>`;
      b.addEventListener("click", () => this.move(dir));
      return b;
    };
    const up = mk("up", "▲", "mpr-up");
    const left = mk("left", "◀", "mpr-left");
    const right = mk("right", "▶", "mpr-right");
    const down = mk("down", "▼", "mpr-down");
    const spacer = document.createElement("div");
    spacer.className = "mpr-spacer";
    pad.appendChild(spacer);
    pad.appendChild(up);
    pad.appendChild(left);
    pad.appendChild(right);
    pad.appendChild(down);
    wrap.appendChild(pad);

    this.root.appendChild(wrap);
    // 等 DOM 布局后定位角色
    requestAnimationFrame(() => this.positionHero());
  }

  /** 根据当前 player 坐标把角色定位到对应格子中心。 */
  private positionHero(): void {
    const map = this.root.querySelector("#mpr-map") as HTMLDivElement | null;
    const hero = this.root.querySelector("#mpr-hero") as HTMLDivElement | null;
    if (!map || !hero) return;
    const rect = map.getBoundingClientRect();
    this.cellSize = rect.width / this.n;
    const [c, r] = this.player;
    const x = c * this.cellSize + this.cellSize / 2;
    const y = r * this.cellSize + this.cellSize / 2;
    hero.style.left = `${x}px`;
    hero.style.top = `${y}px`;
  }

  private move(dir: "up" | "down" | "left" | "right"): void {
    if (this.moving) return;
    const [c, r] = this.player;
    let nc = c;
    let nr = r;
    if (dir === "up") nr = r - 1;
    else if (dir === "down") nr = r + 1;
    else if (dir === "left") nc = c - 1;
    else nc = c + 1;
    // 越界拦截
    if (nc < 0 || nr < 0 || nc >= this.n || nr >= this.n) return;
    this.moving = true;
    this.player = [nc, nr];
    sfxPop();
    this.resetWrongStreak();
    const hero = this.root.querySelector("#mpr-hero") as HTMLDivElement | null;
    if (hero) {
      const x = nc * this.cellSize + this.cellSize / 2;
      const y = nr * this.cellSize + this.cellSize / 2;
      hero.classList.add("mpr-hero--step");
      hero.style.left = `${x}px`;
      hero.style.top = `${y}px`;
      this.trackTimeout(() => hero.classList.remove("mpr-hero--step"), 200);
    }
    this.trackTimeout(() => {
      this.moving = false;
    }, 180);
    // 到达宝藏？
    if (nc === this.treasure[0] && nr === this.treasure[1]) {
      this.found();
    }
  }

  private found(): void {
    const hero = this.root.querySelector("#mpr-hero") as HTMLDivElement | null;
    if (hero) hero.textContent = "😀";
    this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 900);
  }

  private injectStyle(): void {
    if (document.getElementById("mpr-style")) return;
    const st = document.createElement("style");
    st.id = "mpr-style";
    st.textContent = MPR_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function MPR_CSS(theme: string): string {
  return `
.mpr-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.mpr-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.mpr-task b{color:${theme};}
.mpr-map{position:relative;display:grid;gap:3px;padding:10px;width:min(340px,86vw);aspect-ratio:1/1;background:linear-gradient(180deg,#d7e8c9,#b6d7a8);border-radius:18px;box-shadow:var(--shadow);}
.mpr-cell{background:repeating-linear-gradient(45deg,#fff7 0 6px,#fff3 6px 12px);border-radius:6px;}
.mpr-cell--treasure{background:radial-gradient(circle,#fffbe6,#ffe082);display:flex;align-items:center;justify-content:center;}
.mpr-chest{font-size:1.6rem;animation:mpr-glow 1s ease-in-out infinite alternate;}
@keyframes mpr-glow{from{transform:scale(1);filter:drop-shadow(0 0 2px #ffb300)}to{transform:scale(1.18);filter:drop-shadow(0 0 8px #ffb300)}}
.mpr-hero{position:absolute;width:32px;height:32px;font-size:1.6rem;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);transition:left .18s ease,top .18s ease;z-index:5;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));}
.mpr-hero--step{animation:mpr-hop .2s ease;}
@keyframes mpr-hop{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-60%) scale(1.1)}100%{transform:translate(-50%,-50%) scale(1)}}
.mpr-pad{display:grid;grid-template-columns:repeat(3,68px);grid-template-rows:repeat(2,56px);gap:10px;}
.mpr-spacer{visibility:hidden;}
.mpr-dir{border:none;border-radius:16px;background:linear-gradient(160deg,#fff,#f0f0f5);box-shadow:0 5px 0 rgba(0,0,0,.12),var(--shadow);cursor:pointer;font-size:1.4rem;font-weight:900;color:${theme};transition:transform .1s ease;display:flex;align-items:center;justify-content:center;}
.mpr-dir:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.12),var(--shadow);}
.mpr-up{grid-column:2;grid-row:1;}.mpr-left{grid-column:1;grid-row:2;}.mpr-right{grid-column:3;grid-row:2;}.mpr-down{grid-column:2;grid-row:2;}
@media (max-width:380px){.mrp-pad{grid-template-columns:repeat(3,58px);grid-template-rows:repeat(2,50px);}.mpr-dir{font-size:1.2rem;}}
`;
}

export function create(): MapReadGame {
  return new MapReadGame();
}
