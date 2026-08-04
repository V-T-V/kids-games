/* 涂色画 Color Fill —— 给线稿的不同区域填色（选颜色，点区域）。
   艺术启蒙：色彩搭配 + 精细点击。独特点：Canvas 预绘线稿，区域用 flood-fill
   算法上色（扫描线，性能好）。线稿图样保证有多个封闭区域可填。
   通关=填完 N 个区域（不强制全填，避免卡住）。前缀 cfl-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar } from "../../lobby/util.ts";

const COLORS = [
  "#ff6b6b",
  "#ffd93d",
  "#4d96ff",
  "#6bcf7f",
  "#a55eea",
  "#ff9f43",
  "#ff6b9d",
  "#22d3ee",
];

/** 在 Canvas 上绘制一张线稿，返回可填区域的代表像素点。
 *  theme 0: 小花 + 太阳；theme 1: 小房子 + 大树；theme 2: 帆船 + 鱼。 */
function drawOutline(
  c2d: CanvasRenderingContext2D,
  W: number,
  H: number,
  theme = 0,
): { x: number; y: number }[] {
  if (theme === 1) return drawHouseTree(c2d, W, H);
  if (theme === 2) return drawBoatFish(c2d, W, H);
  return drawFlowerSun(c2d, W, H);
}

/** 背景底色（白 + 草地 + 天空）。 */
function drawBackdrop(
  c2d: CanvasRenderingContext2D,
  W: number,
  H: number,
): void {
  c2d.fillStyle = "#ffffff";
  c2d.fillRect(0, 0, W, H);
  c2d.fillStyle = "#eaf6e8";
  c2d.fillRect(0, H * 0.7, W, H * 0.3);
  c2d.fillStyle = "#eef6ff";
  c2d.fillRect(0, 0, W, H * 0.7);
}

function setInk(c2d: CanvasRenderingContext2D): void {
  c2d.strokeStyle = "#2a2a3a";
  c2d.lineWidth = 3;
  c2d.lineJoin = "round";
  c2d.lineCap = "round";
}

/** theme 0：小花 + 太阳 + 草地。 */
function drawFlowerSun(
  c2d: CanvasRenderingContext2D,
  W: number,
  H: number,
): { x: number; y: number }[] {
  drawBackdrop(c2d, W, H);
  setInk(c2d);

  const cx = W / 2;
  const sunX = W * 0.18;
  const sunY = H * 0.2;
  const sunR = 28;
  c2d.beginPath();
  c2d.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  c2d.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c2d.beginPath();
    c2d.moveTo(
      sunX + Math.cos(a) * (sunR + 4),
      sunY + Math.sin(a) * (sunR + 4),
    );
    c2d.lineTo(
      sunX + Math.cos(a) * (sunR + 14),
      sunY + Math.sin(a) * (sunR + 14),
    );
    c2d.stroke();
  }

  c2d.beginPath();
  c2d.moveTo(cx, H * 0.55);
  c2d.lineTo(cx, H * 0.85);
  c2d.stroke();
  c2d.beginPath();
  c2d.ellipse(cx - 22, H * 0.7, 18, 9, -0.5, 0, Math.PI * 2);
  c2d.stroke();
  const fcy = H * 0.42;
  const petalR = 20;
  const petalDist = 30;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    c2d.beginPath();
    c2d.ellipse(
      cx + Math.cos(a) * petalDist,
      fcy + Math.sin(a) * petalDist,
      petalR,
      petalR * 0.7,
      a,
      0,
      Math.PI * 2,
    );
    c2d.stroke();
  }
  c2d.beginPath();
  c2d.arc(cx, fcy, 16, 0, Math.PI * 2);
  c2d.stroke();

  c2d.beginPath();
  c2d.moveTo(0, H * 0.7);
  for (let x = 0; x <= W; x += 20) {
    c2d.lineTo(x, H * 0.7 + Math.sin(x * 0.05) * 6);
  }
  c2d.stroke();

  return [
    { x: Math.round(sunX), y: Math.round(sunY) },
    { x: Math.round(cx), y: Math.round(fcy) },
    { x: Math.round(cx + petalDist), y: Math.round(fcy) },
    { x: Math.round(cx - petalDist), y: Math.round(fcy) },
    { x: Math.round(cx), y: Math.round(fcy - petalDist) },
    { x: Math.round(cx), y: Math.round(fcy + petalDist) },
    { x: Math.round(cx - 22), y: Math.round(H * 0.7) },
    { x: Math.round(cx + 60), y: Math.round(H * 0.78) },
    { x: Math.round(W * 0.8), y: Math.round(H * 0.25) },
  ];
}

