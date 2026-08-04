/* 托盘记忆 Memory-Tray —— 托盘展示几样物品 3 秒后盖住，选出全部出现过的。
   独特点：先记忆后回忆，训练短时视觉记忆 + 选择性注意。
   视觉：托盘 + 物品 emoji，盖布动画。难度=物品数。
   通关=记对目标轮数。前缀 mtr- 避免冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const ITEM_POOL = [
  { emoji: "🍎", name: "苹果" },
  { emoji: "🍌", name: "香蕉" },
  { emoji: "🍪", name: "饼干" },
  { emoji: "🥛", name: "牛奶" },
  { emoji: "🍇", name: "葡萄" },
  { emoji: "🧀", name: "奶酪" },
  { emoji: "🍓", name: "草莓" },
  { emoji: "🥕", name: "胡萝卜" },
  { emoji: "🍞", name: "面包" },
  { emoji: "🍊", name: "橙子" },
  { emoji: "🥚", name: "鸡蛋" },
  { emoji: "🍫", name: "巧克力" },
];

const ENCOURAGE = ["记性真好！", "仔细回忆一下～", "真棒！", "差一点点！"];
type Phase = "show" | "hide" | "ask";

export class MemoryTrayGame extends BaseGame {
  constructor() {
    super("memory-tray");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private shown: { emoji: string; name: string }[] = [];
  private selected = new Set<string>();
  private correctSet = new Set<string>();
  private locked = false;
  private phase: Phase = "show";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空，trackTimeout 由基类清理 */
  }

  private itemCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }
  /** 干扰选项数：easy 1，medium 2，hard 3 */
  private distractorCount(): number {
    return this.difficulty === "easy" ? 3: this.difficulty === "medium"
        ? 4
        : 6;
  }
  private showMs(): number {
    return this.difficulty === "easy"
      ? 3500
      : this.difficulty === "medium"
        ? 3000
        : 3000;
  }

  private startRound(): void {
    this.locked = false;
    this.phase = "show";
    this.selected.clear();
    this.correctSet.clear();
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.itemCount();
    const shown = shuffle(ITEM_POOL).slice(0, n);
    this.shown = shown;
    this.correctSet = new Set(shown.map((s) => s.emoji));

    const wrap = document.createElement("div");
    wrap.className = "mtr-wrap";

    const task = document.createElement("div");
    task.className = "mtr-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 记住托盘里的<b>每一样</b>东西！`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "mtr-hint";
    hint.id = "mtr-hint";
    hint.textContent = "仔细看，准备记忆…";
    wrap.appendChild(hint);

    /* 托盘 */
    const tray = document.createElement("div");
    tray.className = "mtr-tray";
    tray.id = "mtr-tray";
    shown.forEach((s) => {
      const it = document.createElement("div");
      it.className = "mtr-item";
      it.textContent = s.emoji;
      tray.appendChild(it);
    });
    /* 盖布（默认隐藏） */
    const cover = document.createElement("div");
    cover.className = "mtr-cover";
    cover.id = "mtr-cover";
    cover.textContent = "🧺";
    tray.appendChild(cover);
    wrap.appendChild(tray);

    /* 选项区（默认隐藏） */
    const optBox = document.createElement("div");
    optBox.className = "mtr-opts";
    optBox.id = "mtr-opts";
    wrap.appendChild(optBox);

    /* 完成按钮 */
    const done = document.createElement("button");
    done.type = "button";
    done.className = "mtr-done";
    done.id = "mtr-done";
    done.textContent = "选好了！";
    done.style.display = "none";
    done.addEventListener("click", () => this.check());
    wrap.appendChild(done);

    this.root.appendChild(wrap);

    /* 倒计时盖布 */
    this.trackTimeout(() => {
      if (this.phase !== "show") return;
      this.phase = "hide";
      const cv = this.root.querySelector("#mtr-cover") as HTMLElement | null;
      if (cv) cv.classList.add("mtr-cover--on");
      const ht = this.root.querySelector("#mtr-hint");
      if (ht) ht.textContent = "盖住啦！刚才托盘里有什么？";
      this.trackTimeout(() => this.ask(), 600);
    }, this.showMs());
  }

  private ask(): void {
    this.phase = "ask";
    const optBox = this.root.querySelector<HTMLElement>("#mtr-opts");
    if (!optBox) return;
    /* 选项 = 正确物品 + 干扰 */
    const distractors = shuffle(
      ITEM_POOL.filter((p) => !this.correctSet.has(p.emoji)),
    ).slice(0, this.distractorCount());
    const opts = shuffle([...this.shown, ...distractors]);
    opts.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mtr-opt";
      b.dataset.emoji = o.emoji;
      b.innerHTML = `<span class="mtr-opt-emoji">${o.emoji}</span><span class="mtr-opt-name">${o.name}</span>`;
      b.setAttribute("aria-label", o.name);
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => this.toggle(b, o.emoji));
      optBox.appendChild(b);
    });
    const done = this.root.querySelector<HTMLButtonElement>("#mtr-done");
    if (done) done.style.display = "";
    const ht = this.root.querySelector("#mtr-hint");
    if (ht)
      ht.innerHTML = `选出刚才<b>全部出现过的</b>东西（共 ${this.correctSet.size} 个）`;
  }

  private toggle(btn: HTMLButtonElement, emoji: string): void {
    if (this.locked || this.phase !== "ask") return;
    if (this.selected.has(emoji)) {
      this.selected.delete(emoji);
      btn.classList.remove("mtr-opt--on");
      btn.setAttribute("aria-pressed", "false");
    } else {
      this.selected.add(emoji);
      btn.classList.add("mtr-opt--on");
      btn.setAttribute("aria-pressed", "true");
      sfxPop();
    }
  }

  private check(): void {
    if (this.locked || this.phase !== "ask") return;
    const same =
      this.selected.size === this.correctSet.size &&
      [...this.correctSet].every((e) => this.selected.has(e));
    if (same) {
      this.locked = true;
      const r = (
        this.root.querySelector("#mtr-done") as HTMLElement
      ).getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      /* 揭开盖布展示答对 */
      const cv = this.root.querySelector("#mtr-cover");
      cv?.classList.remove("mtr-cover--on");
      this.root
        .querySelectorAll(".mtr-opt--on")
        .forEach((el) => el.classList.add("mtr-opt--right"));
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      this.root.querySelectorAll<HTMLButtonElement>(".mtr-opt").forEach((b) => {
        const em = b.dataset.emoji!;
        const picked = this.selected.has(em);
        const should = this.correctSet.has(em);
        if (picked && !should) b.classList.add("mtr-opt--wrong");
        if (!picked && should) b.classList.add("mtr-opt--miss");
      });
      const paused = this.onWrong();
      this.trackTimeout(() => {
        this.root
          .querySelectorAll(".mtr-opt--wrong,.mtr-opt--miss")
          .forEach((el) =>
            el.classList.remove("mtr-opt--wrong", "mtr-opt--miss"),
          );
      }, 700);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍽️",
      variant: "rest",
      body: `回忆刚才托盘上每一样东西，不能多也不能少。 ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("mtr-style")) return;
    const st = document.createElement("style");
    st.id = "mtr-style";
    st.textContent = MTR_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function MTR_CSS(theme: string): string {
  return `
.mtr-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.mtr-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.mtr-hint{font-size:.95rem;font-weight:700;color:#555;text-align:center;min-height:1.4em;}
.mtr-tray{position:relative;display:flex;flex-wrap:wrap;gap:14px;justify-content:center;align-items:center;padding:24px;background:linear-gradient(180deg,rgba(255,255,255,.85),${theme}22);border:3px solid ${theme};border-radius:24px;box-shadow:var(--shadow);min-height:130px;min-width:280px;}
.mtr-item{font-size:3.2rem;line-height:1;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));animation:mtr-in .4s ease;}
@keyframes mtr-in{0%{transform:scale(.4);opacity:0}100%{transform:scale(1);opacity:1}}
.mtr-cover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:5rem;background:linear-gradient(180deg,#fff8,${theme});border-radius:20px;opacity:0;pointer-events:none;transform:scale(.5);transition:opacity .3s,transform .3s;}
.mtr-cover--on{opacity:1;transform:scale(1);}
.mtr-opts{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:480px;min-height:60px;}
.mtr-opt{width:84px;height:92px;border:none;border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.1),0 5px 8px rgba(0,0,0,.1);transition:transform .12s;border:3px solid transparent;}
.mtr-opt:active{transform:translateY(2px);}
.mtr-opt-emoji{font-size:2.2rem;line-height:1;}
.mtr-opt-name{font-size:.68rem;font-weight:700;color:#555;}
.mtr-opt--on{border-color:${theme};background:linear-gradient(180deg,#fff,${theme}33);transform:translateY(-2px);}
.mtr-opt--right{border-color:#6bcf7f;background:linear-gradient(180deg,#e0ffe4,#bff0c1);animation:mtr-pop .4s ease;}
.mtr-opt--wrong{border-color:#ff6348;background:linear-gradient(180deg,#ffe0d8,#ffc4b8);animation:mtr-shake .5s ease;}
.mtr-opt--miss{border-color:#ffd93d;background:linear-gradient(180deg,#fff7cf,#ffe88a);animation:mtr-pulse .6s ease;}
@keyframes mtr-pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes mtr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@keyframes mtr-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.mtr-done{border:none;border-radius:999px;padding:13px 30px;font-size:1.15rem;font-weight:900;color:#fff;background:linear-gradient(180deg,${theme},#0a9aa0);box-shadow:0 4px 0 #0a7a80;cursor:pointer;}
.mtr-done:active{transform:translateY(2px);}
@media (max-width:380px){.mtr-item{font-size:2.6rem;}.mtr-opt{width:70px;height:80px;}.mtr-opt-emoji{font-size:1.9rem;}.mtr-cover{font-size:4rem;}}
`;
}

export function create(): MemoryTrayGame {
  return new MemoryTrayGame();
}
