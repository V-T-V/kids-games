/* 海豚跳圈 Dolphin Jump —— 海豚在海面游，圆圈从右方移来，
   点击屏幕让海豚跳起穿过圆圈。穿过的判定：圆圈中心经过海豚 x 时，
   海豚 y 在圆环高度区间内。
   独特点：时机点击 + 海洋视差（水波滚动、气泡上浮）。
   通关 = 穿过目标圆圈数。没穿过本关重开（不整体失败）。
   RAF 驱动，unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Ring {
  x: number;
  y: number;
  passed: boolean;
  el: HTMLDivElement;
}

export class DolphinJumpGame extends BaseGame {
  constructor() {
    super("dolphin-jump");
  }

  private sea!: HTMLDivElement;
  private dolphin!: HTMLDivElement;
  private rings: Ring[] = [];
  /** 海豚 y（px，相对 sea 顶部）。越大越靠下。 */
  private dy = 0;
  private vy = 0;
  private groundY = 0;
  private score = 0;
  private need = 0;
  private speed = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private cleared = false;
  private bubbleX = 0;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.rings = [];
    this.score = 0;
    this.over = false;
    this.cleared = false;
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.speed =
      this.difficulty === "easy"
        ? 150
        : this.difficulty === "medium"
          ? 190
          : 235;

    const wrap = document.createElement("div");
    wrap.className = "dj-wrap";

    const task = document.createElement("div");
    task.className = "dj-task";
    task.innerHTML = `点屏幕让海豚跳，穿过 <b>${this.need}</b> 个圈 · <span id="dj-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.sea = document.createElement("div");
    this.sea.className = "dj-sea";

    // 气泡背景
    const bubbles = document.createElement("div");
    bubbles.className = "dj-bubbles";
    bubbles.id = "dj-bubbles";
    this.sea.appendChild(bubbles);

    this.dolphin = document.createElement("div");
    this.dolphin.className = "dj-dolphin";
    this.dolphin.textContent = "🐬";
    this.sea.appendChild(this.dolphin);

    // 计分进度条
    const rail = document.createElement("div");
    rail.className = "dj-rail";
    for (let i = 0; i < this.need; i++) {
      const dot = document.createElement("span");
      dot.className = "dj-rail-dot";
      rail.appendChild(dot);
    }
    this.sea.appendChild(rail);

    wrap.appendChild(this.sea);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.sea, { down: () => this.jump() });

    requestAnimationFrame(() => {
      const r = this.sea.getBoundingClientRect();
      this.groundY = r.height - 56;
      this.dy = this.groundY;
      this.vy = 0;
      this.bubbleX = 0;
      this.last = performance.now();
      // 第一圈给一点缓冲时间再生成
      this.trackTimeout(() => this.spawnRing(), 500);
      this.loop();
    });
  }

  private jump(): void {
    if (this.over || this.cleared) return;
    if (this.dy >= this.groundY - 1) {
      this.vy = -380;
      sfxPop();
      this.dolphin.classList.remove("dj-dolphin--spin");
      // 强制重排以重启动画
      void this.dolphin.offsetWidth;
      this.dolphin.classList.add("dj-dolphin--spin");
    }
  }

  private spawnRing(): void {
    if (this.over || this.cleared) return;
    const r = this.sea.getBoundingClientRect();
    const x = r.width + 40;
    // 圈高度随机但保证可被跳到：跳起最高点约 groundY-130，留余量
    const y = this.groundY - 40 - Math.random() * 90;
    const el = document.createElement("div");
    el.className = "dj-ring";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.sea.appendChild(el);
    this.rings.push({ x, y, passed: false, el });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 物理
    this.vy += 1200 * dt;
    this.dy += this.vy * dt;
    if (this.dy > this.groundY) {
      this.dy = this.groundY;
      this.vy = 0;
    }
    this.dolphin.style.top = `${this.dy - 34}px`;

    // 气泡背景滚动
    this.bubbleX = (this.bubbleX - this.speed * 0.4 * dt) % 60;
    this.sea.style.setProperty("--dj-bubble", `${this.bubbleX}px`);
    this.sea.style.setProperty("--dj-wave", `${(this.bubbleX * 2) % 120}px`);

    const dolphinX = 64;
    const ringHalf = 32; // 圈半径
    const dolphinHalf = 28;

    // 圈移动 + 穿过判定
    for (const ring of this.rings) {
      ring.x -= this.speed * dt;
      ring.el.style.left = `${ring.x}px`;
      if (
        !ring.passed &&
        Math.abs(ring.x - dolphinX) < ringHalf + dolphinHalf - 12
      ) {
        // 圈经过海豚 x 时，海豚 y 需在圈高度区间
        if (Math.abs(this.dy - 34 - (ring.y + ringHalf)) < ringHalf + 14) {
          ring.passed = true;
          ring.el.classList.add("dj-ring--pass");
          this.score += 1;
          sfxPop();
          const sc = this.root.querySelector("#dj-score");
          if (sc) sc.textContent = `${this.score} / ${this.need}`;
          const dots = this.root.querySelectorAll(".dj-rail-dot");
          const d = dots[this.score - 1];
          if (d) d.classList.add("dj-rail-dot--on");
          this.onCorrect(ring.x, ring.y + ringHalf);
          if (this.score >= this.need) {
            this.win();
            return;
          }
        }
      }
    }
    // 移除离场圈
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]!;
      if (ring.x < -80) {
        ring.el.remove();
        this.rings.splice(i, 1);
        // 漏掉未穿过的圈：重开本关（保证必须穿过目标数）
        if (!ring.passed) {
          this.miss();
          return;
        }
      }
    }
    // 生成下一圈：保证间距合理（可解），间距随难度收紧但 > 跳跃落地周期
    const last = this.rings[this.rings.length - 1];
    const minGap = this.difficulty === "hard" ? 180 : 230;
    const r = this.sea.getBoundingClientRect();
    if (!last || r.width - last.x > minGap) {
      this.spawnRing();
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    this.cleared = true;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resetWrongStreak();
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount, [0, 2]));
      } else {
        this.startRound();
      }
    }, 600);
  }

  /** 漏圈：温柔提示并重开本关。 */
  private miss(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.dolphin.classList.add("dj-dolphin--sad");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      this.trackTimeout(() => this.startRound(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "圈圈漂走啦，看准时机再跳～",
      primary: {
        text: "再试一次",
        icon: "🐬",
        onClick: () => {
          ov.destroy();
          this.startRound();
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
    if (document.getElementById("dj-style")) return;
    const st = document.createElement("style");
    st.id = "dj-style";
    st.textContent = DJ_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function DJ_CSS(theme: string): string {
  return `
