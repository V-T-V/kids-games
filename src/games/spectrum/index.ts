/* 光谱排序 Spectrum —— 把彩虹色（红橙黄绿青蓝紫）按正确顺序点击排列。
   独特点：完成后所有色块拼成一道完整彩虹弧（SVG 弧线）。
   巧思：彩虹七色固定顺序；难度=参与排序的色块数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop, playNote } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

// 彩虹七色：红橙黄绿青蓝紫（含色值与音名，连对时叮一声）
const RAINBOW: { name: string; color: string; note: string }[] = [
  { name: "红", color: "#ff5252", note: "C5" },
  { name: "橙", color: "#ff9f43", note: "D5" },
  { name: "黄", color: "#ffd93d", note: "E5" },
  { name: "绿", color: "#6bcf7f", note: "F5" },
  { name: "青", color: "#22d3ee", note: "G5" },
  { name: "蓝", color: "#4d96ff", note: "A5" },
  { name: "紫", color: "#a55eea", note: "B5" },
];

export class SpectrumGame extends BaseGame {
  constructor() {
    super("spectrum");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private next = 0;
  /** 本轮参与排序的「彩虹序号」集合（子集，已按顺序），length=难度 */
  private seq: number[] = [];
  /** 打乱后的展示顺序 */
  private display: number[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 参与排序的色块数 */
  private count(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 7;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.next = 0;

    const n = this.count();
    // 从七色里等间隔地取 n 个，保持原始顺序（仍有彩虹子序列感）
    const idxs = [0, 1, 2, 3, 4, 5, 6];
    let chosen: number[];
    if (n >= 7) {
      chosen = idxs;
    } else {
      // 等间隔抽样
      chosen = [];
      for (let i = 0; i < n; i++) {
        chosen.push(Math.round((i * 6) / (n - 1)));
      }
    }
    this.seq = chosen;
    this.display = shuffle(chosen);

    const wrap = document.createElement("div");
    wrap.className = "spc-wrap";

    const task = document.createElement("div");
    task.className = "spc-task";
    task.innerHTML = `按<span class="spc-rainbow">彩虹</span>顺序点色块：红→橙→黄→绿→青→蓝→紫<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    // 上方：彩虹弧 SVG（完成后点亮）
    const arc = document.createElement("div");
    arc.className = "spc-arc";
    arc.id = "spc-arc";
    wrap.appendChild(arc);

    // 下方：打乱的色块
    const pool = document.createElement("div");
    pool.className = "spc-pool";
    this.display.forEach((rbIdx) => {
      const seg = RAINBOW[rbIdx]!;
      const b = document.createElement("div");
      b.className = "spc-chip";
      b.style.background = `linear-gradient(160deg, ${shade(seg.color, 28)}, ${seg.color} 55%, ${shade(seg.color, -22)})`;
      b.dataset.idx = String(rbIdx);
      const lab = document.createElement("span");
      lab.className = "spc-chip__lab";
      lab.textContent = seg.name;
      b.appendChild(lab);
      b.addEventListener("click", () => this.onChip(rbIdx, b));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);

    this.root.appendChild(wrap);
  }

  private onChip(rbIdx: number, el: HTMLDivElement): void {
    if (el.classList.contains("spc-chip--done")) return;
    const expect = this.seq[this.next];
    if (expect === undefined || rbIdx !== expect) {
      el.classList.add("spc-chip--shake");
      this.trackTimeout(() => el.classList.remove("spc-chip--shake"), 360);
      this.onWrong();
      return;
    }
    sfxPop();
    playNote(RAINBOW[rbIdx]!.note, 0.3);
    el.classList.add("spc-chip--done");
    const r = el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.next += 1;
    this.resetWrongStreak();
    this.renderArc();

    if (this.next >= this.seq.length) {
      // 完整彩虹亮起
      const arc = this.root.querySelector("#spc-arc");
      arc?.classList.add("spc-arc--full");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1300);
    }
  }

  /** 根据已选色块，绘制渐进彩虹弧（每点对一个色段亮起） */
  private renderArc(): void {
    const arc = this.root.querySelector<HTMLElement>("#spc-arc");
    if (!arc) return;
    const w = arc.clientWidth || 360;
    const h = Math.round(w * 0.5);
    arc.innerHTML = "";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    // 已选的 seq[0..next-1] —— 每个画一条粗弧
    for (let i = 0; i < this.next; i++) {
      const rbIdx = this.seq[i]!;
      const col = RAINBOW[rbIdx]!.color;
      const r = w * 0.46 - i * 16; // 多条同心弧
      const cy = h + r * 0.15;
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      const a = Math.PI * (0.12 + i * 0.0); // 半圆
      const x1 = w / 2 - r * Math.cos(a);
      const y1 = cy - r * Math.sin(a);
      const x2 = w / 2 + r * Math.cos(a);
      const y2 = cy - r * Math.sin(a);
      path.setAttribute("d", `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`);
      path.setAttribute("stroke", col);
      path.setAttribute("stroke-width", "14");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("fill", "none");
      path.style.filter = `drop-shadow(0 2px 4px ${col}66)`;
      svg.appendChild(path);
    }
    arc.appendChild(svg);
  }

  private injectStyle(): void {
    if (document.getElementById("spc-style")) return;
    const st = document.createElement("style");
    st.id = "spc-style";
    st.textContent = SP_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

/** 把十六进制颜色调亮/调暗，amt>0 调亮，<0 调暗 */
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1]!, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function SP_CSS(_theme: string): string {
  return `
.spc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(640px,100%);}
.spc-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.spc-rainbow{display:inline-block;padding:1px 10px;border-radius:999px;background:linear-gradient(90deg,#ff5252,#ff9f43,#ffd93d,#6bcf7f,#22d3ee,#4d96ff,#a55eea);color:#fff;box-shadow:var(--shadow);margin:0 4px;}
.spc-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.spc-arc{width:min(420px,92%);height:170px;display:flex;align-items:flex-end;justify-content:center;background:linear-gradient(180deg,#0b1026,#1b2150);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;padding-top:10px;}
.spc-arc--full{animation:spc-glow 1.2s ease;}
@keyframes spc-glow{0%{filter:brightness(1)}40%{filter:brightness(1.6)}100%{filter:brightness(1.1)}}
.spc-pool{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:22px;background:rgba(255,255,255,.7);border-radius:24px;box-shadow:var(--shadow);}
.spc-chip{width:78px;height:78px;border-radius:50%;cursor:pointer;position:relative;box-shadow:0 6px 14px rgba(0,0,0,.2),inset 0 -5px 9px rgba(0,0,0,.22),inset 0 5px 9px rgba(255,255,255,.35);transition:transform .18s ease;}
.spc-chip:hover{transform:translateY(-4px) scale(1.05);}
.spc-chip:active{transform:scale(.95);}
.spc-chip__lab{position:absolute;inset:auto 0 8px 0;text-align:center;font-weight:800;font-size:.85rem;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);}
.spc-chip--done{opacity:.32;transform:scale(.82);filter:grayscale(.3);}
.spc-chip--shake{animation:spc-shake .36s ease;}
@keyframes spc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}50%{transform:translateX(7px)}75%{transform:translateX(-5px)}}
`;
}

export function create(): SpectrumGame {
  return new SpectrumGame();
}