/** theme 1：小房子 + 大树。 */
function drawHouseTree(
  c2d: CanvasRenderingContext2D,
  W: number,
  H: number,
): { x: number; y: number }[] {
  drawBackdrop(c2d, W, H);
  setInk(c2d);

  // 房子主体（左边）
  const hx = W * 0.22;
  const hy = H * 0.5;
  const hw = 110;
  const hh = 100;
  c2d.strokeRect(hx, hy, hw, hh);
  // 屋顶（三角形）
  c2d.beginPath();
  c2d.moveTo(hx - 14, hy);
  c2d.lineTo(hx + hw / 2, hy - 70);
  c2d.lineTo(hx + hw + 14, hy);
  c2d.stroke();
  // 门
  c2d.strokeRect(hx + hw / 2 - 16, hy + hh - 48, 32, 48);
  // 窗
  c2d.strokeRect(hx + 14, hy + 14, 30, 30);

  // 大树（右边）：树冠（多个圆）+ 树干
  const tx = W * 0.72;
  const trunkX = tx;
  const trunkTopY = H * 0.55;
  c2d.strokeRect(trunkX - 10, trunkTopY, 20, 70);
  const crownR = 38;
  const crownCy = H * 0.4;
  const crownCenters: [number, number][] = [
    [tx, crownCy],
    [tx - crownR, crownCy + 8],
    [tx + crownR, crownCy + 8],
    [tx, crownCy - crownR + 8],
  ];
  for (const [ccx, ccy] of crownCenters) {
    c2d.beginPath();
    c2d.arc(ccx, ccy, crownR, 0, Math.PI * 2);
    c2d.stroke();
  }

  c2d.beginPath();
  c2d.moveTo(0, H * 0.7);
  for (let x = 0; x <= W; x += 20) {
    c2d.lineTo(x, H * 0.7 + Math.sin(x * 0.05) * 6);
  }
  c2d.stroke();

  return [
    { x: Math.round(hx + hw / 2), y: Math.round(hy + hh / 2) }, // 房身
    { x: Math.round(hx + hw / 2), y: Math.round(hy - 22) }, // 屋顶
    { x: Math.round(hx + hw / 2), y: Math.round(hy + hh - 24) }, // 门
    { x: Math.round(hx + 29), y: Math.round(hy + 29) }, // 窗
    { x: Math.round(tx), y: Math.round(crownCy) }, // 树冠中心
    { x: Math.round(tx - crownR), y: Math.round(crownCy + 8) }, // 树冠左
    { x: Math.round(tx + crownR), y: Math.round(crownCy + 8) }, // 树冠右
    { x: Math.round(trunkX), y: Math.round(trunkTopY + 35) }, // 树干
    { x: Math.round(W * 0.85), y: Math.round(H * 0.78) }, // 草地
  ];
}

