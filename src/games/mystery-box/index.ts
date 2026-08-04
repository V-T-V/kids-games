/* 神秘盲盒 Mystery Box —— 屏幕上 3-4 个关着的盒子，点一个"拆盲盒"，
   里面随机藏着动物/水果/形状 emoji。打开后问"你打开的是什么？"，
   从 2-3 个选项里选对名字。每轮盒子里的东西随机，孩子有拆盲盒的惊喜感。
   独特点：悬念 + 拆盒弹跳动画，强调"惊喜发现"而非单纯答题。
   视觉：盒子打开有 CSS 弹跳动画 + 物品飞出。难度=盒子数+选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface SurPrize {
  emoji: string;
  name: string;
}

/** 题库：幼儿熟悉的物品，分三类增加新鲜感。 */
const POOL: SurPrize[] = [
  { emoji: "🐶", name: "小狗" },
  { emoji: "🐱", name: "小猫" },
  { emoji: "🐰", name: "兔子" },
  { emoji: "🐻", name: "小熊" },
  { emoji: "🐼", name: "熊猫" },
  { emoji: "🐸", name: "青蛙" },
  { emoji: "🍎", name: "苹果" },
  { emoji: "🍌", name: "香蕉" },
  { emoji: "🍇", name: "葡萄" },
  { emoji: "🍓", name: "草莓" },
  { emoji: "⭐", name: "星星" },
  { emoji: "🌙", name: "月亮" },
  { emoji: "🌈", name: "彩虹" },
  { emoji: "🎈", name: "气球" },
];

export class MysteryBoxGame extends BaseGame {
  constructor() {
    super("mystery-box");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private boxN = 3;
  private pickN = 2;
  private busy = false;
  /** 本轮已放入各盒子的物品；选对的那个存 targetIdx/boxIdx。 */
  private target: SurPrize = POOL[0]!;
  private openedBox = -1;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 + trackTimeout 自动清理 */
  }

