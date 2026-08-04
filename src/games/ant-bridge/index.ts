/* 蚂蚁搭桥 Ant Bridge —— 蚂蚁要过沟，沟上有不同宽度的缺口。下方有几根不同长度的
   木棍，孩子要选一根长度和缺口匹配（够长）的木棍搭上去，蚂蚁才能走过去。
   视觉：两岸地面 + 沟 + 蚂蚁 + 木棍选项。难度 = 沟数（一条沟上有几个缺口要搭）。
   通关 = 搭完目标轮数。前缀 ab2-（ant-march 用 am-，ant-farm 用 af-，故用 ab2-）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

const WOOD_COLORS = ["#b08968", "#9c6b4a", "#c89a6a", "#8a5a2b", "#a87848"];

export class AntBridgeGame extends BaseGame {
  constructor() {
    super("ant-bridge");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 当前要搭的缺口索引 */
  private gapIdx = 0;
  private gaps: number[] = [];
  /** 每个缺口正确木棍长度 */
  private correctLen: number[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 每轮缺口数（沟上的缺口数 = 难度）。 */
  private gapCount(): number {
    if (this.difficulty === "easy") return 2;
    if (this.difficulty === "medium") return 3;
    return 4;
  }

  /** 生成一条沟：返回每个缺口宽度（占场景宽度的百分比，如 12 = 12%）。
   *  保证每个缺口宽度落在 8..20 之间，且总宽度不超过 70（留出岸地）。 */
  private genGaps(n: number): number[] {
    const widths: number[] = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      let w = randInt(8, 18);
      while (total + w > 70) w = randInt(6, 10);
      widths.push(w);
      total += w + 6; // 缺口间留岸地
    }
    return widths;
  }

  /** 为缺口宽度生成 3 根木棍选项：1 根正确（长度=缺口宽），2 根干扰（偏短/偏长）。
   *  正确木棍"刚好够长"（= 缺口宽），干扰木棍一定更短（搭不上）。保证唯一解。 */
  private genOptions(gapWidth: number): { len: number; correct: boolean }[] {
    const options: { len: number; correct: boolean }[] = [
      { len: gapWidth, correct: true },
    ];
    // 两个干扰，都比缺口短（保证只有正确那根够长）
    const seen = new Set<number>([gapWidth]);
    let guard = 0;
    while (options.length < 3 && guard < 50) {
      guard += 1;
      const shorter = gapWidth - randInt(2, Math.max(3, gapWidth - 4));
      if (shorter >= 5 && !seen.has(shorter)) {
        seen.add(shorter);
        options.push({ len: shorter, correct: false });
      }
    }
    // 兜底
    while (options.length < 3) {
      const shorter = Math.max(5, gapWidth - (options.length + 1) * 2);
      if (!seen.has(shorter)) {
        seen.add(shorter);
        options.push({ len: shorter, correct: false });
      } else {
        options.push({ len: shorter, correct: false });
        break;
      }
    }
    return options;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const n = this.gapCount();
    this.gaps = this.genGaps(n);
    this.correctLen = this.gaps.map((w) => w);
    this.gapIdx = 0;

    const wrap = document.createElement("div");
    wrap.className = "ab2-wrap";

    const task = document.createElement("div");
    task.className = "ab2-task";
    task.innerHTML = `选 <b>够长</b> 的木棍搭到缺口上，让蚂蚁过沟！第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    // 场景：地面 + 沟（含缺口）
    const scene = document.createElement("div");
    scene.className = "ab2-scene";
    scene.id = "ab2-scene";

    // 构造地面：按 gap 占比分配岸地与缺口
    const ground = document.createElement("div");
    ground.className = "ab2-ground";
    const remainingLand = 100 - this.gaps.reduce((s, w) => s + w, 0);
    // 每段岸地 = 剩余均分到 (n+1) 段
    const segCount = n + 1;
    const landSeg = remainingLand / segCount;

    const gapEls: HTMLDivElement[] = [];
    for (let i = 0; i < n; i++) {
      // 岸
      const bank = document.createElement("div");
      bank.className = "ab2-bank";
      bank.style.width = `${landSeg}%`;
      ground.appendChild(bank);
      // 缺口
      const gap = document.createElement("div");
      gap.className = "ab2-gap";
      gap.dataset.idx = String(i);
      gap.style.width = `${this.gaps[i]!}%`;
      ground.appendChild(gap);
      gapEls.push(gap);
    }
    // 最后一段岸
    const lastBank = document.createElement("div");
    lastBank.className = "ab2-bank ab2-bank--last";
    lastBank.style.width = `${landSeg}%`;
    ground.appendChild(lastBank);
    void remainingLand;

    // 蚂蚁（站在第一个岸上）
    const ant = document.createElement("div");
    ant.className = "ab2-ant";
    ant.id = "ab2-ant";
    ant.textContent = "🐜";
    ground.appendChild(ant);

    // 终点旗帜（最后一段岸上）
    const flag = document.createElement("div");
    flag.className = "ab2-flag";
    flag.textContent = "🏁";
    ground.appendChild(flag);

    scene.appendChild(ground);
    wrap.appendChild(scene);

    // 木棍选项区
    const tray = document.createElement("div");
    tray.className = "ab2-tray";
    tray.id = "ab2-tray";
    wrap.appendChild(tray);
    this.root.appendChild(wrap);

    this.renderOptions(gapEls, ant);
  }

  private renderOptions(gapEls: HTMLDivElement[], ant: HTMLDivElement): void {
    const tray = this.root.querySelector("#ab2-tray") as HTMLElement | null;
    if (!tray) return;
    tray.innerHTML = "";
    const gapWidth = this.correctLen[this.gapIdx]!;
    const label = document.createElement("div");
    label.className = "ab2-tray-label";
    label.innerHTML = `第 <b>${this.gapIdx + 1}</b> 个缺口：选一根够长的木棍～`;
    tray.appendChild(label);

    const row = document.createElement("div");
    row.className = "ab2-tray-row";
    shuffle(this.genOptions(gapWidth)).forEach((o, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ab2-wood";
      b.style.setProperty("--ab2-w", `${o.len * 2.4}px`);
      b.style.setProperty("--ab2-c", WOOD_COLORS[idx % WOOD_COLORS.length]!);
      b.addEventListener("click", () =>
        this.pick(b, o.len, o.correct, gapEls, ant),
      );
      row.appendChild(b);
    });
    tray.appendChild(row);
  }

  private pick(
    btn: HTMLButtonElement,
    len: number,
    correct: boolean,
    gapEls: HTMLDivElement[],
    ant: HTMLDivElement,
  ): void {
    if (this.locked) return;
    const need = this.correctLen[this.gapIdx]!;
    if (correct && len >= need) {
      this.locked = true;
      btn.classList.add("ab2-wood--used");
      // 把木棍铺到缺口上
      const gap = gapEls[this.gapIdx]!;
      gap.classList.add("ab2-gap--bridged");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 蚂蚁移动到下一个缺口（或终点）
      this.trackTimeout(() => {
        this.moveAnt(gapEls, ant);
        this.gapIdx += 1;
        this.trackTimeout(() => {
          this.locked = false;
          if (this.gapIdx >= this.gaps.length) {
            // 全部搭完 → 蚂蚁到终点
            this.roundsDone += 1;
            this.reportProgress(this.roundsDone, this.roundTotal);
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal) {
                this.finishClear(starsByAccuracy(this.wrongCount));
              } else {
                this.startRound();
              }
            }, 800);
          } else {
            this.renderOptions(gapEls, ant);
          }
        }, 500);
      }, 450);
    } else {
      // 木棍太短，搭不上
      btn.classList.add("ab2-wood--shake");
      this.trackTimeout(() => btn.classList.remove("ab2-wood--shake"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  /** 蚂蚁移动到当前 gap 的位置（左岸右侧）。 */
  private moveAnt(gapEls: HTMLDivElement[], ant: HTMLDivElement): void {
    // 用 offsetLeft 累积到当前缺口的左边
    let left = 0;
    for (let i = 0; i <= this.gapIdx && i < gapEls.length; i++) {
      left = gapEls[i]!.offsetLeft + gapEls[i]!.offsetWidth;
    }
    ant.style.left = `${left}px`;
  }

  private showRest(): void {
    this.locked = true;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🐜",
      variant: "rest",
      body: "蚂蚁需要一根比缺口还长一点的木棍才能搭稳。比一比哪根最长～",
      primary: {
        text: "继续",
        icon: "🪵",
        onClick: () => {
          ov.destroy();
          this.locked = false;
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
    if (document.getElementById("ab2-style")) return;
    const st = document.createElement("style");
    st.id = "ab2-style";
    st.textContent = AB2_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function AB2_CSS(theme: string): string {
  return `
.ab2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.ab2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ab2-task b{color:${theme};}
.ab2-scene{width:100%;max-width:460px;border-radius:18px;overflow:hidden;box-shadow:var(--shadow);}
.ab2-ground{position:relative;display:flex;align-items:flex-end;width:100%;height:200px;background:linear-gradient(180deg,#7dd3fc 0%,#38bdf8 45%);padding:0;}
.ab2-bank{position:relative;height:90px;background:linear-gradient(180deg,#84cc16,#65a30d);border-radius:8px 8px 0 0;box-shadow:inset 0 3px 0 rgba(255,255,255,.3);align-self:flex-end;}
.ab2-bank::after{content:"🌱";position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:1rem;}
.ab2-bank--last::before{content:"";position:absolute;top:-18px;right:4px;}
.ab2-gap{position:relative;height:90px;align-self:flex-end;background:linear-gradient(180deg,#0ea5e9,#0369a1);border-radius:6px 6px 0 0;display:flex;align-items:flex-start;justify-content:center;}
.ab2-gap::after{content:"水";position:absolute;top:4px;font-size:.7rem;color:rgba(255,255,255,.7);}
.ab2-gap--bridged::before{content:"";position:absolute;bottom:30px;left:-4px;right:-4px;height:14px;border-radius:8px;background:repeating-linear-gradient(90deg,#c89a6a 0 12px,#8a5a2b 12px 24px);box-shadow:0 3px 4px rgba(0,0,0,.25);animation:ab2-lay .35s ease;}
@keyframes ab2-lay{0%{transform:translateY(-30px) rotate(-6deg);opacity:.4}100%{transform:translateY(0) rotate(0);opacity:1}}
.ab2-ant{position:absolute;bottom:88px;left:8px;font-size:1.8rem;z-index:6;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));transition:left .5s ease;animation:ab2-wiggle .5s ease-in-out infinite alternate;}
@keyframes ab2-wiggle{from{transform:translateY(0)}to{transform:translateY(-3px)}}
.ab2-flag{position:absolute;bottom:88px;right:6px;font-size:1.6rem;z-index:5;}
.ab2-tray{width:100%;max-width:460px;background:linear-gradient(180deg,#d7b88f,#b89868);border-radius:16px;padding:12px;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;gap:10px;border:3px solid #8a5a2b;}
.ab2-tray-label{font-size:.95rem;font-weight:800;color:#3a2a1a;}
.ab2-tray-label b{color:#7c2d12;}
.ab2-tray-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.ab2-wood{width:var(--ab2-w,80px);min-width:48px;height:40px;border:none;border-radius:8px;background:linear-gradient(180deg,var(--ab2-c,#b08968),rgba(0,0,0,.18));cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.18),inset 0 2px 0 rgba(255,255,255,.3);transition:transform .1s;position:relative;}
.ab2-wood::after{content:"";position:absolute;inset:0;border-radius:8px;background:repeating-linear-gradient(90deg,transparent 0 14px,rgba(0,0,0,.12) 14px 16px);}
.ab2-wood:active{transform:translateY(3px);}
.ab2-wood--used{opacity:.25;pointer-events:none;filter:grayscale(.7);}
.ab2-wood--shake{animation:ab2-shake .45s ease;}
@keyframes ab2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.ab2-ground{height:170px;}.ab2-bank,.ab2-gap{height:76px;}.ab2-ant,.ab2-flag{bottom:74px;}}
`;
}

export function create(): AntBridgeGame {
  return new AntBridgeGame();
}
