/* 工具配对 Tool-Match —— 把工具拖到对应的职业（医生/理发师/厨师/画家…）。
   独特点：职业-工具一一对应，训练「谁用什么」的职业认知。
   视觉：工具 emoji + 职业 emoji 卡片。难度=配对对数。
   通关=配完目标轮数。用 bindPointer 拖拽。前缀 tm2- 避免冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Pair {
  tool: string;
  toolName: string;
  job: string;
  jobName: string;
  color: string;
}

interface Tool {
  pair: Pair;
  el: HTMLElement;
  placed: boolean;
}

const PAIRS: Pair[] = [
  {
    tool: "🩺",
    toolName: "听诊器",
    job: "👨‍⚕️",
    jobName: "医生",
    color: "#ff6348",
  },
  {
    tool: "✂️",
    toolName: "剪刀",
    job: "💇",
    jobName: "理发师",
    color: "#a55eea",
  },
  {
    tool: "🍳",
    toolName: "锅铲",
    job: "👨‍🍳",
    jobName: "厨师",
    color: "#ff9f43",
  },
  {
    tool: "🖌️",
    toolName: "画笔",
    job: "🧑‍🎨",
    jobName: "画家",
    color: "#4d96ff",
  },
  {
    tool: "🔨",
    toolName: "锤子",
    job: "🔨",
    jobName: "木匠",
    color: "#b08968",
  },
  {
    tool: "📚",
    toolName: "课本",
    job: "👨‍🏫",
    jobName: "老师",
    color: "#6bcf7f",
  },
  {
    tool: "🚒",
    toolName: "水管",
    job: "🧑‍🚒",
    jobName: "消防员",
    color: "#ff6b9d",
  },
  {
    tool: "✈️",
    toolName: "飞机",
    job: "👨‍✈️",
    jobName: "飞行员",
    color: "#00d2d3",
  },
];

const ENCOURAGE = ["配得真准！", "想想谁会用它～", "真厉害！", "差一点点！"];

export class ToolMatchGame extends BaseGame {
  constructor() {
    super("tool-match");
  }

  private unbinds: (() => void)[] = [];
  private jobSlots: Record<string, HTMLElement> = {};
  private tools: Tool[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private pairCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 6;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.tools = [];
    this.jobSlots = {};
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.pairCount();
    this.remaining = n;
    const picked = shuffle(PAIRS).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "tm2-wrap";

    const task = document.createElement("div");
    task.className = "tm2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把工具拖到用它的<b>职业</b>`;
    wrap.appendChild(task);

    /* 职业槽（打乱顺序） */
    const jobRow = document.createElement("div");
    jobRow.className = "tm2-jobs";
    shuffle(picked).forEach((p) => {
      const slot = document.createElement("div");
      slot.className = "tm2-job";
      slot.dataset.job = p.jobName;
      slot.style.setProperty("--tm2-color", p.color);
      slot.innerHTML = `
        <div class="tm2-job-emoji">${p.job}</div>
        <div class="tm2-job-name">${p.jobName}</div>
        <div class="tm2-job-drop" id="tm2-drop-${p.jobName}"></div>
      `;
      jobRow.appendChild(slot);
      this.jobSlots[p.jobName] = slot;
    });
    wrap.appendChild(jobRow);

    /* 工具托盘（打乱顺序） */
    const tray = document.createElement("div");
    tray.className = "tm2-tray";
    shuffle(picked).forEach((p) => {
      const el = document.createElement("div");
      el.className = "tm2-tool";
      el.style.setProperty("--tm2-color", p.color);
      el.innerHTML = `<span class="tm2-tool-emoji">${p.tool}</span><span class="tm2-tool-name">${p.toolName}</span>`;
      el.dataset.job = p.jobName;
      tray.appendChild(el);
      const t: Tool = { pair: p, el, placed: false };
      this.tools.push(t);
      this.enableDrag(t);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(t: Tool): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (t.placed || this.locked) return;
      dragging = true;
      const r = t.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = t.el.parentElement;
      t.el.classList.add("tm2-tool--drag");
      t.el.style.position = "fixed";
      t.el.style.left = `${p.x - offX}px`;
      t.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(t.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      t.el.style.left = `${p.x - offX}px`;
      t.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      t.el.classList.remove("tm2-tool--drag");
      let hitName: string | null = null;
      for (const [name, slot] of Object.entries(this.jobSlots)) {
        const r = slot.getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hitName = name;
          break;
        }
      }
      if (hitName === t.pair.jobName) {
        t.placed = true;
        t.el.style.position = "";
        t.el.style.left = "";
        t.el.style.top = "";
        t.el.classList.add("tm2-tool--in");
        const drop = this.root.querySelector(`#tm2-drop-${hitName}`);
        if (drop) drop.appendChild(t.el);
        this.remaining -= 1;
        const slot = this.jobSlots[hitName]!;
        const r = slot.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.locked = true;
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 900);
        }
      } else {
        t.el.style.position = "";
        t.el.style.left = "";
        t.el.style.top = "";
        origin?.appendChild(t.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(t.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🔨",
      variant: "rest",
      body: `想想这个工具是谁工作时用的？ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("tm2-style")) return;
    const st = document.createElement("style");
    st.id = "tm2-style";
    st.textContent = TM2_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function TM2_CSS(theme: string): string {
  return `
.tm2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.tm2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.tm2-jobs{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;width:100%;}
.tm2-job{width:110px;background:linear-gradient(180deg,rgba(255,255,255,.85),var(--tm2-color,${theme})22);border:3px solid var(--tm2-color,${theme});border-radius:18px;padding:10px 6px;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;gap:4px;}
.tm2-job-emoji{font-size:2.6rem;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.18));}
.tm2-job-name{font-size:.85rem;font-weight:900;color:var(--tm2-color,${theme});background:#fff;border-radius:999px;padding:2px 8px;}
.tm2-job-drop{min-height:44px;width:100%;border-radius:10px;background:rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;}
.tm2-tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:520px;}
.tm2-tool{display:flex;flex-direction:column;align-items:center;gap:2px;width:78px;height:88px;border-radius:16px;background:#fff;border:3px solid var(--tm2-color,${theme});cursor:grab;touch-action:none;user-select:none;box-shadow:0 3px 0 rgba(0,0,0,.1),0 5px 8px rgba(0,0,0,.1);transition:transform .12s;justify-content:center;}
.tm2-tool:active{transform:scale(1.08);}
.tm2-tool-emoji{font-size:2.3rem;line-height:1;}
.tm2-tool-name{font-size:.66rem;font-weight:700;color:#555;}
.tm2-tool--drag{cursor:grabbing;transform:scale(1.16);z-index:100;}
.tm2-tool--in{animation:tm2-pop .4s ease;cursor:default;transform:scale(.82);}
@keyframes tm2-pop{0%{transform:scale(.6)}60%{transform:scale(1)}100%{transform:scale(.82)}}
@media (max-width:380px){.tm2-job{width:92px;}.tm2-job-emoji{font-size:2.2rem;}.tm2-tool{width:66px;height:78px;}.tm2-tool-emoji{font-size:1.9rem;}}
`;
}

export function create(): ToolMatchGame {
  return new ToolMatchGame();
}
