/* 修玩具 Toy Fix —— 几个玩具各缺一个零件（小车缺轮子、娃娃缺眼睛…），
   下方散落零件，孩子把对应零件拖到玩具的缺口上修好它。
   独特点：功能配对（零件→缺口），玩具修好后"咔哒"弹回完整形态。
   视觉：玩具 emoji + 零件 emoji + 缺口虚线框。难度=玩具数。
   通关=修好目标轮数。用 bindPointer 拖拽。前缀 tf2-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Toy {
  /** 零件种类键（配对依据） */
  partKey: string;
  /** 零件中文名（提示） */
  partName: string;
  /** 玩具主体 emoji（缺零件的样子） */
  body: string;
  /** 缺的零件 emoji */
  part: string;
  /** 修好后的完整 emoji（可选，没有则用 body+part 拼合） */
  whole?: string;
}

/** 玩具池：每条 = 一个玩具 + 它缺的零件。保证每对 partKey 唯一。 */
const TOY_POOL: Toy[] = [
  { partKey: "wheel", partName: "轮子", body: "🚗", part: "⭕", whole: "🚙" },
  { partKey: "eye", partName: "眼睛", body: "🧸", part: "👁️" },
  { partKey: "button", partName: "纽扣", body: "👕", part: "🔘" },
  { partKey: "wing", partName: "翅膀", body: "🐦", part: "🪽" },
  { partKey: "hat", partName: "帽子", body: "🧑", part: "🎩", whole: "🤵" },
  { partKey: "flower", partName: "花", body: "🪴", part: "🌸" },
  { partKey: "candle", partName: "蜡烛", body: "🎂", part: "🕯️" },
  { partKey: "key", partName: "钥匙", body: "🚪", part: "🗝️" },
];

interface Part {
  toy: Toy;
  el: HTMLElement;
  placed: boolean;
}

export class ToyFixGame extends BaseGame {
  constructor() {
    super("toy-fix");
  }

  private unbinds: (() => void)[] = [];
  private toySlots: Record<string, HTMLElement> = {};
  private parts: Part[] = [];
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

  private toyCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.toySlots = {};
    this.parts = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.toyCount();
    const toys = shuffle(TOY_POOL).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "tf2-wrap";

    const task = document.createElement("div");
    task.className = "tf2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把<b>零件</b>拖到玩具缺的地方，修好它 🧰`;
    wrap.appendChild(task);

    // 玩具区
    const stage = document.createElement("div");
    stage.className = "tf2-stage";
    toys.forEach((t) => {
      const slot = document.createElement("div");
      slot.className = "tf2-toy";
      slot.dataset.key = t.partKey;
      slot.innerHTML = `<div class="tf2-body">${t.whole ? t.body : t.body}</div><div class="tf2-gap" data-key="${t.partKey}"><span class="tf2-gap__hint">${t.partName}?</span></div>`;
      stage.appendChild(slot);
      this.toySlots[t.partKey] = slot;
    });
    wrap.appendChild(stage);

