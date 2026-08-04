/* 积木规律塔 Block Pattern —— 一列彩色积木按规律堆叠，最上面缺一块，
   孩子从选项里选出正确颜色补全规律。独特点：纵向堆叠的彩色塔 + 问号缺口，
   用 AB/ABC/AABB 等可验证规律保证有解。
   视觉：彩色方块塔 + 问号。难度=规律复杂度。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface ColorDef {
  hex: string;
  name: string;
}

const PALETTE: ColorDef[] = [
  { hex: "#ff5252", name: "红" },
  { hex: "#4d96ff", name: "蓝" },
  { hex: "#ffd93d", name: "黄" },
  { hex: "#6bcf7f", name: "绿" },
  { hex: "#a55eea", name: "紫" },
];

/** 一种规律模板：给定颜色池产生「颜色序列」与「答案索引颜色」。 */
interface PatternTemplate {
  /** 模板名（提示用） */
  hint: string;
  /** 输入若干颜色，返回完整的一周期序列（不含重复） */
  build: (pool: ColorDef[]) => ColorDef[];
}

const TEMPLATES: PatternTemplate[] = [
  { hint: "红蓝红蓝…", build: (p) => [p[0]!, p[1]!] },
  { hint: "红红蓝蓝…", build: (p) => [p[0]!, p[0]!, p[1]!, p[1]!] },
  { hint: "红蓝黄红蓝黄…", build: (p) => [p[0]!, p[1]!, p[2]!] },
  { hint: "红红蓝红红蓝…", build: (p) => [p[0]!, p[0]!, p[1]!] },
];

const ENCOURAGE = [
  "找出小秘密啦！",
  "看颜色排排队～",
  "真聪明！",
  "规律找到了！",
];