/** theme 2：帆船 + 鱼（海面）。 */
function drawBoatFish(
  c2d: CanvasRenderingContext2D,
  W: number,
  H: number,
): { x: number; y: number }[] {
  drawBackdrop(c2d, W, H);
  setInk(c2d);

  // 海面波浪
  const seaY = H * 0.55;
  c2d.beginPath();
  c2d.moveTo(0, seaY);
  for (let x = 0; x <= W; x += 20) {
    c2d.lineTo(x, seaY + Math.sin(x * 0.06) * 5);
  }
  c2d.stroke();

  // 帆船（左中）：船身梯形 + 桅杆 + 帆（三角）
  const bx = W * 0.35;
  const hullTopY = seaY - 6;
  c2d.beginPath();
  c2d.moveTo(bx - 60, hullTopY);
  c2d.lineTo(bx + 60, hullTopY);
  c2d.lineTo(bx + 42, hullTopY + 30);
  c2d.lineTo(bx - 42, hullTopY + 30);
  c2d.closePath();
  c2d.stroke();
  // 桅杆
  const mastX = bx;
  c2d.beginPath();
  c2d.moveTo(mastX, hullTopY);
  c2d.lineTo(mastX, hullTopY - 70);
  c2d.stroke();
  // 帆
  c2d.beginPath();
  c2d.moveTo(mastX, hullTopY - 70);
  c2d.lineTo(mastX + 44, hullTopY);
  c2d.lineTo(mastX, hullTopY);
  c2d.closePath();
  c2d.stroke();

  // 太阳（右上）
  const sunX = W * 0.84;
  const sunY = H * 0.18;
  const sunR = 26;
  c2d.beginPath();
  c2d.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  c2d.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c2d.beginPath();
    c2d.moveTo(
      sunX + Math.cos(a) * (sunR + 4),
      sunY + Math.sin(a) * (sunR + 4),
    );
    c2d.lineTo(
      sunX + Math.cos(a) * (sunR + 14),
      sunY + Math.sin(a) * (sunR + 14),
    );
    c2d.stroke();
  }

  // 鱼（右下，海里）：身体椭圆 + 尾三角
  const fx = W * 0.72;
  const fy = seaY + 60;
  c2d.beginPath();
  c2d.ellipse(fx, fy, 32, 18, 0, 0, Math.PI * 2);
  c2d.stroke();
  c2d.beginPath();
  c2d.moveTo(fx + 30, fy);
  c2d.lineTo(fx + 52, fy - 16);
  c2d.lineTo(fx + 52, fy + 16);
  c2d.closePath();
  c2d.stroke();
  // 鱼眼小圆
  c2d.beginPath();
  c2d.arc(fx - 18, fy - 3, 4, 0, Math.PI * 2);
  c2d.stroke();

  // 海底区域
  c2d.beginPath();
  c2d.moveTo(0, H * 0.92);
  for (let x = 0; x <= W; x += 20) {
    c2d.lineTo(x, H * 0.92 + Math.sin(x * 0.05) * 4);
  }
  c2d.stroke();

  return [
    { x: Math.round(bx), y: Math.round(hullTopY + 16) }, // 船身
    { x: Math.round(mastX + 20), y: Math.round(hullTopY - 35) }, // 帆
    { x: Math.round(sunX), y: Math.round(sunY) }, // 太阳
    { x: Math.round(fx), y: Math.round(fy) }, // 鱼身
    { x: Math.round(fx + 40), y: Math.round(fy) }, // 鱼尾
    { x: Math.round(W * 0.5), y: Math.round(seaY + 25) }, // 海面
    { x: Math.round(W * 0.2), y: Math.round(seaY + 80) }, // 海底
    { x: Math.round(W * 0.15), y: Math.round(H * 0.2) }, // 天空
  ];
}