    // 零件托盘（打乱）
    const tray = document.createElement("div");
    tray.className = "tf2-tray";
    const shuffled = shuffle(toys);
    shuffled.forEach((t) => {
      const el = document.createElement("div");
      el.className = "tf2-part";
      el.textContent = t.part;
      el.title = t.partName;
      tray.appendChild(el);
      const p: Part = { toy: t, el, placed: false };
      this.parts.push(p);
      this.enableDrag(p);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
    this.remaining = this.parts.length;
  }

  private enableDrag(p: Part): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (pt: { x: number; y: number }) => {
      if (p.placed || this.locked) return;
      dragging = true;
      const r = p.el.getBoundingClientRect();
      offX = pt.x - r.left;
      offY = pt.y - r.top;
      origin = p.el.parentElement;
      p.el.classList.add("tf2-part--drag");
      p.el.style.position = "fixed";
      p.el.style.left = `${pt.x - offX}px`;
      p.el.style.top = `${pt.y - offY}px`;
      document.body.appendChild(p.el);
      sfxPop();
    };
    const onMove = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      p.el.style.left = `${pt.x - offX}px`;
      p.el.style.top = `${pt.y - offY}px`;
    };
    const onUp = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      p.el.classList.remove("tf2-part--drag");
      // 命中检测：指针落在哪个玩具
      let hitKey: string | null = null;
      for (const k of Object.keys(this.toySlots)) {
        const slot = this.toySlots[k]!;
        const r = slot.getBoundingClientRect();
        if (
          pt.x >= r.left &&
          pt.x <= r.right &&
          pt.y >= r.top &&
          pt.y <= r.bottom
        ) {
          hitKey = k;
          break;
        }
      }
      if (hitKey !== null && hitKey === p.toy.partKey) {
        // 修好：玩具变完整，零件归位进缺口
        p.placed = true;
        const slot = this.toySlots[hitKey]!;
        slot.classList.add("tf2-toy--fixed");
        const body = slot.querySelector(".tf2-body") as HTMLElement | null;
        if (body && p.toy.whole) body.textContent = p.toy.whole;
        const gap = slot.querySelector(".tf2-gap");
        if (gap) {
          gap.classList.add("tf2-gap--filled");
          gap.innerHTML = "";
          p.el.style.position = "";
          p.el.style.left = "";
          p.el.style.top = "";
          p.el.classList.add("tf2-part--in");
          gap.appendChild(p.el);
        }
        this.remaining -= 1;
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
          }, 1000);
        }
      } else {
        // 归位
        p.el.style.position = "";
        p.el.style.left = "";
        p.el.style.top = "";
        origin?.appendChild(p.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(p.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧸",
      variant: "rest",
      body: "看看每个玩具缺了什么，再找对应的零件哦～",
      primary: { text: "继续", icon: "🔧", onClick: () => ov.destroy() },
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
    if (document.getElementById("tf2-style")) return;
    const st = document.createElement("style");
    st.id = "tf2-style";
    st.textContent = TF2_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function TF2_CSS(theme: string): string {
  return `
.tf2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.tf2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.tf2-task b{color:${theme};}
.tf2-stage{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;padding:18px;background:linear-gradient(180deg,#f3f0ff,#e7deff);border-radius:22px;box-shadow:var(--shadow);width:100%;max-width:520px;box-sizing:border-box;}
.tf2-toy{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 12px;border-radius:16px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.08);min-width:88px;}
.tf2-body{font-size:2.8rem;filter:grayscale(.4) opacity(.85);transition:all .35s ease;}
.tf2-gap{width:60px;height:42px;border:3px dashed ${theme};border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(165,94,234,.06);}
.tf2-gap__hint{font-size:.8rem;font-weight:900;color:${theme};}
.tf2-gap--filled{border:none;background:transparent;}
.tf2-toy--fixed .tf2-body{filter:none;animation:tf2-pop .45s ease;}
@keyframes tf2-pop{0%{transform:scale(.8)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
.tf2-tray{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;padding:16px;background:rgba(255,255,255,.7);border-radius:22px;box-shadow:var(--shadow);max-width:520px;min-height:76px;}
.tf2-part{font-size:2.4rem;cursor:grab;touch-action:none;user-select:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));transition:transform .12s;width:58px;height:58px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:14px;box-shadow:0 2px 6px rgba(0,0,0,.12);}
.tf2-part:active{transform:scale(1.12);}
.tf2-part--drag{cursor:grabbing;transform:scale(1.3);z-index:100;}
.tf2-part--in{animation:tf2-snap .4s ease;cursor:default;}
@keyframes tf2-snap{0%{transform:scale(1.3) rotate(10deg)}60%{transform:scale(.85) rotate(-4deg)}100%{transform:scale(1) rotate(0)}}
@media (max-width:380px){.tf2-body{font-size:2.3rem;}.tf2-part{font-size:2rem;width:48px;height:48px;}.tf2-gap{width:50px;height:36px;}}
`;
}

export function create(): ToyFixGame {
  return new ToyFixGame();
}
