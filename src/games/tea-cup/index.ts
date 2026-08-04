/* 茶杯温度 Tea Cup —— 不同茶需要不同水温，
   每个杯子标着温度（如 80℃），孩子把对应的茶叶拖到那个杯子里。
   独特点：温度/常识认知（绿茶凉一点、红茶沸水）+ 拖拽。
   视觉：茶杯（带温度计/温度标）+ 茶叶（拖拽源）。
   难度=茶种类数。通关=配对目标轮数。前缀 tcu-。
   可解性：每种茶唯一对应一个温度，杯子数=茶种类数且温度各不相同。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Tea {
  key: string;
  emoji: string;
  name: string;
  /** 所需水温（℃） */
  temp: number;
  color: string;
}

/** 不同茶的标准冲泡水温。temp 互不相同便于唯一配对。 */
const TEAS: Tea[] = [
  { key: "green", emoji: "🍵", name: "绿茶", temp: 80, color: "#8bc34a" },
  { key: "black", emoji: "🫖", name: "红茶", temp: 100, color: "#a0522d" },
  { key: "flower", emoji: "🌼", name: "花茶", temp: 90, color: "#ffb6c1" },
  { key: "oolong", emoji: "🌿", name: "乌龙", temp: 95, color: "#6b8e23" },
  { key: "white", emoji: "🤍", name: "白茶", temp: 85, color: "#e6e6fa" },
];

const ENCOURAGE = [
  "配得真准！",
  "水温记得清楚！",
  "你是茶艺师！",
  "看清楚温度哦～",
];

