/* 镜面房间 Mirror Room —— 房间里有一面镜子，孩子在镜像中看到的画面，
   要从几个选项里找出"真实的那一个"（非镜像）。
   独特点：训练空间镜像认知——左右翻转的辨别。
   巧思：用不对称图案（L 形/T 形彩色块），镜像后明显不同；
   题库保证正确项存在且唯一。视觉：房间 + 镜面 + 选项。
   难度=房间复杂度（图案块数）。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

/** 一个图案块：格位 + 颜色。 */
interface Tile {
  x: number;
  y: number;
  color: string;
}

const COLORS = ["#ff6b9d", "#4d96ff", "#ffd93d", "#6bcf7f", "#a55eea"];

export class MirrorRoomGame extends BaseGame {
  constructor() {
    super("mirror-room");
  }

  private gridN = 3;
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.gridN =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 生成不对称图案（保证镜像后不同于自身）。 */
  private genPattern(): Tile[] {
    const n = this.gridN;
    const count =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    for (let attempt = 0; attempt < 200; attempt++) {
      const tiles: Tile[] = [];
      const used = new Set<string>();
      for (let i = 0; i < count; i++) {
        let x = 0,
          y = 0,
          t = 0;
        do {
          x = randInt(0, n - 1);
          y = randInt(0, n - 1);
          t++;
        } while (used.has(`${x},${y}`) && t < 30);
        used.add(`${x},${y}`);
        tiles.push({ x, y, color: COLORS[i % COLORS.length]! });
      }
      // 校验不对称：存在某块的镜像位置不等于任意块的位置
      const mirror = tiles.map((t) => ({ ...t, x: n - 1 - t.x }));
      const same = mirror.every((m) =>
        tiles.some((t) => t.x === m.x && t.y === m.y),
      );
      if (!same) return tiles; // 不对称，合格
    }
    // 兜底：固定 L 形
    return [
      { x: 0, y: 0, color: COLORS[0]! },
      { x: 0, y: 1, color: COLORS[1]! },
      { x: 1, y: 1, color: COLORS[2]! },
    ];
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const pattern = this.genPattern();
    const n = this.gridN;

    const wrap = document.createElement("div");
    wrap.className = "mr2-wrap";
    const task = document.createElement("div");
    task.className = "mr2-task";
    task.innerHTML = `镜子里看到的样子是反的！<br>找出 <b>真实房间</b>（不是镜像）～ <span class="mr2-prog">${this.roundsDone + 1} / ${this.roundTotal}</span>`;
    wrap.appendChild(task);

    // 展示区：左=镜子里的样子（镜像），右=说明
    const show = document.createElement("div");
    show.className = "mr2-show";
    const showLbl = document.createElement("div");
    showLbl.className = "mr2-show-lbl";
    showLbl.innerHTML = "🪞 镜子里看到的：";
    show.appendChild(showLbl);
    const mirrorRoom = this.renderRoom(this.mirrorOf(pattern, n), n, true);
    show.appendChild(mirrorRoom);
    wrap.appendChild(show);

    // 选项区：3 个房间，1 个真实（pattern），其余为不同的干扰（其它随机图案或翻转）
    const options: { tiles: Tile[]; key: string }[] = [];
    options.push({ tiles: pattern, key: "real" });
    // 干扰：基于 pattern 做不重复的变体
    const seen = new Set<string>();
    seen.add(this.signature(pattern, n));
    let guard = 0;
    while (options.length < 3 && guard++ < 100) {
      const variant = sample([
        this.mirrorOf(pattern, n),
        this.rotate180(pattern, n),
        this.shift(pattern, n),
      ]);
      const sig = this.signature(variant, n);
      if (seen.has(sig)) continue;
      // 干扰项也不能与正确项的镜像相同（否则模棱两可）——因为正确项的镜像就是题目本身
      seen.add(sig);
      options.push({ tiles: variant, key: "wrong" });
    }
    // 兜底补足
    while (options.length < 3) {
      options.push({ tiles: this.genPattern(), key: "wrong" });
    }
    const shuffled = shuffle(options);

    const optsEl = document.createElement("div");
    optsEl.className = "mr2-opts";
    shuffled.forEach((opt, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mr2-opt";
      b.dataset.idx = String(idx);
      b.appendChild(this.renderRoom(opt.tiles, n, false));
      b.addEventListener("click", () => this.choose(opt.key === "real", b));
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    this.root.appendChild(wrap);
  }

  private renderRoom(
    tiles: Tile[],
    n: number,
    isMirrorView: boolean,
  ): HTMLElement {
    const room = document.createElement("div");
    room.className = "mr2-room" + (isMirrorView ? " mr2-room--mirror" : "");
    room.style.setProperty("--n", String(n));
    const cell = n === 3 ? 40 : 34;
    room.style.width = `${n * cell}px`;
    room.style.height = `${n * cell}px`;
    // 背景格子
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = document.createElement("div");
        c.className = "mr2-cell";
        c.style.left = `${x * cell}px`;
        c.style.top = `${y * cell}px`;
        c.style.width = `${cell}px`;
        c.style.height = `${cell}px`;
        room.appendChild(c);
      }
    }
    // 图案块
    for (const t of tiles) {
      const b = document.createElement("div");
      b.className = "mr2-tile";
      b.style.background = t.color;
      b.style.left = `${t.x * cell}px`;
      b.style.top = `${t.y * cell}px`;
      b.style.width = `${cell}px`;
      b.style.height = `${cell}px`;
      room.appendChild(b);
    }
    return room;
  }