.dj-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.dj-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.dj-task b{color:${theme};}
.dj-sea{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#7ec8f0 0%,#3aa7d6 52%,#1f7fb5 56%,#0e5e8a 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
/* 水面波纹 */
.dj-sea::before{content:"";position:absolute;left:var(--dj-wave,0);top:52%;height:6px;width:calc(100% + 240px);background:repeating-linear-gradient(90deg,rgba(255,255,255,.5) 0 30px,transparent 30px 120px);z-index:2;pointer-events:none;}
.dj-bubbles{position:absolute;inset:0;background-image:radial-gradient(circle at 20% 80%,rgba(255,255,255,.35) 0 4px,transparent 5px),radial-gradient(circle at 60% 70%,rgba(255,255,255,.25) 0 3px,transparent 4px),radial-gradient(circle at 80% 90%,rgba(255,255,255,.3) 0 5px,transparent 6px);background-repeat:repeat;background-position:var(--dj-bubble,0) 0;z-index:1;pointer-events:none;}
.dj-dolphin{position:absolute;left:64px;top:0;transform:translateX(-50%);font-size:2.6rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));will-change:top;}
.dj-dolphin--spin{animation:dj-spin .6s ease;}
@keyframes dj-spin{0%{transform:translateX(-50%) rotate(0)}60%{transform:translateX(-50%) rotate(-18deg)}100%{transform:translateX(-50%) rotate(0)}}
.dj-dolphin--sad{animation:dj-sad .8s ease forwards;}
@keyframes dj-sad{to{opacity:.4;transform:translateX(-50%) rotate(20deg) translateY(20px);}}
.dj-ring{position:absolute;width:64px;height:64px;border-radius:50%;border:8px solid ${theme};background:radial-gradient(circle,rgba(255,255,255,.15),transparent 70%);box-shadow:0 4px 12px rgba(0,0,0,.25),inset 0 0 8px rgba(255,255,255,.4);z-index:4;will-change:left,top;}
.dj-ring--pass{border-color:#6bcf7f;animation:dj-pass .4s ease;}
@keyframes dj-pass{0%{transform:scale(1)}50%{transform:scale(1.35)}100%{transform:scale(1)}}
.dj-rail{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:flex;gap:8px;z-index:6;}
.dj-rail-dot{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.5);box-shadow:0 1px 2px rgba(0,0,0,.2);transition:background .2s,transform .2s;}
.dj-rail-dot--on{background:#ffd93d;transform:scale(1.3);}
@media (max-width:380px){.dj-task{font-size:.95rem;}.dj-dolphin{font-size:2.2rem;}.dj-ring{width:56px;height:56px;border-width:7px;}}
`;
}

export function create(): DolphinJumpGame {
  return new DolphinJumpGame();
}