export class TeaCupGame extends BaseGame {
  constructor() {
    super("tea-cup");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private teas: Tea[] = [];
  private remaining = 0;
  private unbinds: (() => void)[] = [];
  private ghost: HTMLElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.ghost?.remove();
    this.ghost = null;
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.ghost?.remove();
    this.ghost = null;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    this.teas = shuffle([...TEAS]).slice(0, n);
    this.remaining = this.teas.length;

    const wrap = document.createElement("div");
    wrap.className = "tcu-wrap";

    const task = document.createElement("div");
    task.className = "tcu-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 把茶叶拖到温度合适的杯子里 🍵`;
    wrap.appendChild(task);

    // 杯子区（上）
    const cups = document.createElement("div");
    cups.className = "tcu-cups";
    shuffle([...this.teas]).forEach((t) => {
      const cup = document.createElement("div");
      cup.className = "tcu-cup";
      cup.dataset.temp = String(t.temp);
      cup.style.setProperty("--tcu-c", t.color);
      // 温度计/温度标
      const therm = document.createElement("div");
      therm.className = "tcu-therm";
      therm.innerHTML = `<div class="tcu-therm__bar" style="height:${(t.temp / 100) * 100}%"></div>`;
      cup.appendChild(therm);
      const body = document.createElement("div");
      body.className = "tcu-cup__body";
      body.innerHTML = `<div class="tcu-cup__temp">${t.temp}<span>℃</span></div><div class="tcu-cup__fill" id="tcu-fill-${t.temp}"></div>`;
      cup.appendChild(body);
      const handle = document.createElement("div");
      handle.className = "tcu-cup__handle";
      cup.appendChild(handle);
      cups.appendChild(cup);
    });
    wrap.appendChild(cups);

    // 茶叶盘（下，拖拽源）
    const tray = document.createElement("div");
    tray.className = "tcu-tray";
    shuffle([...this.teas]).forEach((t) => {
      const src = document.createElement("div");
      src.className = "tcu-src";
      src.dataset.key = t.key;
      src.style.setProperty("--tcu-c", t.color);
      src.innerHTML = `<span class="tcu-src__emoji">${t.emoji}</span><span class="tcu-src__name">${t.name}</span>`;
      this.enableDrag(src, t);
      tray.appendChild(src);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(src: HTMLElement, t: Tea): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    const unbind = bindPointer(src, {
      down: (p) => {
        dragging = true;
        sfxPop();
        const r = src.getBoundingClientRect();
        ox = r.width / 2;
        oy = r.height / 2;
        const ghost = document.createElement("div");
        ghost.className = "tcu-ghost";
        ghost.textContent = t.emoji;
        ghost.style.left = `${p.x - ox}px`;
        ghost.style.top = `${p.y - oy}px`;
        document.body.appendChild(ghost);
        this.ghost = ghost;
        src.classList.add("tcu-src--active");
      },
      move: (p) => {
        if (!dragging || !this.ghost) return;
        this.ghost.style.left = `${p.x - ox}px`;
        this.ghost.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        src.classList.remove("tcu-src--active");
        const ghost = this.ghost;
        this.ghost = null;
        // 找命中的杯子
        let hitTemp: number | null = null;
        this.root.querySelectorAll<HTMLElement>(".tcu-cup").forEach((c) => {
          const r = c.getBoundingClientRect();
          if (
            p.x >= r.left &&
            p.x <= r.right &&
            p.y >= r.top &&
            p.y <= r.bottom
          ) {
            hitTemp = Number(c.dataset.temp);
          }
        });
        if (hitTemp !== null) {
          this.tryDrop(hitTemp, t, src, ghost);
        } else {
          ghost?.classList.add("tcu-ghost--fade");
          this.trackTimeout(() => ghost?.remove(), 200);
        }
      },
    });
    this.unbinds.push(unbind);
  }

  private tryDrop(
    hitTemp: number,
    t: Tea,
    src: HTMLElement,
    ghost: HTMLElement | null,
  ): void {
    if (hitTemp !== t.temp) {
      // 温度不匹配
      ghost?.classList.add("tcu-ghost--fade");
      this.trackTimeout(() => ghost?.remove(), 200);
      const cup = this.root.querySelector<HTMLElement>(
        `.tcu-cup[data-temp="${hitTemp}"]`,
      );
      cup?.classList.add("tcu-cup--shake");
      this.trackTimeout(() => cup?.classList.remove("tcu-cup--shake"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    // 配对成功
    this.remaining -= 1;
    ghost?.remove();
    src.classList.add("tcu-src--done");
    const cup = this.root.querySelector<HTMLElement>(
      `.tcu-cup[data-temp="${t.temp}"]`,
    );
    if (cup) {
      cup.classList.add("tcu-cup--matched");
      const fill = cup.querySelector<HTMLElement>(`#tcu-fill-${t.temp}`);
      if (fill) {
        fill.classList.add("tcu-cup__fill--on");
        fill.style.background = t.color;
      }
      // 在杯口显示茶叶
      const tag = document.createElement("span");
      tag.className = "tcu-cup__tea";
      tag.textContent = t.emoji;
      cup.appendChild(tag);
      const r = cup.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }
    this.resetWrongStreak();
    if (this.remaining <= 0) {
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍵",
      variant: "rest",
      body: `看看杯子上的温度，想想这种茶要用多热的水～ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("tcu-style")) return;
    const st = document.createElement("style");
    st.id = "tcu-style";
    st.textContent = TCU_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function TCU_CSS(theme: string): string {
  return `
.tcu-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(520px,100%);}
.tcu-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.tcu-cups{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;}
.tcu-cup{position:relative;width:96px;height:120px;display:flex;align-items:flex-end;justify-content:center;}
.tcu-therm{position:absolute;left:2px;top:6px;width:8px;height:96px;background:#fff;border-radius:4px;box-shadow:inset 0 0 0 1px #ccc;overflow:hidden;}
.tcu-therm__bar{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#ff6348,#ffd93d);}
.tcu-cup__body{position:relative;width:70px;height:80px;background:linear-gradient(180deg,#fff,#f0f0f0);border-radius:8px 8px 28px 28px;box-shadow:var(--shadow),inset 0 -6px 8px rgba(0,0,0,.08);overflow:hidden;border:2px solid #e0e0e0;}
.tcu-cup__temp{position:absolute;top:4px;left:0;right:0;text-align:center;font-size:1rem;font-weight:900;color:#444;z-index:3;}
.tcu-cup__temp span{font-size:.7rem;}
.tcu-cup__fill{position:absolute;left:0;right:0;bottom:0;height:0;transition:height .4s ease;}
.tcu-cup__fill--on{height:62%;}
.tcu-cup__handle{position:absolute;right:-2px;top:18px;width:18px;height:30px;border:5px solid #e0e0e0;border-left:none;border-radius:0 14px 14px 0;}
.tcu-cup--matched .tcu-cup__body{border-color:${theme};box-shadow:0 0 0 3px ${theme}55,var(--shadow);}
.tcu-cup--shake{animation:tcu-shake .4s ease;}
@keyframes tcu-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
.tcu-cup__tea{position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:1.5rem;animation:tcu-in .4s ease;}
@keyframes tcu-in{0%{transform:translateX(-50%) translateY(-30px) scale(.3);opacity:0}70%{transform:translateX(-50%) translateY(4px) scale(1.3);opacity:1}100%{transform:translateX(-50%) translateY(0) scale(1);opacity:1}}
.tcu-tray{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:460px;}
.tcu-src{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:78px;padding:10px 6px;border-radius:18px;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--tcu-c,#eee) 28%,#fff));box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:grab;touch-action:none;transition:transform .1s;}
.tcu-src:active{transform:translateY(3px);}
.tcu-src--active{opacity:.5;}
.tcu-src--done{opacity:.4;filter:grayscale(.6);pointer-events:none;}
.tcu-src__emoji{font-size:1.9rem;}
.tcu-src__name{font-size:.78rem;font-weight:800;color:#555;}
.tcu-ghost{position:fixed;font-size:2rem;z-index:1000;pointer-events:none;transform:translate(-50%,-50%);filter:drop-shadow(0 4px 6px rgba(0,0,0,.3));transition:opacity .2s;}
.tcu-ghost--fade{opacity:0;}
@media (max-width:380px){.tcu-cup{width:80px;height:104px;}.tcu-cup__body{width:58px;height:68px;}.tcu-src{min-width:66px;}}
`;
}

export function create(): TeaCupGame {
  return new TeaCupGame();
}
