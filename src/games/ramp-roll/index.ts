/* 斜坡滚落 Ramp Roll —— 三个不同角度的斜坡（陡/中/缓），球从顶滚下，
   问"哪个先到底"。坡越陡、下落越快（重力分量大），所以最陡的先到。
   独特点：直觉物理——斜面越陡球滚得越快。
   巧思：三坡角度两两不同且差距明显；作答后用 RAF 同步演示三球真实下落，最陡先到底。
   视觉：三个斜坡（不同倾角）+ 顶端球 + 终点旗。难度=坡数/位置打乱。通关=答对目标轮数。
   RAF 驱动演示，unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar } from "../../lobby/util.ts";

/** 一个斜坡：角度（度，越大越陡）= 旋转角。 */
interface Ramp {
  id: number;
  angle: number; // 倾角（度）
  label: string;
}

export class RampRollGame extends BaseGame {
  constructor() {
    super("ramp-roll");
  }

  private ramps: Ramp[] = [];
  private answer = 0; // 最陡（angle 最大）的 id
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private raf = 0;
  private over = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** 生成三条角度两两不同且差距明显的斜坡。 */
  private genRamps(): Ramp[] {
    // 三档倾角组合（陡/中/缓），保证差距 >=10° 视觉与物理都明确
    const sets: Array<[number, number, number]> = [
      [60, 38, 22],
      [68, 45, 28],
      [55, 35, 18],
      [72, 48, 30],
    ];
    const pick = sets[Math.floor(Math.random() * sets.length)] ?? [60, 38, 22];
    // 打乱顺序展示
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    return order.map((idx, pos) => {
      const angle = pick[idx]!;
      const labels = ["陡", "中", "缓"];
      return {
        id: pos,
        angle,
        label: angle >= 55 ? labels[0]! : angle <= 30 ? labels[2]! : labels[1]!,
      };
    });
  }

  private startRound(): void {
    this.over = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.ramps = this.genRamps();
    // 正确答案 = 角度最大的坡
    let maxAngle = -1;
    for (const r of this.ramps) {
      if (r.angle > maxAngle) {
        maxAngle = r.angle;
        this.answer = r.id;
      }
    }
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "rr2-wrap";

    const task = document.createElement("div");
    task.className = "rr2-task";
    task.innerHTML = `三个小球一起从坡顶松手。<br>猜猜 <b>哪个坡的球最先滚到底</b>？ ${this.roundsDone + 1} / ${this.roundTotal}`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "rr2-hint";
    hint.textContent = "坡越陡，球滚得越快～";
    wrap.appendChild(hint);

    const stage = document.createElement("div");
    stage.className = "rr2-stage";
    stage.id = "rr2-stage";

    for (const r of this.ramps) {
      const lane = document.createElement("div");
      lane.className = "rr2-lane";
      lane.dataset.id = String(r.id);

      // 斜坡：用一根旋转的木条表示，左下角为支点
      const ramp = document.createElement("div");
      ramp.className = "rr2-ramp";
      ramp.style.setProperty("--rr2-angle", `${r.angle}deg`);
      lane.appendChild(ramp);

      // 顶端球
      const ball = document.createElement("div");
      ball.className = "rr2-ball";
      ball.id = `rr2-ball-${r.id}`;
      lane.appendChild(ball);

      // 终点旗（在坡底右侧）
      const flag = document.createElement("div");
      flag.className = "rr2-flag";
      flag.textContent = "🏁";
      lane.appendChild(flag);

      // 编号选择按钮
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "rr2-pick";
      pick.textContent = ["A", "B", "C"][r.id] ?? String(r.id + 1);
      pick.addEventListener("click", () => this.choose(r.id, pick));
      lane.appendChild(pick);

      stage.appendChild(lane);
    }
    wrap.appendChild(stage);

    // 结果提示
    const result = document.createElement("div");
    result.className = "rr2-result";
    result.id = "rr2-result";
    result.textContent = "";
    wrap.appendChild(result);

    this.root.appendChild(wrap);
  }

  private choose(id: number, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const ok = id === this.answer;
    if (ok) {
      btn.classList.add("rr2-pick--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.race(); // 演示三球下落
    } else {
      btn.classList.add("rr2-pick--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".rr2-pick--wrong")
          .forEach((el) => el.classList.remove("rr2-pick--wrong"));
      }, 800);
    }
  }

