/* 鞋店配对 Shoe Shop —— 几双不同颜色/大小的鞋子，左脚鞋已排好，
   孩子把右脚鞋拖到同色的左脚鞋旁完成配对。
   独特点：左右脚配对概念 + 颜色匹配，右脚鞋镜像翻转区分左右。
   视觉：鞋子 emoji（左脚/右脚翻转）。难度=对数。通关=配对目标轮数。
   用 bindPointer 实现拖拽。前缀 sh2-（避免与 sorting-hat/shadow-match 冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Shoe {
  /** 颜色键（配对依据） */
  key: string;
  /** 颜色名（给提示用） */
  name: string;
  /** 颜色 hex */
  hex: string;
  /** 鞋子 emoji */
  emoji: string;
}

const SHOE_COLORS = [
  { key: "red", name: "红色", hex: "#ef5350" },
  { key: "blue", name: "蓝色", hex: "#42a5f5" },
  { key: "yellow", name: "黄色", hex: "#ffca28" },
  { key: "green", name: "绿色", hex: "#66bb6a" },
  { key: "purple", name: "紫色", hex: "#ab47bc" },
  { key: "orange", name: "橙色", hex: "#ff9f43" },
];

const SHOE_EMOJI = ["👟", "👞", "👠", "🥿", "🥾", "👢"];

interface RightShoe {
  shoe: Shoe;
  el: HTMLElement;
  matched: boolean;
}

export class ShoeShopGame extends BaseGame {
  constructor() {
    super("shoe-shop");
  }

  private unbinds: (() => void)[] = [];
  private leftSlots: Record<string, HTMLElement> = {};
  private rights: RightShoe[] = [];
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

  /** 配对数量（对数） */
  private pairCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.leftSlots = {};
    this.rights = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.pairCount();
    // 选 n 种颜色，每种给一个固定 emoji（区分大小/款式），保证每对唯一可解
    const colors = shuffle(SHOE_COLORS).slice(0, n);
    const emojis = shuffle(SHOE_EMOJI).slice(0, n);
    const shoes: Shoe[] = colors.map((c, i) => ({
      key: c.key,
      name: c.name,
      hex: c.hex,
      emoji: emojis[i] ?? "👟",
    }));

    const wrap = document.createElement("div");
    wrap.className = "sh2-wrap";

    const task = document.createElement("div");
    task.className = "sh2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把<b>右脚鞋</b>拖到同色的<b>左脚鞋</b>旁边 👞`;
    wrap.appendChild(task);

    // 左脚鞋货架（已排好，每只一个目标位）
    const shelf = document.createElement("div");
    shelf.className = "sh2-shelf";
    shoes.forEach((s) => {
      const slot = document.createElement("div");
      slot.className = "sh2-slot";
      slot.dataset.key = s.key;
      slot.style.setProperty("--sh2-c", s.hex);
      slot.innerHTML = `<div class="sh2-left" title="${s.name}左脚">${s.emoji}</div><div class="sh2-target" data-key="${s.key}"></div>`;
      shelf.appendChild(slot);
      this.leftSlots[s.key] = slot;
    });
    wrap.appendChild(shelf);

    // 右脚鞋区（打乱）
    const tray = document.createElement("div");
    tray.className = "sh2-tray";
    const shuffled = shuffle(shoes);
    shuffled.forEach((s) => {
      const el = document.createElement("div");
      el.className = "sh2-right";
      el.style.setProperty("--sh2-c", s.hex);
      el.textContent = s.emoji;
      el.title = `${s.name}右脚`;
      tray.appendChild(el);
      const rs: RightShoe = { shoe: s, el, matched: false };
      this.rights.push(rs);
      this.enableDrag(rs);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
    this.remaining = this.rights.length;
  }

  private enableDrag(rs: RightShoe): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (rs.matched || this.locked) return;
      dragging = true;
      const r = rs.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = rs.el.parentElement;
      rs.el.classList.add("sh2-right--drag");
      rs.el.style.position = "fixed";
      rs.el.style.left = `${p.x - offX}px`;
      rs.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(rs.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      rs.el.style.left = `${p.x - offX}px`;
      rs.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      rs.el.classList.remove("sh2-right--drag");
      // 命中检测：指针落在哪个左脚槽
      let hitKey: string | null = null;
      for (const k of Object.keys(this.leftSlots)) {
        const slot = this.leftSlots[k]!;
        const r = slot.getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hitKey = k;
          break;
        }
      }
      if (hitKey !== null && hitKey === rs.shoe.key) {
        // 配对成功：放到目标位
        rs.matched = true;
        rs.el.style.position = "";
        rs.el.style.left = "";
        rs.el.style.top = "";
        rs.el.classList.add("sh2-right--in");
        const target = this.leftSlots[hitKey]!.querySelector(".sh2-target");
        if (target) target.appendChild(rs.el);
        this.remaining -= 1;
        const r = this.leftSlots[hitKey]!.getBoundingClientRect();
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
        // 归位
        rs.el.style.position = "";
        rs.el.style.left = "";
        rs.el.style.top = "";
        origin?.appendChild(rs.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(rs.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "👞",
      variant: "rest",
      body: "看看右脚鞋是什么颜色，找同色的左脚鞋哦～",
      primary: { text: "继续", icon: "👟", onClick: () => ov.destroy() },
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
    if (document.getElementById("sh2-style")) return;
    const st = document.createElement("style");
    st.id = "sh2-style";
    st.textContent = SH2_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function SH2_CSS(theme: string): string {
  return `
.sh2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.sh2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sh2-task b{color:${theme};}
.sh2-shelf{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding:18px 14px 26px;background:linear-gradient(180deg,#f7e7ce,#e7d3b0);border-radius:20px;box-shadow:var(--shadow);width:100%;max-width:520px;}
.sh2-slot{position:relative;display:flex;align-items:center;gap:4px;padding:6px;border-radius:14px;background:rgba(255,255,255,.55);min-width:84px;}
.sh2-left{font-size:2.6rem;transform:scaleX(-1);filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
.sh2-target{width:48px;height:48px;border:3px dashed var(--sh2-c,#888);border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.4);}
.sh2-tray{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:16px;background:rgba(255,255,255,.7);border-radius:22px;box-shadow:var(--shadow);max-width:520px;min-height:76px;}
.sh2-right{font-size:2.6rem;cursor:grab;touch-action:none;user-select:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));transition:transform .12s;background:var(--sh2-c,#888);border-radius:14px;width:60px;height:60px;display:flex;align-items:center;justify-content:center;}
.sh2-right:active{transform:scale(1.12);}
.sh2-right--drag{cursor:grabbing;transform:scale(1.25);z-index:100;}
.sh2-right--in{animation:sh2-snap .4s ease;cursor:default;}
@keyframes sh2-snap{0%{transform:scale(1.25) rotate(-8deg)}60%{transform:scale(.85) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
@media (max-width:380px){.sh2-left,.sh2-right{font-size:2.1rem;}.sh2-right{width:50px;height:50px;}.sh2-target{width:40px;height:40px;}}
`;
}

export function create(): ShoeShopGame {
  return new ShoeShopGame();
}
