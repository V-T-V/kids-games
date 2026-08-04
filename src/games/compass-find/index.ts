/* 指南针找方向 Compass Find —— 一个指南针（盘面标了东南西北），
   红针指向某个方向，孩子从方向选项里选出"针指向哪个方向"。
   独特点：方位辨识——把抽象方向具象成指针角度。
   巧思：难度=方向数（easy 北/南/东/西 4 向；medium 加东南/西南/东北/西北 8 向；
         hard 从 8 向中给出更刁的角度并打乱盘面朝向）。
   视觉：指南针盘面（带刻度 + NESW）+ 红针 + 方向按钮。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 8 个方向，按顺时针：0°=北。 */
const DIRS8 = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"] as const;
type Dir = (typeof DIRS8)[number];

/** 方向 → 针指向角度（顺时针，0°朝上=北）。 */
function dirAngle(d: Dir): number {
  const idx = DIRS8.indexOf(d);
  return idx * 45;
}

export class CompassFindGame extends BaseGame {
  constructor() {
    super("compass-find");
  }

  private answer: Dir = "北";
  private choices: Dir[] = [];
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空，无 RAF */
  }

  /** 当前难度可选方向集。 */
  private dirSet(): readonly Dir[] {
    return this.difficulty === "easy" ? ["北", "南", "东", "西"] : DIRS8;
  }

  /** 生成保证可解的题：从当前难度方向集里随机一个作为答案，
   *  备选包含答案 + 若干干扰项（互不相同）。 */
  private genRound(): { answer: Dir; choices: Dir[] } {
    const set = this.dirSet();
    const answer = sample(set);
    // 备选数量随难度：easy 3、medium 4、hard 5（从 8 向里取，干扰更多）
    const choiceN =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const pool = shuffle(set.filter((d) => d !== answer));
    const choices = shuffle([answer, ...pool.slice(0, choiceN - 1)]);
    return { answer, choices };
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const { answer, choices } = this.genRound();
    this.answer = answer;
    this.choices = choices;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "cpf-wrap";

    const task = document.createElement("div");
    task.className = "cpf-task";
    task.innerHTML = `红色指针指向<b>哪个方向</b>？ ${this.roundsDone + 1} / ${this.roundTotal}`;
    wrap.appendChild(task);

    const dial = document.createElement("div");
    dial.className = "cpf-dial";
    // 盘面字母
    const marks: Array<{ txt: string; cls: string }> = [
      { txt: "北", cls: "cpf-n" },
      { txt: "东", cls: "cpf-e" },
      { txt: "南", cls: "cpf-s" },
      { txt: "西", cls: "cpf-w" },
    ];
    for (const m of marks) {
      const el = document.createElement("span");
      el.className = `cpf-mark ${m.cls}`;
      el.textContent = m.txt;
      dial.appendChild(el);
    }
    // 小刻度
    for (let i = 0; i < 8; i++) {
      const tick = document.createElement("span");
      tick.className = "cpf-tick";
      tick.style.transform = `rotate(${i * 45}deg)`;
      dial.appendChild(tick);
    }
    // 指针
    const needle = document.createElement("div");
    needle.className = "cpf-needle";
    needle.style.transform = `translate(-50%,-50%) rotate(${dirAngle(this.answer)}deg)`;
    needle.innerHTML = `<span class="cpf-needle-n"></span><span class="cpf-needle-s"></span>`;
    dial.appendChild(needle);
    // 中心钉
    const cap = document.createElement("div");
    cap.className = "cpf-cap";
    dial.appendChild(cap);
    wrap.appendChild(dial);

    // 提示口诀
    const tip = document.createElement("div");
    tip.className = "cpf-tip";
    tip.textContent = "上北下南，左西右东～";
    wrap.appendChild(tip);

    // 方向选项
    const opts = document.createElement("div");
    opts.className = "cpf-opts";
    for (const d of this.choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cpf-opt";
      b.textContent = d;
      b.addEventListener("click", () => this.choose(d, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(d: Dir, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const ok = d === this.answer;
    if (ok) {
      btn.classList.add("cpf-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    } else {
      btn.classList.add("cpf-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".cpf-opt--wrong")
          .forEach((el) => el.classList.remove("cpf-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("cpf-style")) return;
    const st = document.createElement("style");
    st.id = "cpf-style";
    st.textContent = CPF_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function CPF_CSS(theme: string): string {
  return `
.cpf-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;}
.cpf-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.cpf-task b{color:${theme};}
.cpf-dial{position:relative;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle at 50% 40%,#fff,#e0e0e0);box-shadow:inset 0 0 0 6px #fff,0 0 0 6px ${theme}33,inset 0 -8px 14px rgba(0,0,0,.12),var(--shadow);}
.cpf-mark{position:absolute;left:50%;top:50%;font-size:1.1rem;font-weight:900;color:#37474f;transform:translate(-50%,-50%);}
.cpf-n{transform:translate(-50%,-50%) translateY(-104px);color:#c62828;}
.cpf-s{transform:translate(-50%,-50%) translateY(104px);}
.cpf-e{transform:translate(-50%,-50%) translateX(104px);}
.cpf-w{transform:translate(-50%,-50%) translateX(-104px);}
.cpf-tick{position:absolute;left:50%;top:6px;width:3px;height:12px;background:#90a4ae;transform-origin:50% 114px;}
.cpf-needle{position:absolute;left:50%;top:50%;width:12px;height:120px;transform-origin:center center;z-index:3;transition:transform .5s cubic-bezier(.34,1.56,.64,1);}
.cpf-needle-n,.cpf-needle-s{position:absolute;left:50%;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;}
.cpf-needle-n{top:-54px;border-bottom:60px solid #e53935;transform:translateX(-50%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));}
.cpf-needle-s{top:6px;border-top:60px solid #546e7a;transform:translateX(-50%);}
.cpf-cap{position:absolute;left:50%;top:50%;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#37474f);transform:translate(-50%,-50%);z-index:4;box-shadow:0 2px 3px rgba(0,0,0,.3);}
.cpf-tip{font-size:.85rem;color:var(--ink-soft);font-weight:700;background:#fff;padding:5px 16px;border-radius:999px;box-shadow:var(--shadow);}
.cpf-opts{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:380px;}
.cpf-opt{min-width:78px;min-height:56px;padding:8px 14px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#f0f0f5);box-shadow:var(--shadow);cursor:pointer;font-size:1.2rem;font-weight:900;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;}
.cpf-opt:active{transform:scale(.94);}
.cpf-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:cpf-yes .4s ease;}
@keyframes cpf-yes{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
.cpf-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:cpf-no .3s ease;}
@keyframes cpf-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.cpf-dial{width:200px;height:200px;}.cpf-n{transform:translate(-50%,-50%) translateY(-86px);}.cpf-s{transform:translate(-50%,-50%) translateY(86px);}.cpf-e{transform:translate(-50%,-50%) translateX(86px);}.cpf-w{transform:translate(-50%,-50%) translateX(-86px);}.cpf-needle{height:100px;}.cpf-needle-n{top:-44px;border-bottom-width:50px;}.cpf-needle-s{top:4px;border-top-width:50px;}}
`;
}

export function create(): CompassFindGame {
  return new CompassFindGame();
}
