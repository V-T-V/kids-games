/* 跳绳 Jump Rope —— RAF 驱动：绳子绕着旋转，到最低点（触地）时点"跳"，
   早了/晚了就绊倒重开本关。节奏感 + 反应。
   独特点：用旋转的绳子做节奏判定窗口，跳成功累计计数，达标通关。
   前缀 jrp-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

export class JumpRopeGame extends BaseGame {
  constructor() {
    super("jump-rope");
  }

  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private won = false;
  private angle = 0; // 0 = 后方，π = 前方触地
  private speed = 0; // rad/s
  private jumped = 0;
  private need = 0;
  private jumpedThisCycle = false;
  private charY = 0; // 跳起高度
  private charVy = 0;
  private jumping = false;
  private cleanupBtn: (() => void) | null = null;

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
    this.cleanupBtn?.();
    this.cleanupBtn = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.won = false;
    this.jumped = 0;
    this.angle = 0;
    this.jumpedThisCycle = false;
    this.charY = 0;
    this.charVy = 0;
    this.jumping = false;
    this.cleanupBtn = null;

    this.need =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 10;
    this.speed =
      this.difficulty === "easy" ? 3.2 : this.difficulty === "medium" ? 4 : 4.8;

    const wrap = document.createElement("div");
    wrap.className = "jrp-wrap";
    const task = document.createElement("div");
    task.className = "jrp-task";
    task.innerHTML = `绳子落地时<b>跳！</b>跳满 <b id="jrp-cnt">0 / ${this.need}</b>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "jrp-stage";
    stage.innerHTML = `
      <div class="jrp-ground"></div>
      <svg class="jrp-svg" viewBox="0 0 300 220" preserveAspectRatio="xMidYMid meet">
        <path id="jrp-rope" class="jrp-rope" d="" />
        <circle id="jrp-handle-l" class="jrp-handle" cx="40" cy="120" r="8"/>
        <circle id="jrp-handle-r" class="jrp-handle" cx="260" cy="120" r="8"/>
      </svg>
      <div class="jrp-char" id="jrp-char">🐰</div>
    `;
    wrap.appendChild(stage);

    const jumpBtn = document.createElement("button");
    jumpBtn.type = "button";
    jumpBtn.className = "jrp-btn";
    jumpBtn.textContent = "🦘 跳！";
    wrap.appendChild(jumpBtn);
    this.root.appendChild(wrap);

    const onJump = (e: Event) => {
      e.preventDefault();
      this.tryJump();
    };
    jumpBtn.addEventListener("pointerdown", onJump);
    this.cleanupBtn = () => jumpBtn.removeEventListener("pointerdown", onJump);

    requestAnimationFrame(() => {
      this.last = performance.now();
      this.loop();
    });
  }

  private tryJump(): void {
    if (this.over || this.won) return;
    // 判定窗口：绳子接近最低点（前方触地，angle 接近 π）
    // angle 周期 0~2π，π 时绳子在前方触地
    const norm = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const dist = Math.abs(norm - Math.PI);
    // 起跳动画
    if (!this.jumping) {
      this.jumping = true;
      this.charVy = 360; // 向上初速
    }
    if (dist < 0.5) {
      // 命中
      if (!this.jumpedThisCycle) {
        this.jumpedThisCycle = true;
        this.jumped++;
        sfxPop();
        const cnt = this.root.querySelector("#jrp-cnt");
        if (cnt) cnt.textContent = `${this.jumped} / ${this.need}`;
        const charEl = this.root.querySelector("#jrp-char");
        if (charEl) charEl.classList.add("jrp-char--good");
        this.trackTimeout(
          () => charEl?.classList.remove("jrp-char--good"),
          250,
        );
        if (this.jumped >= this.need) this.win();
      }
    } else if (dist < 1.0) {
      // 略早/略晚：轻微提示，不计成功也不算失败（宽容）
      sfxTick();
    } else {
      // 太早/太晚：绊倒
      this.trip();
    }
  }

  private loop = (): void => {
    if (this.over || this.won) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 绳子旋转
    this.angle += this.speed * dt;
    const norm = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    // 每完成一周（从后方 π→2π→0）重置 jumpedThisCycle 标志（绳子到后方时）
    if (norm < 0.5 && this.jumpedThisCycle) {
      this.jumpedThisCycle = false;
    }

    // 计算绳子路径：椭圆，最低点在 angle=π（前方）和 angle=0（后方）
    // 这里用简单椭圆：rx=110, ry=70，中心 (150, 110)
    // angle=π 时点在前方下方 (260, ~180)；angle=0 时在后方 (40, ~120)
    // 绳子位置（中点轨迹）
    const cx = 150;
    const cy = 110;
    const rx = 110;
    const ry = 70;
    // 绳子两端固定在手柄 (40,120) 和 (260,120)，中点沿椭圆运动
    const midX = cx + rx * Math.cos(norm);
    const midY = cy + ry * Math.sin(norm);
    const path = document.getElementById("jrp-rope");
    if (path) {
      // 用二次贝塞尔：从左柄经中点到右柄
      path.setAttribute("d", `M 40 120 Q ${midX} ${midY * 2 - 120} 260 120`);
    }

    // 跳跃物理
    if (this.jumping) {
      this.charVy -= 900 * dt; // 重力
      this.charY += this.charVy * dt;
      if (this.charY <= 0) {
        this.charY = 0;
        this.charVy = 0;
        this.jumping = false;
      }
    }
    const charEl = document.getElementById("jrp-char");
    if (charEl) {
      charEl.style.transform = `translate(-50%, ${-this.charY}px)`;
    }

    // 绳子触地瞬间（前方最低点）未跳 -> 绊倒判定
    // 当绳子中点接近角色脚部且角色没跳起
    if (
      norm > Math.PI - 0.25 &&
      norm < Math.PI + 0.25 &&
      this.charY < 20 &&
      !this.jumpedThisCycle
    ) {
      // 绳子扫过脚但没起跳 -> 绊倒
      this.trip();
      return;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    if (this.over || this.won) return;
    this.won = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const stage = this.root.querySelector(".jrp-stage");
    const rect = stage
      ? stage.getBoundingClientRect()
      : new DOMRect(window.innerWidth / 2, window.innerHeight / 2);
    this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
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

  private trip(): void {
    if (this.over || this.won) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const charEl = document.getElementById("jrp-char");
    if (charEl) charEl.classList.add("jrp-char--trip");
    const paused = this.onWrong();
    if (paused) this.showRest();
    else this.trackTimeout(() => this.startRound(), 900);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🪢",
      variant: "rest",
      body: "被绳子绊到啦，看准时机再跳！",
      primary: {
        text: "再跳一次",
        icon: "🦘",
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
    if (document.getElementById("jrp-style")) return;
    const st = document.createElement("style");
    st.id = "jrp-style";
    st.textContent = JRP_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function JRP_CSS(theme: string): string {
  return `
.jrp-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.jrp-task{font-size:1.05rem;font-weight:800;color:var(--ink);background:#fff;padding:6px 18px;border-radius:999px;box-shadow:var(--shadow);}
.jrp-task b{color:${theme};}
.jrp-stage{position:relative;width:300px;height:260px;background:linear-gradient(180deg,#e0f7ff 0%,#fff 60%,#c8efd8 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.jrp-ground{position:absolute;left:0;right:0;bottom:30px;height:30px;background:linear-gradient(180deg,#a8d8a0,#7ec47a);border-radius:0 0 20px 20px;}
.jrp-svg{position:absolute;inset:0;width:100%;height:100%;}
.jrp-rope{fill:none;stroke:${theme};stroke-width:4;stroke-linecap:round;filter:drop-shadow(0 2px 2px rgba(0,0,0,.15));}
.jrp-handle{fill:#7a4a3a;}
.jrp-char{position:absolute;left:50%;bottom:48px;font-size:2.6rem;line-height:1;transform:translateX(-50%);z-index:3;will-change:transform;transition:filter .2s;}
.jrp-char--good{filter:drop-shadow(0 0 8px #6bcf7f);}
.jrp-char--trip{animation:jrp-trip .5s ease;}
@keyframes jrp-trip{0%{transform:translateX(-50%) rotate(0)}100%{transform:translateX(-50%) translateY(8px) rotate(70deg)}}
.jrp-btn{padding:18px 56px;border:none;border-radius:999px;background:linear-gradient(135deg,${theme},#ff8fb1);color:#fff;font-size:1.5rem;font-weight:900;box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;transition:transform .08s;}
.jrp-btn:active{transform:scale(.93);}
@media (max-width:380px){.jrp-stage{width:260px;height:230px;}.jrp-char{font-size:2.2rem;}}
`;
}

export function create(): JumpRopeGame {
  return new JumpRopeGame();
}