  /** RAF 演示：三球同时释放，最陡先到底。
   *  物理近似：沿斜面加速度 a = g·sinθ，下落距离相同（坡长近似），
   *  到底时间 t ∝ √(1/sinθ)，陡的 t 小。这里直接按 t 比例动画 ball 的 left。 */
  private race(): void {
    this.over = false;
    const stage = this.root.querySelector(
      "#rr2-stage",
    ) as HTMLDivElement | null;
    if (!stage) return;
    const laneEls = Array.from(
      stage.querySelectorAll<HTMLDivElement>(".rr2-lane"),
    );
    // 每条道的总行程（像素），从 ball 起点 left 到终点
    const TRACK = 150;
    // 计算每条道的总时长（越陡越短）
    const durOf = (angleDeg: number): number => {
      const s = Math.sin((angleDeg * Math.PI) / 180);
      return 600 / Math.max(0.2, s); // 陡→短，缓→长
    };
    const balls = laneEls.map((lane) => {
      const id = Number(lane.dataset.id);
      const ramp = this.ramps.find((r) => r.id === id);
      const dur = ramp ? durOf(ramp.angle) : 1000;
      const el = lane.querySelector<HTMLDivElement>(`#rr2-ball-${id}`);
      return { id, dur, el };
    });
    const start = performance.now();
    const maxDur = Math.max(...balls.map((b) => b.dur));
    const step = (now: number): void => {
      if (this.over) return;
      const t = now - start;
      for (const b of balls) {
        if (!b.el) continue;
        const p = Math.min(1, t / b.dur);
        // 缓入：加速感
        const eased = p * p;
        b.el.style.transform = `translateX(${eased * TRACK}px)`;
      }
      if (t < maxDur + 120) {
        this.raf = requestAnimationFrame(step);
      } else {
        // 标记先到的
        const first = balls.reduce((a, c) => (c.dur < a.dur ? c : a));
        const res = this.root.querySelector("#rr2-result");
        if (res && first.el) {
          first.el.classList.add("rr2-ball--win");
          const label = ["A", "B", "C"][first.id] ?? String(first.id + 1);
          res.innerHTML = `<b>${label}</b> 最陡，最先到底！坡越陡滚得越快～`;
        }
        this.trackTimeout(() => this.nextRound(), 1300);
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  private nextRound(): void {
    this.roundsDone += 1;
    if (this.roundsDone >= this.roundTotal) {
      this.finishClear(starsByAccuracy(this.wrongCount));
    } else {
      this.startRound();
    }
  }

  private injectStyle(): void {
    if (document.getElementById("rr2-style")) return;
    const st = document.createElement("style");
    st.id = "rr2-style";
    st.textContent = RR2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function RR2_CSS(theme: string): string {
  return `
.rr2-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;}
.rr2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;max-width:440px;}
.rr2-task b{color:${theme};}
.rr2-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;background:#fff;padding:5px 16px;border-radius:999px;box-shadow:var(--shadow);}
.rr2-stage{display:flex;flex-direction:column;gap:6px;width:100%;max-width:440px;background:rgba(255,255,255,.5);border-radius:20px;padding:18px 14px 14px;box-shadow:var(--shadow);}
.rr2-lane{position:relative;height:64px;display:flex;align-items:center;gap:8px;}
.rr2-ramp{position:relative;left:6px;top:6px;width:160px;height:12px;background:linear-gradient(180deg,#a1887f,#6d4c41);border-radius:6px 6px 2px 2px;transform-origin:left center;transform:rotate(calc(-1 * var(--rr2-angle,30deg)));box-shadow:var(--shadow);border-bottom:3px solid #4e342e;}
/* 球放在坡顶（旋转后的右上端）。用绝对定位 + transform 控制下落 */
.rr2-ball{position:absolute;left:10px;top:8px;width:24px;height:24px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff6,${theme} 65%,color-mix(in srgb,${theme} 70%,#000));box-shadow:inset 0 -3px 4px rgba(0,0,0,.2),0 3px 4px rgba(0,0,0,.2);z-index:3;will-change:transform;}
.rr2-ball--win{animation:rr2-bounce .4s ease 2;}
@keyframes rr2-bounce{0%,100%{filter:brightness(1)}50%{filter:brightness(1.4) drop-shadow(0 0 6px ${theme})}}
.rr2-flag{position:absolute;left:176px;font-size:1.3rem;z-index:2;}
.rr2-pick{margin-left:auto;width:52px;height:52px;border:none;border-radius:14px;background:linear-gradient(160deg,#fff,#f0f0f5);font-size:1.5rem;font-weight:900;color:${theme};box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;border:3px solid transparent;}
.rr2-pick:active{transform:scale(.93);}
.rr2-pick--correct{border-color:#6bcf7f;background:#e8fbe8;animation:rr2-yes .4s ease;}
@keyframes rr2-yes{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
.rr2-pick--wrong{border-color:#ff6348;background:#ffeae6;animation:rr2-no .3s ease;}
@keyframes rr2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.rr2-result{font-size:.95rem;font-weight:800;color:var(--ink);text-align:center;min-height:1.4em;}
.rr2-result b{color:${theme};font-size:1.2rem;}
@media (max-width:380px){.rr2-ramp{width:130px;}.rr2-flag{left:146px;}.rr2-pick{width:44px;height:44px;font-size:1.2rem;}}
`;
}

export function create(): RampRollGame {
  return new RampRollGame();
}
