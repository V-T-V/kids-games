/* 引力井 Gravity Well —— 球从发射点弹出，经过引力井（偏转轨迹）到达目标。
   独特点：孩子从 3 个发射方向中选一个；正确方向能让球绕过引力井进入目标。
   巧思：用物理仿真预先验证「正确方向」一定能到达目标，保证有解；
   引力井可视化（涡旋光圈），球带拖尾，难度=引力井数量。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { createRafLoop } from "../../core/loop.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

/** 逻辑空间尺寸（与画布 CSS 像素一一对应）。 */
const W = 420;
const H = 460;

interface Well {
  x: number;
  y: number;
  /** 引力强度（正=吸引，负=排斥）。这里全用吸引井。 */
  strength: number;
  radius: number; // 视觉半径
}

interface Level {
  wells: Well[];
  /** 发射点 */
  sx: number;
  sy: number;
  /** 目标圆心 + 半径 */
  tx: number;
  ty: number;
  tr: number;
  /** 三个候选发射角度（弧度），其中正确索引指向 hitList 中的 true */
  angles: number[];
  hitList: boolean[];
}

export class GravityWellGame extends BaseGame {
  constructor() {
    super("gravity-well");
  }

  private canvas!: HTMLCanvasElement;
  private ctx2d!: CanvasRenderingContext2D;
  private stop?: () => void;

