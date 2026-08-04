/* 考古挖掘 Dino Dig —— 泥土网格里藏着化石/骨头/贝壳/恐龙蛋。
   孩子点击泥土块"挖掘"，每次挖到一件，凑齐指定数量后拼出完整恐龙骨架。
   独特点：边挖边发现的探索乐趣，每块泥土下都是惊喜。
   视觉：泥土块碎裂动画 + 化石飞出。难度=要挖的数量+网格大小。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Fossil {
  emoji: string;
  name: string;
}

/** 化石种类（挖掘目标）。 */
const FOSSILS: Fossil[] = [
  { emoji: "🦴", name: "骨头" },
  { emoji: "🦷", name: "牙齿" },
  { emoji: "🐚", name: "贝壳" },
  { emoji: "🥚", name: "恐龙蛋" },
  { emoji: "🦴", name: "肋骨" },
  { emoji: "🦖", name: "小恐龙" },
];

export class DinoDigGame extends BaseGame {
  constructor() {
    super("dino-dig");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private gridN = 9;
  private needN = 3;
  /** 网格里每个格子的内容：null=空地，否则为化石。 */
  private cells: (Fossil | null)[] = [];
  private found = 0;
  private busy = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 + trackTimeout 自动清理 */
  }

  private config(): { gridN: number; needN: number } {
    if (this.difficulty === "easy") return { gridN: 9, needN: 3 };
    if (this.difficulty === "medium") return { gridN: 12, needN: 4 };
    return { gridN: 16, needN: 5 };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    const cfg = this.config();
    this.gridN = cfg.gridN;
    this.needN = cfg.needN;
    this.found = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 把 needN 件化石随机放进网格，其余是空地（挖空地算"再找找"） */
    this.cells = new Array(this.gridN).fill(null);
    const positions = shuffle([...Array(this.gridN).keys()]).slice(
      0,
      this.needN,
    );
    for (const pos of positions) {
      this.cells[pos] = shuffle(FOSSILS)[0]!;
    }

    const wrap = document.createElement("div");
    wrap.className = "ddg-wrap";

    const task = document.createElement("div");
    task.className = "ddg-task";
    task.innerHTML = `挖出 <b>${this.needN}</b> 件化石拼恐龙！<span class="ddg-count">已找到 <b id="ddg-found">0</b>/${this.needN}</span>`;
    wrap.appendChild(task);

    /* 收集栏 */
    const tray = document.createElement("div");
    tray.className = "ddg-tray";
    tray.id = "ddg-tray";
    wrap.appendChild(tray);
    this.renderTray(tray);

    const field = document.createElement("div");
    field.className = "ddg-field";
    field.id = "ddg-field";
    /* 根据网格数算列数 */
    const cols = this.gridN <= 9 ? 3 : 4;
    field.style.setProperty("--ddg-cols", String(cols));

    for (let i = 0; i < this.gridN; i++) {
      const clod = document.createElement("button");
      clod.type = "button";
      clod.className = "ddg-clod";
      clod.setAttribute("aria-label", `泥土块 ${i + 1}`);
      clod.innerHTML = `<span class="ddg-clod__dirt"></span>`;
      clod.addEventListener("click", () => this.dig(i, clod, field));
      field.appendChild(clod);
    }
    wrap.appendChild(field);
    this.root.appendChild(wrap);
  }

  private renderTray(tray: HTMLElement): void {
    tray.innerHTML = "";
    for (let i = 0; i < this.needN; i++) {
      const slot = document.createElement("span");
      slot.className = "ddg-tray__slot";
      slot.textContent = "❓";
      tray.appendChild(slot);
    }
  }

  private dig(i: number, clod: HTMLButtonElement, field: HTMLElement): void {
    if (this.busy || clod.classList.contains("ddg-clod--dug")) return;
    clod.classList.add("ddg-clod--dug");
    clod.disabled = true;

    const fossil = this.cells[i];
    if (fossil) {
      /* 挖到化石！ */
      this.busy = true;
      sfxPop();
      /* 化石飞出动画 */
      const r = clod.getBoundingClientRect();
      const fr = field.getBoundingClientRect();
      const fly = document.createElement("span");
      fly.className = "ddg-fly";
      fly.textContent = fossil.emoji;
      fly.style.left = `${r.left - fr.left + r.width / 2}px`;
      fly.style.top = `${r.top - fr.top + r.height / 2}px`;
      field.appendChild(fly);

      this.trackTimeout(() => {
        fly.remove();
        clod.innerHTML = `<span class="ddg-clod__hole"></span>`;
        /* 入收集栏 */
        const slot = this.root.querySelectorAll(
          ".ddg-tray__slot",
        )[this.found] as HTMLElement | undefined;
        if (slot) {
          slot.textContent = fossil.emoji;
          slot.classList.add("ddg-tray__slot--got");
        }
        this.found += 1;
        const fb = this.root.querySelector("#ddg-found");
        if (fb) fb.textContent = String(this.found);
        const r2 = clod.getBoundingClientRect();
        this.onCorrect(r2.left + r2.width / 2, r2.top + r2.height / 2);
        this.resetWrongStreak();
        this.busy = false;

        if (this.found >= this.needN) {
          this.trackTimeout(() => this.assemble(), 700);
        }
      }, 520);
    } else {
      /* 空地：碎裂但不计错（探索游戏容错），仅轻提示 */
      sfxPop();
      clod.innerHTML = `<span class="ddg-clod__empty"></span>`;
    }
  }

