/* 瓢虫斑 Ladybug Spot —— 显示一只瓢虫（CSS画的，背部斑点数量不同），
   问"有几颗斑点"，孩子从选项中选。
   独特点：纯 CSS 画的瓢虫，斑点位置随机但不重叠，背壳中线分明。
   玩法：数清斑点数，点对应数字按钮。
   视觉：瓢虫（红背+黑头+黑斑）+ 斑点。难度 = 斑点数(2-10)。
   通关 = 答对目标轮数。前缀 lbs- 不冲突。
   保证有解：答案按钮一定包含正确数字。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, randInt } from "../../lobby/util.ts";

interface SpotPos {
  x: number; // 背壳内百分比 0~100
  y: number;
  /** 左半还是右半（0=左,1=右），保证中线对称感 */
  side: 0 | 1;
}

/** 在背壳内生成 n 个不重叠的斑点位置（左右对称分布）。 */
function genSpots(n: number): SpotPos[] {
  const spots: SpotPos[] = [];
  const placed: { x: number; y: number }[] = [];
  // 每对斑点对称放（左右各一），奇数则中心多放一个
  const pairs = Math.floor(n / 2);
  const center = n % 2 === 1;
  const minDist = 16; // 最小间距（百分比）
  let tries = 0;
  while (spots.length < pairs * 2 && tries < 400) {
    tries++;
    // 左半 8~44，右半 56~92；纵向 22~78
    const ly = randInt(22, 78);
    const lxOff = randInt(8, 44);
    const leftX = 50 - lxOff;
    const rightX = 50 + lxOff;
    // 检查左点不与已放置点太近
    const okLeft = placed.every(
      (p) => Math.hypot(p.x - leftX, p.y - ly) >= minDist,
    );
    if (!okLeft) continue;
    spots.push({ x: leftX, y: ly, side: 0 });
    spots.push({ x: rightX, y: ly, side: 1 });
    placed.push({ x: leftX, y: ly });
    placed.push({ x: rightX, y: ly });
  }
  if (center) {
    spots.push({ x: 50, y: randInt(30, 70), side: 0 });
  }
  return spots;
}

/** 生成 4 个数字选项（含正确答案），范围贴近正确值。 */
function genOptions(correct: number): number[] {
  const set = new Set<number>([correct]);
  let guard = 0;
  while (set.size < 4 && guard < 50) {
    guard++;
    const delta = randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1);
    const v = correct + delta;
    if (v >= 2 && v <= 10) set.add(v);
  }
  // 兜底：若凑不够 4 个，补邻近
  let fill = 2;
  while (set.size < 4) {
    if (!set.has(fill)) set.add(fill);
    fill++;
    if (fill > 10) fill = 2;
  }
  return shuffle([...set]);
}

export class LadybugSpotGame extends BaseGame {
  constructor() {
    super("ladybug-spot");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answer = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空，trackTimeout 由基类清理 */
  }

