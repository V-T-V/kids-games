/* 汉字拼图 Word Puzzle —— 把汉字拆成部件，拼回来。
   一个字拆成 2-4 个部件（偏旁/部首），打乱后让孩子拖拽到正确位置拼回完整字。
   如「明」=日+月，「林」=木+木。15+ 个可拆字。
   操作：拖拽部件到目标格；放对会吸附并发光，全对通关。
   难度=字复杂度+部件数。easy 4轮 / medium 6轮 / hard 8轮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 一个字及其部件（顺序即目标位置顺序，左→右 / 上→下）。 */
interface Word {
  char: string; // 完整字（参考答案）
  parts: string[]; // 部件
  hint: string; // 读音/词义提示
}

/** 字库：均为真实可拆字，部件顺序对应显示位置。 */
const WORDS: Word[] = [
  { char: "明", parts: ["日", "月"], hint: "míng · 明天" },
  { char: "林", parts: ["木", "木"], hint: "lín · 树林" },
  { char: "从", parts: ["人", "人"], hint: "cóng · 跟从" },
  { char: "森", parts: ["木", "木", "木"], hint: "sēn · 森林" },
  { char: "朋", parts: ["月", "月"], hint: "péng · 朋友" },
  { char: "好", parts: ["女", "子"], hint: "hǎo · 好人" },
  { char: "休", parts: ["亻", "木"], hint: "xiū · 休息" },
  { char: "看", parts: ["手", "目"], hint: "kàn · 看见" },
  { char: "尖", parts: ["小", "大"], hint: "jiān · 尖锐" },
  { char: "尘", parts: ["小", "土"], hint: "chén · 灰尘" },
  { char: "早", parts: ["日", "十"], hint: "zǎo · 早上" },
  { char: "草", parts: ["艹", "早"], hint: "cǎo · 小草" },
  { char: "村", parts: ["木", "寸"], hint: "cūn · 村子" },
  { char: "阳", parts: ["阝", "日"], hint: "yáng · 太阳" },
  { char: "时", parts: ["日", "寸"], hint: "shí · 时间" },
  { char: "对", parts: ["又", "寸"], hint: "duì · 对错" },
  { char: "奶", parts: ["女", "乃"], hint: "nǎi · 奶奶" },
  { char: "你", parts: ["亻", "尔"], hint: "nǐ · 你好" },
  { char: "花", parts: ["艹", "化"], hint: "huā · 花朵" },
  { char: "唱", parts: ["口", "昌"], hint: "chàng · 唱歌" },
];

interface Slot {
  part: string; // 正确部件
  filled: string | null; // 当前放入的部件
}

