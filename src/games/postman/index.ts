/* 邮递员 Postman —— 把每封信送到门牌号相同的信箱。
   独特点：数字配对拖拽，训练数字识别 + 一一对应（区别于 cookie-count 的"选数"）。
   视觉：信封 emoji + 带门牌号的信箱。难度=信数。通关=送对目标轮数。
   用 bindPointer 拖拽。巧思：信箱与信的门牌号一一对应（不重复），保证可解。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample, randInt } from "../../lobby/util.ts";

interface Letter {
  num: number;
  el: HTMLElement;
  placed: boolean;
}

interface Box {
  num: number;
  el: HTMLElement;
  filled: boolean;
}

const ENCOURAGE = [
  "送对啦！",
  "门牌号认得真准！",
  "你是好邮递员！",
  "看清楚号码再送哦～",
];

export class PostmanGame extends BaseGame {
  constructor() {
    super("postman");
  }

  private unbinds: (() => void)[] = [];
  private letters: Letter[] = [];
  private boxes: Box[] = [];
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

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.letters = [];
    this.boxes = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    this.remaining = n;

    // 生成 n 个不重复门牌号（保证一一对应，可解）
    const nums = new Set<number>();
    let guard = 0;
    while (nums.size < n && guard < 200) {
      guard += 1;
      nums.add(randInt(1, 20));
    }
    // 兜底：若仍未凑够，顺序补
    let f = 1;
    while (nums.size < n) {
      nums.add(f);
      f += 1;
    }
    const all = [...nums];

    const wrap = document.createElement("div");
    wrap.className = "pm2-wrap";

    const task = document.createElement("div");
    task.className = "pm2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把信送到门牌号一样的信箱 📮`;
    wrap.appendChild(task);

    // 信箱区（按门牌号排好）
    const boxRow = document.createElement("div");
    boxRow.className = "pm2-boxes";
    shuffle(all).forEach((num) => {
      const el = document.createElement("div");
      el.className = "pm2-box";
      el.dataset.num = String(num);
      el.innerHTML = `<div class="pm2-box-num">${num}</div><div class="pm2-box-slot"></div>`;
      boxRow.appendChild(el);
      this.boxes.push({ num, el, filled: false });
    });
    wrap.appendChild(boxRow);

    // 信件区（打乱）
    const tray = document.createElement("div");
    tray.className = "pm2-tray";
    tray.id = "pm2-tray";
    shuffle(all).forEach((num) => {
      const el = document.createElement("div");
      el.className = "pm2-letter";
      el.dataset.num = String(num);
      el.innerHTML = `✉️<span class="pm2-letter-num">${num}</span>`;
      tray.appendChild(el);
      const lt: Letter = { num, el, placed: false };
      this.letters.push(lt);
      this.enableDrag(lt);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(lt: Letter): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (lt.placed || this.locked) return;
      dragging = true;
      const r = lt.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = lt.el.parentElement;
      lt.el.classList.add("pm2-letter--drag");
      lt.el.style.position = "fixed";
      lt.el.style.left = `${p.x - offX}px`;
      lt.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(lt.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      lt.el.style.left = `${p.x - offX}px`;
      lt.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      lt.el.classList.remove("pm2-letter--drag");
      // 找命中的信箱（号码相同且未填）
      let hit: Box | null = null;
      for (const b of this.boxes) {
        if (b.filled || b.num !== lt.num) continue;
        const r = b.el.getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hit = b;
          break;
        }
      }
      if (hit) {
        lt.placed = true;
        hit.filled = true;
        lt.el.style.position = "";
        lt.el.style.left = "";
        lt.el.style.top = "";
        lt.el.classList.add("pm2-letter--in");
        const slot = hit.el.querySelector(".pm2-box-slot");
        if (slot) slot.appendChild(lt.el);
        hit.el.classList.add("pm2-box--filled");
        this.remaining -= 1;
        const r = hit.el.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.locked = true;
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 900);
        }
      } else {
        lt.el.style.position = "";
        lt.el.style.left = "";
        lt.el.style.top = "";
        origin?.appendChild(lt.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(lt.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "📮",
      variant: "rest",
      body: `看信上的号和信箱上的号一样，再送进去～ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("pm2-style")) return;
    const st = document.createElement("style");
    st.id = "pm2-style";
    st.textContent = PM2_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function PM2_CSS(theme: string): string {
  return `
.pm2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.pm2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pm2-boxes{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);}
.pm2-box{width:84px;background:linear-gradient(180deg,#fff,#ffe9c2);border:3px solid #e0a23a;border-radius:14px 14px 6px 6px;box-shadow:var(--shadow);overflow:hidden;transition:transform .2s ease;}
.pm2-box--filled{transform:translateY(2px);}
.pm2-box-num{font-size:1.3rem;font-weight:900;color:${theme};text-align:center;background:#fff;padding:2px 0;border-bottom:2px dashed #e0a23a;}
.pm2-box-slot{min-height:90px;display:flex;align-items:flex-start;justify-content:center;padding-top:4px;}
.pm2-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;min-height:72px;}
.pm2-letter{position:relative;font-size:2.6rem;cursor:grab;touch-action:none;user-select:none;line-height:1;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));transition:transform .12s;}
.pm2-letter:active{transform:scale(1.08);}
.pm2-letter--drag{cursor:grabbing;transform:scale(1.15);z-index:100;}
.pm2-letter-num{position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);font-size:.95rem;font-weight:900;color:#c0392b;background:#fff;border-radius:999px;padding:0 6px;border:1px solid #c0392b;}
.pm2-letter--in{animation:pm2-drop .4s ease;cursor:default;font-size:2rem;}
@keyframes pm2-drop{0%{transform:translateY(-30px) scale(.6);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
@media (max-width:380px){.pm2-box{width:72px;}.pm2-letter{font-size:2.2rem;}}
`;
}

export function create(): PostmanGame {
  return new PostmanGame();
}