  private spotRange(): [number, number] {
    return this.difficulty === "easy"
      ? [2, 5]
      : this.difficulty === "medium"
        ? [4, 7]
        : [6, 10];
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const [lo, hi] = this.spotRange();
    this.answer = randInt(lo, hi);
    const spots = genSpots(this.answer);

    const wrap = document.createElement("div");
    wrap.className = "lbs-wrap";

    const task = document.createElement("div");
    task.className = "lbs-task";
    task.innerHTML = `数数瓢虫背上有<b>几颗斑点</b>？<br><span class="lbs-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    // 瓢虫
    const bugBox = document.createElement("div");
    bugBox.className = "lbs-bug-box";
    const bug = document.createElement("div");
    bug.className = "lbs-bug";
    bug.innerHTML = `<div class="lbs-head"></div><div class="lbs-body"></div>`;
    const body = bug.querySelector(".lbs-body") as HTMLElement;
    // 中线
    const mid = document.createElement("div");
    mid.className = "lbs-mid";
    body.appendChild(mid);
    spots.forEach((s) => {
      const dot = document.createElement("div");
      dot.className = "lbs-spot";
      dot.style.left = `${s.x}%`;
      dot.style.top = `${s.y}%`;
      body.appendChild(dot);
    });
    bugBox.appendChild(bug);
    wrap.appendChild(bugBox);

    // 选项
    const opts = genOptions(this.answer);
    const optRow = document.createElement("div");
    optRow.className = "lbs-opts";
    opts.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lbs-opt";
      b.textContent = String(v);
      b.addEventListener("click", () => this.pick(v, b));
      optRow.appendChild(b);
    });
    wrap.appendChild(optRow);

    const hint = document.createElement("div");
    hint.className = "lbs-hint";
    hint.id = "lbs-hint";
    hint.textContent = "点一颗数一颗，别漏掉哦～";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  private pick(v: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (v === this.answer) {
      this.locked = true;
      btn.classList.add("lbs-opt--right");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 高亮所有斑点
      this.root
        .querySelectorAll(".lbs-spot")
        .forEach((s) => s.classList.add("lbs-spot--hi"));
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("lbs-opt--wrong");
      const paused = this.onWrong();
      const hint = this.root.querySelector("#lbs-hint");
      if (hint) hint.textContent = `再数一遍，是 ${this.answer} 颗哦`;
      this.trackTimeout(() => {
        btn.classList.remove("lbs-opt--wrong");
      }, 600);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🐞",
      variant: "rest",
      body: "用手指点一颗数一颗，数完再选答案。",
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
    if (document.getElementById("lbs-style")) return;
    const st = document.createElement("style");
    st.id = "lbs-style";
    st.textContent = LBS_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function LBS_CSS(theme: string): string {
  return `
.lbs-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.lbs-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.lbs-task b{color:${theme};}
.lbs-sub{font-size:.85rem;font-weight:700;color:#888;}
.lbs-bug-box{display:flex;align-items:center;justify-content:center;padding:24px 30px;background:radial-gradient(ellipse at 50% 40%,rgba(107,207,127,.25),transparent 70%),linear-gradient(180deg,#e9fbe9,#cdeecf);border-radius:28px;box-shadow:var(--shadow);}
.lbs-bug{position:relative;width:230px;height:180px;}
.lbs-body{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:200px;height:160px;background:radial-gradient(circle at 35% 30%,#ff7a6b,#e23b2e 70%,#b8281d);border-radius:50%;box-shadow:inset 0 -8px 14px rgba(0,0,0,.25),0 8px 14px rgba(0,0,0,.2);}
.lbs-mid{position:absolute;left:50%;top:0;bottom:0;width:5px;transform:translateX(-50%);background:linear-gradient(#1a1a1a,#3a3a3a,#1a1a1a);box-shadow:0 0 2px rgba(0,0,0,.4);}
.lbs-head{position:absolute;left:50%;top:8%;transform:translate(-50%,-50%);width:60px;height:54px;background:radial-gradient(circle at 50% 40%,#2a2a2a,#000);border-radius:50%;box-shadow:0 4px 6px rgba(0,0,0,.3);z-index:2;}
.lbs-head::before,.lbs-head::after{content:"";position:absolute;top:8px;width:8px;height:14px;background:#000;border-radius:4px;}
.lbs-head::before{left:14px;transform:rotate(-18deg);}
.lbs-head::after{right:14px;transform:rotate(18deg);}
.lbs-spot{position:absolute;width:22px;height:22px;background:radial-gradient(circle at 35% 30%,#3a3a3a,#000);border-radius:50%;transform:translate(-50%,-50%);box-shadow:inset 0 -2px 3px rgba(255,255,255,.15);transition:transform .2s ease,box-shadow .2s ease;}
.lbs-spot--hi{box-shadow:0 0 0 4px rgba(255,217,61,.7),inset 0 -2px 3px rgba(255,255,255,.15);transform:translate(-50%,-50%) scale(1.15);}
.lbs-opts{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-width:440px;}
.lbs-opt{width:72px;height:72px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,#f0f0f0);font-size:1.8rem;font-weight:900;color:#333;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.1);transition:transform .12s,background .2s;border:3px solid transparent;}
.lbs-opt:active{transform:translateY(2px);}
.lbs-opt--right{border-color:#6bcf7f;background:linear-gradient(180deg,#e0ffe4,#bff0c1);color:#2e7d32;animation:lbs-pop .4s ease;}
.lbs-opt--wrong{border-color:${theme};background:linear-gradient(180deg,#ffe0d8,#ffc4b8);animation:lbs-shake .5s ease;}
@keyframes lbs-pop{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes lbs-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.lbs-hint{font-size:.95rem;font-weight:700;color:#666;text-align:center;min-height:1.4rem;}
@media (max-width:380px){.lbs-bug{width:190px;height:150px;}.lbs-body{width:170px;height:136px;}.lbs-spot{width:18px;height:18px;}.lbs-opt{width:60px;height:60px;font-size:1.5rem;}}
`;
}

export function create(): LadybugSpotGame {
  return new LadybugSpotGame();
}