  private assemble(): void {
    this.busy = true;
    /* 拼出恐龙骨架的揭晓动画 */
    const ov = new Overlay({
      title: "恐龙骨架拼好啦！",
      emoji: "🦖",
      variant: "default",
      body: `<div style="font-size:4rem;text-align:center;animation:ddg-stomp .6s ease;">🦴🦴🦴<br>🦖</div>`,
      primary: {
        text: "继续挖",
        icon: "⛏️",
        onClick: () => {
          ov.destroy();
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        },
      },
    });
    ov.show();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "泥土里还有化石，慢慢挖～",
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
    if (document.getElementById("ddg-style")) return;
    const st = document.createElement("style");
    st.id = "ddg-style";
    st.textContent = DDG_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function DDG_CSS(theme: string): string {
  return `
.ddg-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.ddg-task{font-size:1.1rem;font-weight:800;text-align:center;display:flex;flex-direction:column;gap:4px;line-height:1.4;}
.ddg-count{font-size:.95rem;color:#8a6a4a;}
.ddg-tray{display:flex;gap:8px;background:#fff;padding:10px 16px;border-radius:16px;box-shadow:var(--shadow);min-height:52px;align-items:center;flex-wrap:wrap;justify-content:center;}
.ddg-tray__slot{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;font-size:1.4rem;border-radius:10px;background:#f3e9dd;border:2px dashed ${theme};opacity:.6;transition:all .3s;}
.ddg-tray__slot--got{opacity:1;border-style:solid;background:#fff;animation:ddg-bounce .4s ease;}
@keyframes ddg-bounce{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.ddg-field{position:relative;display:grid;grid-template-columns:repeat(var(--ddg-cols,3),1fr);gap:8px;padding:14px;background:linear-gradient(180deg,#c89b6a,#a67c4a);border-radius:20px;box-shadow:var(--shadow),inset 0 4px 8px rgba(0,0,0,.15);width:min(360px,90%);}
.ddg-clod{position:relative;width:100%;aspect-ratio:1;min-height:64px;border:none;border-radius:12px;cursor:pointer;padding:0;transition:transform .15s;overflow:hidden;}
.ddg-clod:hover{transform:scale(1.04);}
.ddg-clod:active{transform:scale(.92);}
.ddg-clod__dirt{position:absolute;inset:0;background:radial-gradient(circle at 35% 30%,#c89b6a,#8a6a4a 70%,#6b5238);box-shadow:inset 0 -4px 6px rgba(0,0,0,.25),inset 0 2px 3px rgba(255,255,255,.1);}
.ddg-clod--dug{cursor:default;}
.ddg-clod--dug .ddg-clod__dirt{animation:ddg-crack .4s ease forwards;}
@keyframes ddg-crack{0%{transform:scale(1);opacity:1}50%{transform:scale(1.1) rotate(3deg);opacity:.8}100%{transform:scale(.6) rotate(-8deg);opacity:0;visibility:hidden}}
.ddg-clod__hole{position:absolute;inset:0;background:radial-gradient(circle,#3d2b1a,#5a3f28);border-radius:10px;box-shadow:inset 0 4px 8px rgba(0,0,0,.6);}
.ddg-clod__empty{position:absolute;inset:0;background:radial-gradient(circle,#3d2b1a,#5a3f28);border-radius:10px;opacity:.7;}
.ddg-fly{position:absolute;font-size:2rem;z-index:5;transform:translate(-50%,-50%);pointer-events:none;animation:ddg-fly .5s cubic-bezier(.3,1,.5,1) forwards;}
@keyframes ddg-fly{0%{transform:translate(-50%,-50%) scale(0);opacity:0}40%{transform:translate(-50%,-130%) scale(1.4);opacity:1}100%{transform:translate(-50%,-200%) scale(1);opacity:0}}
@keyframes ddg-stomp{0%{transform:translateY(-20px) scale(.5);opacity:0}60%{transform:translateY(10px) scale(1.1)}100%{transform:translateY(0) scale(1);opacity:1}}
@media (max-width:380px){.ddg-clod{min-height:54px;}.ddg-tray__slot{width:34px;height:34px;font-size:1.2rem;}}
`;
}

export function create(): DinoDigGame {
  return new DinoDigGame();
}