export class WordPuzzleGame extends BaseGame {
  constructor() {
    super("word-puzzle");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private order: number[] = [];
  private word!: Word;
  private slots: Slot[] = [];
  private unbinds: (() => void)[] = [];
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.order = shuffle(WORDS.map((_, i) => i));
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    // 按难度筛字：easy 取 2 部件；medium 取 2-3；hard 取 3-4
    const pool = WORDS.filter((w) => {
      const p = w.parts.length;
      return this.difficulty === "easy"
        ? p === 2
        : this.difficulty === "medium"
          ? p <= 3
          : p >= 2;
    });
    const idx = this.order[this.roundsDone % this.order.length] ?? 0;
    const filtered = pool.length > 0 ? pool : WORDS;
    this.word = filtered[idx % filtered.length]!;
    // 初始化槽位（空）
    this.slots = this.word.parts.map((p) => ({ part: p, filled: null }));
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "wpl-wrap";

    const task = document.createElement("div");
    task.className = "wpl-task";
    task.innerHTML = `把部件拖到 <b>虚线格</b> 拼回这个字 <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    // 参考字（小图，提示孩子拼什么样）
    const ref = document.createElement("div");
    ref.className = "wpl-ref";
    ref.innerHTML = `<span class="wpl-ref-ch">${this.word.char}</span><span class="wpl-ref-hint">${this.word.hint}</span>`;
    wrap.appendChild(ref);

    // 拼字区：若干目标槽位
    const stage = document.createElement("div");
    stage.className = "wpl-stage";
    stage.id = "wpl-stage";
    for (let i = 0; i < this.slots.length; i++) {
      const slot = document.createElement("div");
      slot.className = "wpl-slot";
      slot.dataset.slot = String(i);
      const f = this.slots[i]!.filled;
      if (f != null) {
        slot.textContent = f;
        slot.classList.add("wpl-slot--ok");
      }
      stage.appendChild(slot);
    }
    wrap.appendChild(stage);

    // 部件托盘：打乱后的部件
    const tray = document.createElement("div");
    tray.className = "wpl-tray";
    tray.id = "wpl-tray";
    const parts = shuffle(this.word.parts.map((p, i) => ({ p, i })));
    for (const { p, i } of parts) {
      const el = document.createElement("div");
      el.className = "wpl-part";
      el.textContent = p;
      el.dataset.part = p;
      el.dataset.idx = String(i);
      this.bindDrag(el, p);
      tray.appendChild(el);
    }
    wrap.appendChild(tray);

    const tip = document.createElement("div");
    tip.className = "wpl-tip";
    tip.textContent = "拖一个部件到虚线格；放对会发光～";
    wrap.appendChild(tip);

    this.root.appendChild(wrap);
  }

  /** 绑定拖拽：拖到目标槽位则判定。 */
  private bindDrag(el: HTMLDivElement, part: string): void {
    let dragging = false;
    let ghost: HTMLDivElement | null = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    const onDown = (p: { x: number; y: number }): void => {
      if (this.locked) return;
      dragging = true;
      startX = p.x;
      startY = p.y;
      const rect = el.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      // 创建跟随手指的克隆
      ghost = el.cloneNode(true) as HTMLDivElement;
      ghost.classList.add("wpl-part--ghost");
      ghost.style.position = "fixed";
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "9999";
      document.body.appendChild(ghost);
      el.classList.add("wpl-part--lift");
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }): void => {
      if (!dragging || !ghost) return;
      const dx = p.x - startX;
      const dy = p.y - startY;
      ghost.style.left = `${originX + dx}px`;
      ghost.style.top = `${originY + dy}px`;
    };
    const onUp = (p: { x: number; y: number }): void => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("wpl-part--lift");
      // 命中检测：找到覆盖的槽位
      const target = this.hitTest(p.x, p.y);
      ghost?.remove();
      ghost = null;
      if (target != null) {
        this.placePart(part, el, target);
      }
    };
    const u = bindPointer(el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  /** 找出指针落点所在的目标槽位下标。 */
  private hitTest(x: number, y: number): number | null {
    const slots = this.root.querySelectorAll<HTMLElement>(".wpl-slot");
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i]!.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return i;
      }
    }
    return null;
  }

  /** 把部件放入第 i 个槽位，判定对错。 */
  private placePart(
    part: string,
    sourceEl: HTMLDivElement,
    slotIdx: number,
  ): void {
    const slot = this.slots[slotIdx]!;
    if (slot.filled != null) {
      // 该槽已填，不处理
      sfxPop();
      return;
    }
    if (slot.part === part) {
      // 正确：吸附
      slot.filled = part;
      sourceEl.classList.add("wpl-part--used");
      sourceEl.style.visibility = "hidden";
      const slotEl = this.root.querySelector<HTMLElement>(
        `.wpl-slot[data-slot="${slotIdx}"]`,
      );
      if (slotEl) {
        slotEl.textContent = part;
        slotEl.classList.add("wpl-slot--ok");
        // 吸附动画
        slotEl.classList.remove("wpl-slot--snap");
        void slotEl.offsetWidth;
        slotEl.classList.add("wpl-slot--snap");
      }
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.resetWrongStreak();
      this.checkDone();
    } else {
      // 错误：弹回 + 摇晃
      sourceEl.classList.add("wpl-part--shake");
      this.trackTimeout(
        () => sourceEl.classList.remove("wpl-part--shake"),
        400,
      );
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private checkDone(): void {
    if (this.slots.every((s) => s.filled != null && s.filled === s.part)) {
      this.locked = true;
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧩",
      variant: "rest",
      body: "看看上面完整的字，想想每个部件该放哪一格～",
      primary: { text: "继续", icon: "🔤", onClick: () => ov.destroy() },
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
    if (document.getElementById("wpl-style")) return;
    const st = document.createElement("style");
    st.id = "wpl-style";
    st.textContent = WPL_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function WPL_CSS(theme: string): string {
  return `
.wpl-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.wpl-task{font-size:1.05rem;font-weight:800;text-align:center;color:var(--ink);background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.wpl-task b{color:${theme};}
.wpl-task small{color:var(--ink-soft);font-weight:700;font-size:.82rem;margin-left:6px;}
.wpl-ref{display:flex;align-items:baseline;gap:10px;}
.wpl-ref-ch{font-size:2.6rem;font-weight:900;color:rgba(0,0,0,.18);letter-spacing:.05em;}
.wpl-ref-hint{font-size:.9rem;font-weight:700;color:var(--ink-soft);}
.wpl-stage{display:flex;gap:8px;padding:16px;background:linear-gradient(160deg,#eef2ff,#e0e7ff);border-radius:18px;box-shadow:var(--shadow);}
.wpl-slot{width:78px;height:78px;display:flex;align-items:center;justify-content:center;font-size:2.4rem;font-weight:900;color:#333;border:3px dashed rgba(99,102,241,.45);border-radius:14px;background:rgba(255,255,255,.6);transition:transform .2s ease,background .2s,border-color .2s;}
.wpl-slot--ok{border-style:solid;border-color:${theme};background:#fff;}
.wpl-slot--snap{animation:wpl-snap .4s ease;}
@keyframes wpl-snap{0%{transform:scale(1.3);background:#fffde7}50%{transform:scale(1.12)}100%{transform:scale(1)}}
.wpl-tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:16px;box-shadow:var(--shadow);min-height:70px;}
.wpl-part{width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:900;color:#fff;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 40%,#fff));color:${theme};border:2px solid ${theme};border-radius:14px;cursor:grab;user-select:none;touch-action:none;box-shadow:var(--shadow);transition:transform .12s ease;}
.wpl-part:active{cursor:grabbing;transform:scale(1.05);}
.wpl-part--lift{opacity:.35;}
.wpl-part--used{visibility:hidden;}
.wpl-part--ghost{cursor:grabbing;box-shadow:0 8px 18px rgba(0,0,0,.3);transform:scale(1.1) rotate(-3deg);opacity:.95;}
.wpl-part--shake{animation:wpl-shake .4s ease;border-color:#ff6348!important;color:#ff6348!important;}
@keyframes wpl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.wpl-tip{font-size:.85rem;font-weight:700;color:var(--ink-soft);text-align:center;}
@media (max-width:380px){.wpl-slot{width:66px;height:66px;font-size:2rem;}.wpl-part{width:56px;height:56px;font-size:1.7rem;}}
`;
}

export function create(): WordPuzzleGame {
  return new WordPuzzleGame();
}