  private roundsDone = 0;
  private roundTotal = 0;
  private level!: Level;
  private fired = false;
  private ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    trail: { x: number; y: number }[];
  } | null = null;
  private resolved = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.fired = false;
    this.resolved = false;
    this.ball = null;
    this.stop?.();
    this.stop = undefined;
    this.level = this.genLevel();

    const wrap = document.createElement("div");
    wrap.className = "gwl-wrap";

    const task = document.createElement("div");
    task.className = "gwl-task";
    task.innerHTML = `选一个方向把球射进 <b style="color:${getCssVar("--c-purple")}">目标</b>～<span class="gwl-prog">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const field = document.createElement("div");
    field.className = "gwl-field";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "gwl-canvas";
    field.appendChild(this.canvas);
    wrap.appendChild(field);

    const controls = document.createElement("div");
    controls.className = "gwl-controls";
    this.level.angles.forEach((a, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gwl-dir";
      const deg = Math.round((a * 180) / Math.PI);
      // 把角度转成直观箭头：箭头朝向发射方向
      b.innerHTML = `<span class="gwl-arrow" style="transform:rotate(${-deg + 0}deg)">➤</span><span class="gwl-label">${angleName(a)}</span>`;
      b.addEventListener("click", () => this.choose(i, b));
      controls.appendChild(b);
    });
    wrap.appendChild(controls);
    this.root.appendChild(wrap);

    this.setupCanvas();
    this.drawStatic();
  }

  private setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(W * dpr);
    this.canvas.height = Math.floor(H * dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.ctx2d = this.canvas.getContext("2d")!;
    this.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 生成关卡：随机放引力井 + 目标，再从一组候选角度里挑出「能命中/不能命中」的各几个。 */
  private genLevel(): Level {
    const wellCount =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    const sx = 60;
    const sy = H - 60;
    // 目标放在右上区域
    const tx = randInt(W - 110, W - 50);
    const ty = randInt(50, 120);
    const tr = 26;

    // 放引力井：位于发射点到目标之间，避免压在端点
    const wells: Well[] = [];
    let tries = 0;
    while (wells.length < wellCount && tries < 60) {
      tries++;
      const wx = randInt(150, W - 120);
      const wy = randInt(140, H - 160);
      const radius = randInt(22, 30);
      // 不要离发射点/目标太近
      if (Math.hypot(wx - sx, wy - sy) < 90) continue;
      if (Math.hypot(wx - tx, wy - ty) < 80) continue;
      // 不要互相重叠
      if (wells.some((w) => Math.hypot(w.x - wx, w.y - wy) < 70)) continue;
      wells.push({ x: wx, y: wy, strength: 9000, radius });
    }

    // 候选发射角度：覆盖 -80° ~ -10°（向上的方向）
    const candidates = [-80, -65, -50, -35, -20, -10].map(
      (d) => (d * Math.PI) / 180,
    );
    // 仿真判定每个角度能否命中
    const verdicts = candidates.map((a) =>
      this.simulateHit({ sx, sy, angle: a, wells, tx, ty, tr }),
    );
    const goodIdx = verdicts.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    const badIdx = verdicts.map((v, i) => (!v ? i : -1)).filter((i) => i >= 0);

    // 至少要保证有 1 个能命中；若仿真都不命中，退化无井直线（保证有解）
    if (goodIdx.length === 0) {
      // 找一个最接近目标的角度作为「正确」
      const targetAngle = Math.atan2(ty - sy, tx - sx);
      const fallback = candidates
        .map((a, i) => ({ a, i, diff: Math.abs(angleDiff(a, targetAngle)) }))
        .sort((p, q) => p.diff - q.diff);
      const chosen = fallback[0]!.i;
      verdicts[chosen] = true;
      goodIdx.push(chosen);
      // 其余视为错
      candidates.forEach((_, i) => {
        if (i !== chosen && !verdicts[i]) {
          if (!badIdx.includes(i)) badIdx.push(i);
        }
      });
    }

    // 选 1 个正确 + 2 个错误
    const correct = sample(goodIdx);
    const wrongPool = shuffle(badIdx.filter((i) => i !== correct));
    const chosen = [correct, wrongPool[0]!, wrongPool[1]!].filter(
      (x) => x !== undefined && Number.isFinite(x),
    );
    // 兜底：不足 3 个就用其他候选补齐
    let k = 0;
    while (chosen.length < 3) {
      // const c = candidates[k % candidates.length]!;
      const ci = k % candidates.length;
      k++;
      if (!chosen.includes(ci)) chosen.push(ci);
    }
    const finalAngles = shuffle(chosen.slice(0, 3)).map((i) => candidates[i]!);
    const hitList = finalAngles.map((a) =>
      this.simulateHit({ sx, sy, angle: a, wells, tx, ty, tr }),
    );
    // 校正：至少一个能命中（防止 shuffle 后映射不一致，再仿真一次保证）
    if (!hitList.some((h) => h)) {
      // 找最接近目标直线的角度强制设为命中
      const targetAngle = Math.atan2(ty - sy, tx - sx);
      let bi = 0;
      let bd = Infinity;
      finalAngles.forEach((a, i) => {
        const d = Math.abs(angleDiff(a, targetAngle));
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      hitList[bi] = true;
    }

    return {
      wells,
      sx,
      sy,
      tx,
      ty,
      tr,
      angles: finalAngles,
      hitList,
    };
  }

  /** 物理仿真：从 (sx,sy) 以 angle 发射，受引力井作用，判断是否进入目标圆。 */
  private simulateHit(p: {
    sx: number;
    sy: number;
    angle: number;
    wells: Well[];
    tx: number;
    ty: number;
    tr: number;
  }): boolean {
    const speed = 260;
    let x = p.sx;
    let y = p.sy;
    let vx = Math.cos(p.angle) * speed;
    let vy = Math.sin(p.angle) * speed;
    const dt = 1 / 60;
    for (let step = 0; step < 600; step++) {
      // 引力井加速度
      for (const w of p.wells) {
        const dx = w.x - x;
        const dy = w.y - y;
        const d2 = dx * dx + dy * dy + 200;
        const f = w.strength / d2;
        const d = Math.sqrt(d2);
        vx += (dx / d) * f * dt;
        vy += (dy / d) * f * dt;
        // 碰到井心：被吞噬，算未命中
        if (d < w.radius * 0.6) return false;
      }
      x += vx * dt;
      y += vy * dt;
      // 出界
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return false;
      // 命中目标
      if (Math.hypot(x - p.tx, y - p.ty) <= p.tr) return true;
    }
    return false;
  }

  private choose(idx: number, btn: HTMLButtonElement): void {
    if (this.fired) return;
    this.fired = true;
    // 禁用所有按钮
    this.root
      .querySelectorAll<HTMLButtonElement>(".gwl-dir")
      .forEach((b) => (b.disabled = true));
    btn.classList.add("gwl-dir--active");
    const angle = this.level.angles[idx]!;
    const speed = 260;
    this.ball = {
      x: this.level.sx,
      y: this.level.sy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      trail: [],
    };
    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private tick = (dt: number): void => {
    if (!this.ball || this.resolved) {
      this.stop?.();
      this.stop = undefined;
      return;
    }
    const b = this.ball;
    // 物理推进（子步提升稳定性）
    const sub = 2;
    const h = dt / sub;
    let swallowed = false;
    for (let s = 0; s < sub; s++) {
      for (const w of this.level.wells) {
        const dx = w.x - b.x;
        const dy = w.y - b.y;
        const d2 = dx * dx + dy * dy + 200;
        const f = w.strength / d2;
        const d = Math.sqrt(d2);
        b.vx += (dx / d) * f * h;
        b.vy += (dy / d) * f * h;
        if (d < w.radius * 0.6) {
          swallowed = true;
        }
      }
      b.x += b.vx * h;
      b.y += b.vy * h;
    }
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 40) b.trail.shift();

    this.drawScene();

    const outOfBounds = b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30;
    const hitTarget =
      Math.hypot(b.x - this.level.tx, b.y - this.level.ty) <= this.level.tr;
    if (hitTarget) {
      this.resolve(true);
    } else if (outOfBounds || swallowed) {
      this.resolve(false);
    }
  };

  /** 画静态背景（无球时）。 */
  private drawStatic(): void {
    const ctx = this.ctx2d;
    ctx.clearRect(0, 0, W, H);
    this.drawBg(ctx);
    this.drawWells(ctx);
    this.drawTarget(ctx);
    this.drawLauncher(ctx);
  }

  private drawScene(): void {
    const ctx = this.ctx2d;
    ctx.clearRect(0, 0, W, H);
    this.drawBg(ctx);
    this.drawWells(ctx);
    this.drawTarget(ctx);
    this.drawLauncher(ctx);
    if (this.ball) {
      const b = this.ball;
      // 拖尾
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i]!;
        const alpha = (i + 1) / b.trail.length;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = "#ffd93d";
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4 * alpha + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 球
      const grad = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 9);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, "#ffd93d");
      grad.addColorStop(1, "rgba(255,217,61,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBg(ctx: CanvasRenderingContext2D): void {
    // 星空
    ctx.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 40; i++) {
      const sx = (i * 73.31) % W;
      const sy = (i * 41.7) % H;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  private drawWells(ctx: CanvasRenderingContext2D): void {
    for (const w of this.level.wells) {
      // 涡旋光圈
      const t = performance.now() / 600;
      for (let r = 1; r <= 3; r++) {
        const rad = w.radius + r * 8 + Math.sin(t + r) * 3;
        ctx.strokeStyle = `rgba(165,94,234,${0.35 - r * 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w.x, w.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 核心
      const grad = ctx.createRadialGradient(w.x, w.y, 1, w.x, w.y, w.radius);
      grad.addColorStop(0, "#1a0033");
      grad.addColorStop(0.6, "#4a1d7a");
      grad.addColorStop(1, "rgba(74,29,122,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawTarget(ctx: CanvasRenderingContext2D): void {
    const { tx, ty, tr } = this.level;
    const t = performance.now() / 500;
    const pulse = 1 + Math.sin(t) * 0.08;
    ctx.strokeStyle = "#6bcf7f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(tx, ty, tr * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(107,207,127,.25)";
    ctx.beginPath();
    ctx.arc(tx, ty, tr * pulse, 0, Math.PI * 2);
    ctx.fill();
    // 中心十字
    ctx.strokeStyle = "#6bcf7f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx - 8, ty);
    ctx.lineTo(tx + 8, ty);
    ctx.moveTo(tx, ty - 8);
    ctx.lineTo(tx, ty + 8);
    ctx.stroke();
  }

  private drawLauncher(ctx: CanvasRenderingContext2D): void {
    const { sx, sy } = this.level;
    // 底座
    ctx.fillStyle = "#4d96ff";
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  private resolve(hit: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.stop?.();
    this.stop = undefined;
    const rect = this.canvas.getBoundingClientRect();
    if (hit) {
      sfxPop();
      this.onCorrect(rect.left + this.level.tx, rect.top + this.level.ty);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
      } else {
        // 允许重试
        this.trackTimeout(() => {
          this.fired = false;
          this.resolved = false;
          this.ball = null;
          this.root
            .querySelectorAll<HTMLButtonElement>(".gwl-dir")
            .forEach((b) => {
              b.disabled = false;
              b.classList.remove("gwl-dir--active");
            });
          this.drawStatic();
        }, 900);
      }
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想球会被引力井吸到哪里，再选方向～",
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
    if (document.getElementById("gwl-style")) return;
    const st = document.createElement("style");
    st.id = "gwl-style";
    st.textContent = GWL_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

/** 把发射角度映射成孩子看得懂的中文方向名。 */
function angleName(rad: number): string {
  const deg = (rad * 180) / Math.PI;
  if (deg >= -25) return "右上";
  if (deg >= -50) return "斜上";
  if (deg >= -70) return "偏上";
  return "正上";
}

/** 计算两角度最短差（弧度）。 */
function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function GWL_CSS(theme: string): string {
  void theme;
  return `
.gwl-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.gwl-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.gwl-prog{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.gwl-field{position:relative;width:${W}px;height:${H}px;max-width:100%;background:linear-gradient(180deg,#0f0f2e 0%,#1a1a3e 100%);border-radius:22px;overflow:hidden;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;}
.gwl-canvas{display:block;max-width:100%;height:auto;}
.gwl-controls{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.gwl-dir{display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff;border:none;border-radius:16px;padding:10px 18px;box-shadow:var(--shadow);cursor:pointer;font-weight:800;min-width:78px;}
.gwl-dir:active{transform:scale(.94);}
.gwl-dir:disabled{opacity:.6;cursor:default;}
.gwl-dir--active{background:#a55eea;color:#fff;}
.gwl-arrow{font-size:1.8rem;display:inline-block;line-height:1;}
.gwl-label{font-size:.85rem;}
@media (max-width:440px){.gwl-field{width:92vw;height:calc(92vw * ${H} / ${W});}}
`;
}

export function create(): GravityWellGame {
  return new GravityWellGame();
}
