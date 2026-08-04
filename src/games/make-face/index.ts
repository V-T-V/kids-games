/* 拼鬼脸 Make Face —— 空脸轮廓上拖五官拼出表情，创造性游戏无对错。
   独特点：纯创造沙盒，五官可自由摆放、重复使用、双击删除。
   巧思：脸轮廓居中，下方托盘供应五官 emoji，点"完成"即通关。用 bindPointer 拖拽。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { createButton } from "../../ui/Button.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar } from "../../lobby/util.ts";

interface FeatureKind {
  type: string;
  options: string[];
}

const FEATURES: FeatureKind[] = [
  { type: "眼睛", options: ["👀", "😀", "😣", "😴", "🤩"] },
  { type: "鼻子", options: ["👃", "🐽"] },
  { type: "嘴巴", options: ["👄", "👅", "😱", "🤐"] },
  { type: "眉毛", options: ["🤨", "😮"] },
  { type: "装饰", options: ["🎀", "🤡", "👓", "🎩"] },
];

export class MakeFaceGame extends BaseGame {
  constructor() {
    super("make-face");
  }

  private unbinds: (() => void)[] = [];
  private faceArea!: HTMLDivElement;
  private placedCount = 0;

  protected mount(): void {
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.placedCount = 0;

    const wrap = document.createElement("div");
    wrap.className = "mf-wrap";
    const task = document.createElement("div");
    task.className = "mf-task";
    task.textContent = "把五官拖到大脸上，拼一个搞笑的鬼脸吧！";
    wrap.appendChild(task);

    // 脸区域
    const stage = document.createElement("div");
    stage.className = "mf-stage";
    this.faceArea = document.createElement("div");
    this.faceArea.className = "mf-face";
    this.faceArea.innerHTML = `<div class="mf-face__blush mf-face__blush--l"></div><div class="mf-face__blush mf-face__blush--r"></div>`;
    stage.appendChild(this.faceArea);
    wrap.appendChild(stage);

    // 五官托盘
    const tray = document.createElement("div");
    tray.className = "mf-tray";
    FEATURES.forEach((kind) => {
      kind.options.forEach((emoji) => {
        const chip = document.createElement("div");
        chip.className = "mf-chip";
        chip.textContent = emoji;
        chip.title = kind.type;
        tray.appendChild(chip);
        this.enableCreateDrag(chip, emoji);
      });
    });
    wrap.appendChild(tray);

    // 操作按钮
    const actions = document.createElement("div");
    actions.className = "mf-actions";
    actions.appendChild(
      createButton({
        text: "清空",
        icon: "🗑️",
        variant: "secondary",
        onClick: () => this.clearFace(),
      }),
    );
    actions.appendChild(
      createButton({
        text: "做好啦",
        icon: "✨",
        variant: "primary",
        onClick: () => this.done(),
      }),
    );
    wrap.appendChild(actions);
    this.root.appendChild(wrap);
  }

  /** 从托盘拖出：创建一个新的已放置副本跟随指针。 */
  private enableCreateDrag(chip: HTMLElement, emoji: string): void {
    const u = bindPointer(chip, {
      down: (p) => {
        // 在脸上生成一个新副本并立即开始拖动
        const piece = this.makePiece(emoji);
        this.faceArea.appendChild(piece);
        this.startDraggingPiece(piece, p);
      },
    });
    this.unbinds.push(u);
  }

  private makePiece(emoji: string): HTMLDivElement {
    const piece = document.createElement("div");
    piece.className = "mf-piece";
    piece.textContent = emoji;
    this.placedCount += 1;
    // 已放置件：拖动 + 双击删除
    this.enableMoveDrag(piece);
    piece.addEventListener("dblclick", () => this.removePiece(piece));
    return piece;
  }

  private enableMoveDrag(piece: HTMLElement): void {
    const u = bindPointer(piece, {
      down: (p) => {
        this.startDraggingPiece(piece, p);
      },
    });
    this.unbinds.push(u);
  }

  private startDraggingPiece(
    piece: HTMLElement,
    p: { x: number; y: number },
  ): void {
    const faceRect = this.faceArea.getBoundingClientRect();
    // 切换到 fixed 定位，挂到 body 上避免裁剪
    piece.classList.add("mf-piece--drag");
    piece.style.position = "fixed";
    const setPos = (px: number, py: number) => {
      // 让指针位于元素中心
      piece.style.left = `${px - 22}px`;
      piece.style.top = `${py - 22}px`;
    };
    setPos(p.x, p.y);
    if (piece.parentElement !== document.body) {
      document.body.appendChild(piece);
    }
    const ox = p.x;
    const oy = p.y;
    const move = (pt: { x: number; y: number }) => setPos(pt.x, pt.y);
    const up = (pt: { x: number; y: number }) => {
      window.removeEventListener("pointermove", onMove as EventListener);
      window.removeEventListener("pointerup", onUp as EventListener);
      window.removeEventListener("pointercancel", onUp as EventListener);
      piece.classList.remove("mf-piece--drag");
      // 判断是否在脸内
      if (
        pt.x >= faceRect.left &&
        pt.x <= faceRect.right &&
        pt.y >= faceRect.top &&
        pt.y <= faceRect.bottom
      ) {
        // 转换为相对脸的百分比坐标
        const relX = ((pt.x - faceRect.left) / faceRect.width) * 100;
        const relY = ((pt.y - faceRect.top) / faceRect.height) * 100;
        piece.style.position = "absolute";
        piece.style.left = `${relX}%`;
        piece.style.top = `${relY}%`;
        piece.style.transform = "translate(-50%,-50%)";
        this.faceArea.appendChild(piece);
        sfxPop();
      } else {
        // 拖出脸外 = 删除
        this.removePiece(piece);
      }
    };
    const onMove = (e: PointerEvent) => move({ x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => up({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    void ox;
    void oy;
  }

  private removePiece(piece: HTMLElement): void {
    if (piece.parentElement) piece.parentElement.removeChild(piece);
    this.placedCount = Math.max(0, this.placedCount - 1);
  }

  private clearFace(): void {
    this.faceArea.querySelectorAll(".mf-piece").forEach((el) => el.remove());
    this.placedCount = 0;
    sfxPop();
  }

  private done(): void {
    // 创造性游戏，无论放没放都通关
    sfxPop();
    const r = this.faceArea.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.trackTimeout(() => this.finishClear(3), 500);
  }

  private injectStyle(): void {
    if (document.getElementById("mf-style")) return;
    const st = document.createElement("style");
    st.id = "mf-style";
    st.textContent = MF_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function MF_CSS(theme: string): string {
  return `
.mf-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.mf-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.mf-stage{display:flex;align-items:center;justify-content:center;}
.mf-face{position:relative;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2,color-mix(in srgb,${theme} 45%,#ffe9d6));box-shadow:inset -10px -14px 24px rgba(0,0,0,.12),var(--shadow);overflow:hidden;}
.mf-face__blush{position:absolute;width:46px;height:30px;background:radial-gradient(circle,rgba(255,120,120,.5),transparent 70%);border-radius:50%;bottom:34%;}
.mf-face__blush--l{left:16%;}
.mf-face__blush--r{right:16%;}
.mf-piece{position:absolute;font-size:2.6rem;cursor:grab;touch-action:none;user-select:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));transform:translate(-50%,-50%);line-height:1;}
.mf-piece--drag{cursor:grabbing;transform:translate(-50%,-50%) scale(1.2);z-index:100;transition:none;}
.mf-tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);max-width:440px;}
.mf-chip{width:56px;height:56px;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.8rem;cursor:grab;touch-action:none;box-shadow:0 2px 5px rgba(0,0,0,.15);transition:transform .12s;}
.mf-chip:active{transform:scale(.9);}
.mf-actions{display:flex;gap:14px;}
@media (max-width:380px){.mf-face{width:230px;height:230px;}.mf-piece{font-size:2.2rem;}.mf-chip{width:48px;height:48px;font-size:1.5rem;}}
`;
}

export function create(): MakeFaceGame {
  return new MakeFaceGame();
}