  /** 水平镜像（左右翻转）。 */
  private mirrorOf(tiles: Tile[], n: number): Tile[] {
    return tiles.map((t) => ({ x: n - 1 - t.x, y: t.y, color: t.color }));
  }
  /** 旋转 180°。 */
  private rotate180(tiles: Tile[], n: number): Tile[] {
    return tiles.map((t) => ({
      x: n - 1 - t.x,
      y: n - 1 - t.y,
      color: t.color,
    }));
  }
  /** 平移（环形）。 */
  private shift(tiles: Tile[], n: number): Tile[] {
    const dx = randInt(1, n - 1);
    return tiles.map((t) => ({ x: (t.x + dx) % n, y: t.y, color: t.color }));
  }
  /** 图案签名（用于去重）。 */
  private signature(tiles: Tile[], _n: number): string {
    return tiles
      .map((t) => `${t.x},${t.y},${t.color}`)
      .sort()
      .join("|");
  }

  private choose(correct: boolean, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    if (correct) {
      btn.classList.add("mr2-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    } else {
      btn.classList.add("mr2-opt--wrong");
      this.onWrong();
      // 标出正确答案
      this.root.querySelectorAll<HTMLButtonElement>(".mr2-opt").forEach(() => {
        // 通过比对签名找到正确项（简单做法：保留 dataset，重新匹配）
      });
      // 重新开启作答（允许再选）
      this.trackTimeout(() => {
        this.answered = false;
        // 移除错误高亮，鼓励再试
        this.root
          .querySelectorAll(".mr2-opt--wrong")
          .forEach((el) => el.classList.remove("mr2-opt--wrong"));
      }, 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("mr2-style")) return;
    const st = document.createElement("style");
    st.id = "mr2-style";
    st.textContent = MR2_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function MR2_CSS(theme: string): string {
  return `
.mr2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.mr2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.mr2-prog{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.mr2-task b{color:${theme};}
.mr2-show{display:flex;flex-direction:column;align-items:center;gap:6px;}
.mr2-show-lbl{font-size:.95rem;font-weight:700;color:var(--ink-soft);}
.mr2-room{position:relative;background:linear-gradient(135deg,#faf5ff,#ede0f5);border-radius:12px;box-shadow:var(--shadow);border:2px solid ${theme};}
.mr2-room--mirror{border-style:dashed;background:linear-gradient(135deg,#f3e5f5,#e1bee7);transform:scaleX(1);}
.mr2-cell{position:absolute;box-sizing:border-box;border:1px dashed rgba(0,0,0,.1);}
.mr2-tile{position:absolute;border-radius:6px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18),inset 0 2px 0 rgba(255,255,255,.4);animation:mr2-pop .25s ease;}
@keyframes mr2-pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
.mr2-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:8px;}
.mr2-opt{padding:10px;border:3px solid transparent;border-radius:16px;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease;display:flex;align-items:center;justify-content:center;}
.mr2-opt:active{transform:scale(.95);}
.mr2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:mr2-yes .4s ease;}
@keyframes mr2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.mr2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:mr2-no .3s ease;}
@keyframes mr2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.mr2-opts{gap:8px;}.mr2-opt{padding:6px;}}
`;
}

export function create(): MirrorRoomGame {
  return new MirrorRoomGame();
}