  private config(): { boxN: number; pickN: number } {
    if (this.difficulty === "easy") return { boxN: 3, pickN: 2 };
    if (this.difficulty === "medium") return { boxN: 3, pickN: 3 };
    return { boxN: 4, pickN: 3 };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    const cfg = this.config();
    this.boxN = cfg.boxN;
    this.pickN = cfg.pickN;
    this.openedBox = -1;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "myb-wrap";

    const task = document.createElement("div");
    task.className = "myb-task";
    task.innerHTML = `点一个盒子拆拆看！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "myb-stage";

    for (let i = 0; i < this.boxN; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "myb-box";
      b.setAttribute("aria-label", `盲盒 ${i + 1}`);
      b.innerHTML = `<span class="myb-box__emoji">🎁</span><span class="myb-box__bow">🎀</span>`;
      b.addEventListener("click", () => this.openBox(i, b));
      stage.appendChild(b);
    }
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private openBox(idx: number, btn: HTMLButtonElement): void {
    if (this.busy || this.openedBox === idx) return;
    this.busy = true;
    this.openedBox = idx;
    btn.classList.add("myb-box--open");
    btn.disabled = true;

    /* 随机决定打开的物品（每轮都是惊喜） */
    this.target = sample(POOL);

    /* 0.5s 动画后揭晓物品 */
    this.trackTimeout(() => {
      sfxPop();
      const rev = document.createElement("span");
      rev.className = "myb-box__reveal";
      rev.textContent = this.target.emoji;
      btn.querySelector(".myb-box__emoji")!.replaceWith(rev);
      btn.querySelector(".myb-box__bow")?.remove();

      /* 再等一会显示提问选项 */
      this.trackTimeout(() => this.askName(btn), 750);
    }, 480);
  }

  private askName(boxBtn: HTMLButtonElement): void {
    const r = boxBtn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    /* 构造选项：含正确答案 + 干扰项 */
    const distractors = shuffle(POOL.filter((p) => p.name !== this.target.name))
      .slice(0, this.pickN - 1)
      .map((p) => p.name);
    const choices = shuffle([this.target.name, ...distractors]);

    const panel = document.createElement("div");
    panel.className = "myb-ask";
    const q = document.createElement("div");
    q.className = "myb-ask__q";
    q.textContent = "你打开的是什么？";
    panel.appendChild(q);

    const opts = document.createElement("div");
    opts.className = "myb-ask__opts";
    for (const c of choices) {
      const ob = document.createElement("button");
      ob.type = "button";
      ob.className = "myb-opt";
      ob.textContent = c;
      ob.addEventListener("click", () => this.answer(c, ob, cx, cy));
      opts.appendChild(ob);
    }
    panel.appendChild(opts);

    /* 插到舞台下方 */
    const wrap = this.root.querySelector(".myb-wrap")!;
    wrap.appendChild(panel);
  }

  private answer(
    choice: string,
    btn: HTMLButtonElement,
    cx: number,
    cy: number,
  ): void {
    const opts = btn.parentElement!;
    Array.from(opts.querySelectorAll(".myb-opt")).forEach((o) =>
      (o as HTMLButtonElement).setAttribute("disabled", "true"),
    );
    if (choice === this.target.name) {
      btn.classList.add("myb-opt--ok");
      this.onCorrect(cx, cy);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      btn.classList.add("myb-opt--no");
      /* 高亮正确项 */
      Array.from(opts.querySelectorAll(".myb-opt")).forEach((o) => {
        const el = o as HTMLButtonElement;
        if (el.textContent === this.target.name)
          el.classList.add("myb-opt--ok");
      });
      const paused = this.onWrong();
      if (paused) {
        this.trackTimeout(() => this.showRest(), 900);
      } else {
        this.trackTimeout(() => this.startRound(), 1400);
      }
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再想想你打开了什么～",
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
    if (document.getElementById("myb-style")) return;
    const st = document.createElement("style");
    st.id = "myb-style";
    st.textContent = MYB_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function MYB_CSS(theme: string): string {
  return `
.myb-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(560px,100%);}
.myb-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;}
.myb-stage{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:18px;width:100%;min-height:220px;padding:30px 12px;background:radial-gradient(ellipse at 50% 30%,rgba(255,107,157,.18),transparent 70%),linear-gradient(180deg,#fff0f5,#ffe0ec);border-radius:24px;box-shadow:var(--shadow);}
.myb-box{position:relative;font-size:0;background:transparent;border:none;cursor:pointer;width:96px;height:108px;display:flex;align-items:center;justify-content:center;transition:transform .3s cubic-bezier(.5,1.6,.5,1);transform-origin:50% 100%;filter:drop-shadow(0 6px 6px rgba(0,0,0,.22));}
.myb-box:hover{transform:translateY(-4px) scale(1.03);}
.myb-box:active{transform:scale(.92);}
.myb-box__emoji{font-size:4rem;line-height:1;display:block;}
.myb-box__bow{position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:1.5rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
.myb-box--open{animation:myb-shake .45s ease;}
.myb-box__reveal{font-size:4.4rem;line-height:1;display:block;animation:myb-pop .5s cubic-bezier(.3,1.6,.4,1);}
@keyframes myb-shake{0%{transform:rotate(0)}20%{transform:rotate(-8deg) scale(1.05)}40%{transform:rotate(7deg) scale(1.08)}60%{transform:rotate(-5deg)}80%{transform:rotate(3deg)}100%{transform:rotate(0)}}
@keyframes myb-pop{0%{transform:scale(0) translateY(20px);opacity:0}60%{transform:scale(1.3) translateY(-6px);opacity:1}100%{transform:scale(1) translateY(0)}}
.myb-ask{display:flex;flex-direction:column;align-items:center;gap:14px;background:#fff;padding:20px 24px;border-radius:20px;box-shadow:var(--shadow);animation:myb-fadein .3s ease;}
@keyframes myb-fadein{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.myb-ask__q{font-size:1.2rem;font-weight:800;color:#333;}
.myb-ask__opts{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;}
.myb-opt{min-width:96px;min-height:52px;padding:10px 18px;font-size:1.15rem;font-weight:700;border-radius:14px;border:3px solid ${theme};background:#fff;color:#333;cursor:pointer;transition:transform .12s,background .2s;}
.myb-opt:hover{transform:translateY(-2px);}
.myb-opt:active{transform:scale(.95);}
.myb-opt--ok{background:${theme};color:#fff;border-color:${theme};}
.myb-opt--no{background:#eee;color:#999;border-color:#ccc;}
@media (max-width:380px){.myb-box__emoji{font-size:3.2rem;}.myb-box__reveal{font-size:3.5rem;}.myb-box{width:80px;height:96px;}}
`;
}

export function create(): MysteryBoxGame {
  return new MysteryBoxGame();
}