export class ColorFillGame extends BaseGame {
  constructor() {
    super("color-fill");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private imgData!: ImageData;
  private W = 0;
  private H = 0;
  private color = "#ff6b6b";
  private filled = 0;
  private target = 0;
  private regions: { x: number; y: number; done: boolean }[] = [];
  private theme = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 2 : 3;
    this.theme = 0;
    this.target = 4;
    this.injectStyle();
    this.render();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private render(): void {
    this.filled = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const wrap = document.createElement("div");
    wrap.className = "cfl-wrap";

    const task = document.createElement("div");
    task.className = "cfl-task";
    task.innerHTML = `选颜色，再点图里要涂的地方，涂满 <b id="cfl-target">${this.target}</b> 块就完成这关啦！（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "cfl-canvas";
    const dpr = window.devicePixelRatio || 1;
    const W = Math.min(440, window.innerWidth - 40);
    const H = 340;
    this.W = W;
    this.H = H;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.c2d = this.canvas.getContext("2d", { willReadFrequently: true })!;
    this.c2d.scale(dpr, dpr);
    const points = drawOutline(this.c2d, W, H, this.theme);
    // 缓存像素数据（在 CSS 像素坐标系下，索引按设备像素算）
    this.imgData = this.c2d.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    this.regions = points.map((p) => ({ ...p, done: false }));
    this.canvas.addEventListener("click", (e) => this.onClick(e));
    wrap.appendChild(this.canvas);

    const palette = document.createElement("div");
    palette.className = "cfl-palette";
    COLORS.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cfl-color";
      b.style.background = c;
      if (i === 0) b.classList.add("cfl-color--active");
      b.addEventListener("click", () => {
        this.color = c;
        palette
          .querySelectorAll(".cfl-color")
          .forEach((x) => x.classList.remove("cfl-color--active"));
        b.classList.add("cfl-color--active");
        sfxPop();
      });
      palette.appendChild(b);
    });
    wrap.appendChild(palette);

    const progress = document.createElement("div");
    progress.className = "cfl-progress";
    progress.innerHTML = `已涂：<b id="cfl-filled">0</b> / ${this.target}`;
    wrap.appendChild(progress);

    const actions = document.createElement("div");
    actions.className = "cfl-actions";
    actions.appendChild(
      createButton({
        text: "重新画",
        icon: "🔄",
        variant: "secondary",
        onClick: () => this.redraw(),
      }),
    );
    actions.appendChild(
      createButton({
        text: "涂好啦！",
        icon: "🎉",
        variant: "primary",
        onClick: () => this.done(),
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
  }

  private redraw(): void {
    drawOutline(this.c2d, this.W, this.H, this.theme);
    this.imgData = this.c2d.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    this.filled = 0;
    this.regions = this.regions.map((p) => ({ ...p, done: false }));
    const f = this.root.querySelector("#cfl-filled");
    if (f) f.textContent = "0";
  }

  private onClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(cssX * dpr);
    const py = Math.floor(cssY * dpr);
    // flood fill
    const before = this.imgData.data[
      (py * this.canvas.width + px) * 4
    ] as number;
    const filled = this.floodFill(px, py, this.color);
    if (filled < 5) {
      // 点到线/边角，没怎么涂上：不算
      return;
    }
    sfxPop();
    // 找最近区域点
    let bestIdx = -1;
    let bestDist = Infinity;
    this.regions.forEach((r, i) => {
      if (r.done) return;
      const dx = r.x - cssX;
      const dy = r.y - cssY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    void before;
    if (bestIdx >= 0 && bestDist < 60 * 60) {
      this.regions[bestIdx]!.done = true;
      this.filled += 1;
      const f = this.root.querySelector("#cfl-filled");
      if (f) f.textContent = String(this.filled);
      const r = this.canvas.getBoundingClientRect();
      this.onCorrect(r.left + cssX, r.top + cssY);
      this.resetWrongStreak();
      if (this.filled >= this.target) {
        this.trackTimeout(() => this.done(), 600);
      }
    }
  }

  /** 扫描线 flood fill：把 (px,py) 所在连通同色区域涂成 newColor。 */
  private floodFill(px: number, py: number, newHex: string): number {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const data = this.imgData.data;
    if (px < 0 || py < 0 || px >= w || py >= h) return 0;
    const startIdx = (py * w + px) * 4;
    const sr = data[startIdx]!;
    const sg = data[startIdx + 1]!;
    const sb = data[startIdx + 2]!;
    const sa = data[startIdx + 3]!;
    const [nr, ng, nb] = hexToRgb(newHex);
    // 已是该色就不涂
    if (sr === nr && sg === ng && sb === nb && sa === 255) return 0;
    // 线条颜色（接近黑）不涂
    if (sr < 80 && sg < 80 && sb < 80) return 0;
    const match = (i: number): boolean =>
      Math.abs(data[i]! - sr) <= 12 &&
      Math.abs(data[i + 1]! - sg) <= 12 &&
      Math.abs(data[i + 2]! - sb) <= 12 &&
      Math.abs(data[i + 3]! - sa) <= 12;
    const stack: number[] = [px, py];
    let count = 0;
    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      let nx = x;
      // 向左找到边界
      while (nx >= 0 && match((y * w + nx) * 4)) nx--;
      nx++;
      let spanUp = false;
      let spanDown = false;
      while (nx < w && match((y * w + nx) * 4)) {
        const i = (y * w + nx) * 4;
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
        data[i + 3] = 255;
        count++;
        if (y > 0) {
          const up = ((y - 1) * w + nx) * 4;
          if (match(up)) {
            if (!spanUp) {
              stack.push(nx, y - 1);
              spanUp = true;
            }
          } else {
            spanUp = false;
          }
        }
        if (y < h - 1) {
          const dn = ((y + 1) * w + nx) * 4;
          if (match(dn)) {
            if (!spanDown) {
              stack.push(nx, y + 1);
              spanDown = true;
            }
          } else {
            spanDown = false;
          }
        }
        nx++;
      }
    }
    this.c2d.putImageData(this.imgData, 0, 0);
    return count;
  }

  private done(): void {
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.roundsDone += 1;
    if (this.roundsDone >= this.roundTotal) {
      // 按填涂完成度算星（至少 target 块即 3 星）
      this.finishClear(
        starsByScore(this.filled, [this.target, Math.ceil(this.target / 2)]),
      );
    } else {
      // 进入下一张图
      this.theme = (this.theme + 1) % 3;
      this.trackTimeout(() => this.render(), 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("cfl-style")) return;
    const st = document.createElement("style");
    st.id = "cfl-style";
    st.textContent = CFL_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function CFL_CSS(theme: string): string {
  return `
.cfl-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.cfl-task{font-size:1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cfl-task b{color:${theme};}
.cfl-canvas{background:#fff;border-radius:20px;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
.cfl-palette{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.cfl-color{width:38px;height:38px;border-radius:50%;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;border:3px solid transparent;}
.cfl-color:active{transform:scale(.88);}
.cfl-color--active{border-color:var(--ink);transform:scale(1.12);}
.cfl-progress{font-size:.95rem;font-weight:800;color:#666;}
.cfl-progress b{color:${theme};font-size:1.1rem;}
.cfl-actions{display:flex;gap:12px;}
`;
}

export function create(): ColorFillGame {
  return new ColorFillGame();
}
