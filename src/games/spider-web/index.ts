/* 蜘蛛网 Spider Web —— 屏幕上有若干发光节点，孩子按顺序连线织出蛛网。
   独特点：深色夜空 + 发光节点 + SVG 连线，像蜘蛛织网般层层展开。
   巧思：节点排成同心圆蛛网布局，按螺旋顺序编号；下一个目标节点会脉冲发光提示，
   孩子按提示顺序点击即可成功织网，零失败焦虑。点错只是温柔提示。
   难度 = 节点数。通关 = 织完目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Node {
  x: number;
  y: number;
  order: number;
  el: HTMLElement;
}

export class SpiderWebGame extends BaseGame {
  constructor() {
    super("spider-web");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private nodes: Node[] = [];
  private svg!: SVGElement;
  private current = 0;
  private fieldW = 0;
  private fieldH = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private nodeCount(): number {
    return this.difficulty === "easy"
      ? 7
      : this.difficulty === "medium"
        ? 11
        : 15;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.current = 0;
    this.nodes = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "sw-wrap";
    const task = document.createElement("div");
    task.className = "sw-task";
    task.innerHTML = `按发光顺序点击节点，织出蛛网！`;
    wrap.appendChild(task);

    const field = document.createElement("div");
    field.className = "sw-field";
    wrap.appendChild(field);

    // SVG 连线层
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.classList.add("sw-svg");
    field.appendChild(this.svg);

    // 中心蜘蛛
    const spider = document.createElement("div");
    spider.className = "sw-spider";
    spider.textContent = "🕷️";
    field.appendChild(spider);

    this.root.appendChild(wrap);

    requestAnimationFrame(() => {
      const r = field.getBoundingClientRect();
      this.fieldW = r.width;
      this.fieldH = r.height;
      this.svg.setAttribute("viewBox", `0 0 ${this.fieldW} ${this.fieldH}`);
      // 蜘蛛放在中心
      spider.style.left = `${this.fieldW / 2}px`;
      spider.style.top = `${this.fieldH / 2}px`;
      this.buildNodes(field);
      this.highlightCurrent();
    });
  }

  /** 生成蛛网布局：中心 + 同心圆环节点，按螺旋顺序编号。 */
  private buildNodes(field: HTMLElement): void {
    const n = this.nodeCount();
    const cx = this.fieldW / 2;
    const cy = this.fieldH / 2;
    const maxR = Math.min(this.fieldW, this.fieldH) / 2 - 30;

    // 计算每个节点的位置：用螺旋分布
    // 起点靠近中心，逐渐向外旋
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1); // 0..1
      const angle = t * Math.PI * 3.5; // 转 1.75 圈
      const radius = 30 + t * (maxR - 30);
      positions.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }

    for (let i = 0; i < n; i++) {
      const p = positions[i]!;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sw-node";
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.textContent = String(i + 1);
      el.addEventListener("click", () => this.tapNode(i));
      field.appendChild(el);
      this.nodes.push({ x: p.x, y: p.y, order: i, el });
    }
  }

  private highlightCurrent(): void {
    for (const node of this.nodes) {
      node.el.classList.toggle("sw-node--active", node.order === this.current);
      node.el.classList.toggle("sw-node--done", node.order < this.current);
    }
  }

  private tapNode(idx: number): void {
    const node = this.nodes[idx]!;
    if (node.order < this.current) return; // 已连过
    if (node.order !== this.current) {
      // 顺序错了：温柔提示
      this.onWrong();
      node.el.classList.add("sw-node--shake");
      this.trackTimeout(() => node.el.classList.remove("sw-node--shake"), 350);
      return;
    }
    // 正确：从上一个节点连线到这里
    if (this.current > 0) {
      const prev = this.nodes[this.current - 1]!;
      this.drawLine(prev.x, prev.y, node.x, node.y);
      // 同时从中心连一条辐线（蛛网效果）
      this.drawSpoke(node.x, node.y);
    } else {
      // 第一个节点：从中心连过来
      this.drawSpoke(node.x, node.y);
    }
    node.el.classList.add("sw-node--linked");
    sfxPop();
    this.resetWrongStreak();
    this.onCorrect(node.x + this.root.getBoundingClientRect().left, 0);
    this.current += 1;
    this.highlightCurrent();

    if (this.current >= this.nodes.length) {
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    }
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number): void {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.classList.add("sw-line");
    this.svg.appendChild(line);
  }

  private drawSpoke(x: number, y: number): void {
    const cx = this.fieldW / 2;
    const cy = this.fieldH / 2;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(cx));
    line.setAttribute("y1", String(cy));
    line.setAttribute("x2", String(x));
    line.setAttribute("y2", String(y));
    line.classList.add("sw-line", "sw-line--spoke");
    this.svg.appendChild(line);
  }

  private injectStyle(): void {
    if (document.getElementById("sw-style")) return;
    const st = document.createElement("style");
    st.id = "sw-style";
    st.textContent = SW_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SW_CSS(theme: string): string {
  return `
.sw-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.sw-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.sw-field{position:relative;width:100%;height:62vh;min-height:360px;background:radial-gradient(circle at 50% 50%,#2a1a4a 0%,#160a2a 60%,#080418 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.sw-field::before{content:"✦ ✧ ✦ ✧";position:absolute;top:12px;left:0;font-size:.8rem;letter-spacing:90px;color:${theme};opacity:.5;}
.sw-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;}
.sw-line{stroke:${theme};stroke-width:2.2;stroke-linecap:round;opacity:0;filter:drop-shadow(0 0 4px ${theme});animation:sw-appear .4s ease forwards;}
.sw-line--spoke{stroke-width:1.2;opacity:0;animation:sw-appear .4s ease forwards;}
@keyframes sw-appear{from{stroke-dasharray:6 6;opacity:0}to{opacity:.85}}
.sw-node{position:absolute;width:38px;height:38px;border-radius:50%;border:2px solid #fff;background:radial-gradient(circle at 35% 30%,#fff8,${theme});color:#fff;font-weight:800;font-size:.95rem;transform:translate(-50%,-50%);cursor:pointer;z-index:3;box-shadow:0 0 0 rgba(255,255,255,0);transition:transform .12s,box-shadow .2s;display:flex;align-items:center;justify-content:center;}
.sw-node:active{transform:translate(-50%,-50%) scale(.9);}
.sw-node--active{animation:sw-pulse 1s ease-in-out infinite;}
@keyframes sw-pulse{0%,100%{box-shadow:0 0 6px ${theme}}50%{box-shadow:0 0 18px ${theme},0 0 30px #fff}}
.sw-node--done{opacity:.5;filter:grayscale(.5);cursor:default;}
.sw-node--linked{background:radial-gradient(circle at 35% 30%,#fff,#fff);}
.sw-node--shake{animation:sw-shake .3s ease;}
@keyframes sw-shake{0%,100%{transform:translate(-50%,-50%) translateX(0)}25%{transform:translate(-50%,-50%) translateX(-5px)}75%{transform:translate(-50%,-50%) translateX(5px)}}
.sw-spider{position:absolute;font-size:1.8rem;transform:translate(-50%,-50%);z-index:4;filter:drop-shadow(0 0 8px ${theme});}
@media (max-width:380px){.sw-task{font-size:.95rem;}.sw-node{width:32px;height:32px;font-size:.85rem;}.sw-spider{font-size:1.5rem;}}
`;
}

export function create(): SpiderWebGame {
  return new SpiderWebGame();
}