export class BlockPatternGame extends BaseGame {
  constructor() {
    super("block-pattern");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answer: ColorDef | null = null;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 按难度选模板索引池（easy 只用 2 色 AB，hard 用到 ABC） */
  private templatePool(): number[] {
    if (this.difficulty === "easy") return [0, 1];
    if (this.difficulty === "medium") return [0, 1, 3];
    return [0, 1, 2, 3];
  }

  /** 一列显示的积木数（含末尾问号） */
  private visibleCount(): number {
    if (this.difficulty === "easy") return 6;
    if (this.difficulty === "medium") return 7;
    return 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const tpls = this.templatePool();
    const tpl = TEMPLATES[sample(tpls)]!;
    /* 根据模板需要的颜色数取色 */
    const needColors = tpl.build(PALETTE.slice(0, 5)).length;
    /* 推断模板用了几种颜色（去重） */
    const distinct = new Set(tpl.build(PALETTE.slice(0, 5)).map((c) => c.hex))
      .size;
    const pool = shuffle(PALETTE).slice(0, distinct);

    /* 生成完整周期（重算以用真实 pool） */
    const cycle = tpl.build(pool);
    /* 总显示块数 = visibleCount；最后一块是「问号」缺口 */
    const total = this.visibleCount();
    /* 排列前 total-1 块（按周期循环），最后一块是答案 */
    const seq: ColorDef[] = [];
    for (let i = 0; i < total; i++) {
      seq.push(cycle[i % cycle.length]!);
    }
    const answer = seq[seq.length - 1]!;
    this.answer = answer;

    /* 选项：答案 + 3 个干扰（不含答案的其他颜色） */
    const distractors = shuffle(
      PALETTE.filter((c) => c.hex !== answer.hex),
    ).slice(0, 3);
    const options = shuffle([answer, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "bp-wrap";

    const task = document.createElement("div");
    task.className = "bp-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 最上面缺哪块？看颜色 <b>${tpl.hint}</b> 的规律`;
    wrap.appendChild(task);

    const tower = document.createElement("div");
    tower.className = "bp-tower";
    /* 倒序渲染：底部是 seq[0]，顶部是缺口（最后一块显示问号） */
    for (let i = seq.length - 1; i >= 0; i--) {
      const block = document.createElement("div");
      const isGap = i === seq.length - 1;
      block.className = isGap ? "bp-block bp-block--gap" : "bp-block";
      block.style.setProperty("--bp-color", seq[i]!.hex);
      if (isGap) {
        block.innerHTML = "<span class='bp-q'>?</span>";
        block.setAttribute("aria-label", "缺一块积木");
      } else {
        block.setAttribute("aria-label", `${seq[i]!.name}色积木`);
      }
      tower.appendChild(block);
    }
    wrap.appendChild(tower);

    const optsEl = document.createElement("div");
    optsEl.className = "bp-options";
    options.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bp-option";
      b.style.setProperty("--bp-color", c.hex);
      b.setAttribute("aria-label", `${c.name}色积木`);
      b.addEventListener("click", () => this.choose(b, c));
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    void needColors;
    this.root.appendChild(wrap);
  }

  private choose(btn: HTMLButtonElement, color: ColorDef): void {
    if (this.locked || !this.answer) return;
    if (color.hex === this.answer.hex) {
      this.locked = true;
      /* 把问号缺口填上正确颜色 */
      const gap = this.root.querySelector(".bp-block--gap");
      if (gap) {
        gap.classList.remove("bp-block--gap");
        gap.classList.add("bp-block", "bp-block--filled");
        (gap as HTMLElement).style.setProperty("--bp-color", color.hex);
        gap.innerHTML = "";
      }
      btn.classList.add("bp-option--right");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("bp-option--wrong");
      this.trackTimeout(() => btn.classList.remove("bp-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧱",
      variant: "rest",
      body: `从下往上看颜色，找一找是怎么重复的。${sample(ENCOURAGE)}`,
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
    if (document.getElementById("bp-style")) return;
    const st = document.createElement("style");
    st.id = "bp-style";
    st.textContent = BP_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function BP_CSS(theme: string): string {
  return `
.bp-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.bp-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.bp-tower{display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);}
.bp-block{width:120px;height:34px;border-radius:8px;background:var(--bp-color,${theme});box-shadow:inset 0 -4px 0 rgba(0,0,0,.18),inset 0 3px 0 rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;transition:transform .2s;}
.bp-block--gap{background:repeating-linear-gradient(45deg,#fff,#fff 8px,#e0e0e0 8px,#e0e0e0 16px);box-shadow:inset 0 0 0 2px dashed #bbb;}
.bp-q{font-size:1.5rem;font-weight:900;color:#999;}
.bp-block--filled{animation:bp-drop .4s cubic-bezier(.2,.9,.3,1.4);}
@keyframes bp-drop{0%{transform:translateY(-30px) scale(.6);opacity:0;}100%{transform:none;opacity:1;}}
.bp-options{display:flex;gap:16px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);}
.bp-option{width:74px;height:74px;border:none;border-radius:16px;background:var(--bp-color,${theme});cursor:pointer;box-shadow:inset 0 -6px 0 rgba(0,0,0,.2),inset 0 4px 0 rgba(255,255,255,.3),0 4px 8px rgba(0,0,0,.15);transition:transform .12s;}
.bp-option:active{transform:translateY(3px);}
.bp-option--right{box-shadow:inset 0 -6px 0 rgba(0,0,0,.2),inset 0 4px 0 rgba(255,255,255,.3),0 0 0 4px #fff,0 0 0 8px #6bcf7f;animation:bp-bounce .5s ease;}
.bp-option--wrong{animation:bp-shake .5s ease;}
@keyframes bp-bounce{0%,100%{transform:scale(1)}40%{transform:scale(1.15)}}
@keyframes bp-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
@media (max-width:380px){.bp-block{width:100px;height:30px;}.bp-option{width:62px;height:62px;}}
`;
}

export function create(): BlockPatternGame {
  return new BlockPatternGame();
}
