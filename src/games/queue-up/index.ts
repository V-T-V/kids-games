/* 排队礼仪 Queue Up —— 看场景图判断对错（插队❌ / 排队✅）。
   社交启蒙：公共场合的秩序感。独特点：用一组小人在场景里的排列方式，
   让孩子判断这是不是有礼貌的排队。前缀 qqu-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Scene {
  /** 场景图（人物队列 emoji） */
  pic: string;
  desc: string;
  /** true = 这是礼貌排队 */
  polite: boolean;
  tag: string;
}

const SCENES: Scene[] = [
  {
    pic: "🧒👧👦🧒 — 🚻",
    desc: "大家在厕所门口一个接一个等",
    polite: true,
    tag: "一个接一个",
  },
  {
    pic: "👧🧒  🚪  (👦冲到最前面)",
    desc: "小男孩从后面冲到最前面",
    polite: false,
    tag: "插队",
  },
  {
    pic: "🧒 → 🧒 → 🧒 → 🍦",
    desc: "买冰淇淋时一个接一个排好队",
    polite: true,
    tag: "排队",
  },
  {
    pic: "🧒🧒🧒  +  (👦挤进来)",
    desc: "小男孩硬挤到别人前面",
    polite: false,
    tag: "硬挤",
  },
  {
    pic: "👦 ← 🧒 ← 👧 ← 🚌",
    desc: "上公交车时一个接一个",
    polite: true,
    tag: "排队上车",
  },
  {
    pic: "👧🧒  ⬅️  (👦推开)",
    desc: "小男孩把别人推开自己先上",
    polite: false,
    tag: "推开别人",
  },
  {
    pic: "🧒👧👦 → 🎠",
    desc: "玩滑梯时排队等前面滑下去",
    polite: true,
    tag: "排队玩",
  },
  {
    pic: "👧  ⬇️  (👦抢到前面)",
    desc: "小男孩抢到小女孩前面抢先滑",
    polite: false,
    tag: "抢先",
  },
];

export class QueueUpGame extends BaseGame {
  constructor() {
    super("queue-up");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const sc = sample(SCENES);

    const wrap = document.createElement("div");
    wrap.className = "qqu-wrap";

    const task = document.createElement("div");
    task.className = "qqu-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 这样做<b>对</b>还是<b>不对</b>？`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "qqu-scene";
    scene.innerHTML = `<div class="qqu-pic">${sc.pic}</div><div class="qqu-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "qqu-opts";
    const correct = { label: "✅ 对", good: true };
    const wrong = { label: "❌ 不对", good: false };
    for (const o of shuffle([correct, wrong])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qqu-opt";
      b.textContent = o.label;
      b.addEventListener("click", () => this.choose(o.good === sc.polite, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(right: boolean, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (right) {
      this.locked = true;
      sfxPop();
      btn.classList.add("qqu-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("qqu-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("qqu-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🧍",
      variant: "rest",
      body: "排队是要一个接一个哦，插队和挤人会让人不开心的～",
      primary: { text: "继续", icon: "🚶", onClick: () => ov.destroy() },
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
    if (document.getElementById("qqu-style")) return;
    const st = document.createElement("style");
    st.id = "qqu-style";
    st.textContent = QQU_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function QQU_CSS(theme: string): string {
  return `
.qqu-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.qqu-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.qqu-task b{color:${theme};}
.qqu-scene{background:linear-gradient(180deg,#f0fbff,#e3f5ff);padding:24px 22px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.qqu-pic{font-size:1.8rem;font-weight:900;letter-spacing:2px;line-height:1.5;}
.qqu-desc{font-size:1.1rem;font-weight:800;color:#345;margin-top:10px;}
.qqu-opts{display:flex;gap:18px;}
.qqu-opt{padding:18px 36px;font-size:1.4rem;font-weight:900;border-radius:20px;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;}
.qqu-opt:active{transform:scale(.92);}
.qqu-opt--done{background:#d4f4dd;animation:qqu-pop .4s ease;}
.qqu-opt--wrong{background:#ffe0e0;animation:qqu-shake .4s ease;}
@keyframes qqu-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes qqu-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): QueueUpGame {
  return new QueueUpGame();
}
