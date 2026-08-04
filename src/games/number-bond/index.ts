/* 数字分解 Number Bond —— 给定一个数，问"几和几合成它"，从选项里选对的分解。
   独特点：数的组成是加减法的前置认知。视觉：中间大圆=目标数，两条线分出两个小圆。
   难度=目标数大小 + 选项数 + 干扰项相似度（easy 明显错，hard 近似分解）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

export class NumberBondGame extends BaseGame {
  constructor() {
    super("number-bond");
  }

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
    /* DOM 清空 */
  }

  private targetRange(): [number, number] {
    if (this.difficulty === "easy") return [3, 5];
    if (this.difficulty === "medium") return [6, 10];
    return [11, 20];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    const [minN, maxN] = this.targetRange();
    const target = randInt(minN, maxN);
    // 正确分解：a + b = target，a,b 均 >=1
    const a = randInt(1, target - 1);
    const b = target - a;

    // 生成干扰项（错误的分解或近似值）
    const optionCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const distractors = this.makeDistractors(target, a, b, optionCount - 1);
    const options = shuffle([
      { a, b, ok: true },
      ...distractors.map((d) => ({ a: d[0], b: d[1], ok: false })),
    ]);

    const wrap = document.createElement("div");
    wrap.className = "nbd-wrap";

    const task = document.createElement("div");
    task.className = "nbd-task";
    task.innerHTML = `<span class="nbd-num">${target}</span> 可以分成几和几？`;
    wrap.appendChild(task);

    // 数字分解图：中间大圆 + 两个分叉小圆
    const bond = document.createElement("div");
    bond.className = "nbd-bond";
    bond.innerHTML = `
      <div class="nbd-top"><div class="nbd-circle nbd-circle--big">${target}</div></div>
      <div class="nbd-lines"><svg viewBox="0 0 200 60" preserveAspectRatio="none"><line x1="100" y1="0" x2="35" y2="60" stroke="#c9b8e8" stroke-width="3" stroke-linecap="round"/><line x1="100" y1="0" x2="165" y2="60" stroke="#c9b8e8" stroke-width="3" stroke-linecap="round"/></svg></div>
      <div class="nbd-bottom">
        <div class="nbd-circle nbd-circle--small">?</div>
        <div class="nbd-circle nbd-circle--small">?</div>
      </div>`;
    wrap.appendChild(bond);

    const opts = document.createElement("div");
    opts.className = "nbd-opts";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nbd-opt";
      btn.innerHTML = `<span class="nbd-a">${opt.a}</span><span class="nbd-plus">+</span><span class="nbd-b">${opt.b}</span>`;
      btn.addEventListener("click", () => this.choose(opt.ok, opt.a, opt.b, btn, a, b, bond));
      opts.appendChild(btn);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private makeDistractors(
    target: number,
    ca: number,
    cb: number,
    n: number,
  ): [number, number][] {
    const seen = new Set<string>();
    seen.add(`${ca}+${cb}`);
    seen.add(`${cb}+${ca}`);
    const out: [number, number][] = [];
    let guard = 0;
    while (out.length < n && guard < 60) {
      guard += 1;
      // hard 模式用近似（和差 1-2），easy/medium 用更明显的错
      const drift =
        this.difficulty === "hard"
          ? randInt(1, 2)
          : this.difficulty === "medium"
            ? randInt(1, 3)
            : randInt(2, 4);
      const sign = Math.random() < 0.5 ? -1 : 1;
      const sum = target + sign * drift;
      if (sum < 2) continue;
      const da = randInt(1, sum - 1);
      const db = sum - da;
      const key = `${da}+${db}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([da, db]);
    }
    // 兜底
    while (out.length < n) {
      const da = randInt(1, target + 3);
      const db = randInt(1, target + 3);
      const key = `${da}+${db}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push([da, db]);
      }
    }
    return out;
  }

  private choose(
    ok: boolean,
    _a: number,
    _b: number,
    btn: HTMLButtonElement,
    ca: number,
    cb: number,
    bond: HTMLElement,
  ): void {
    if (this.locked) return;
    if (ok) {
      this.locked = true;
      btn.classList.add("nbd-opt--correct");
      sfxPop();
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      // 揭示底部分叉
      const smalls = bond.querySelectorAll(".nbd-circle--small");
      if (smalls[0]) smalls[0].textContent = String(ca);
      if (smalls[1]) smalls[1].textContent = String(cb);
      smalls.forEach((el) => el.classList.add("nbd-circle--reveal"));
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("nbd-opt--wrong");
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
      this.trackTimeout(() => {
        btn.classList.remove("nbd-opt--wrong");
        btn.disabled = true;
      }, 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想几和几合起来正好是它～",
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
    if (document.getElementById("nbd-style")) return;
    const st = document.createElement("style");
    st.id = "nbd-style";
    st.textContent = NBD_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function NBD_CSS(theme: string): string {
  return `
.nbd-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;}
.nbd-task{font-size:1.2rem;font-weight:800;text-align:center;}
.nbd-num{display:inline-block;color:${theme};font-size:1.5em;font-weight:900;}
.nbd-bond{display:flex;flex-direction:column;align-items:center;width:min(280px,80%);}
.nbd-top{display:flex;justify-content:center;}
.nbd-circle{display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:900;color:#fff;}
.nbd-circle--big{width:96px;height:96px;font-size:2.4rem;background:linear-gradient(160deg,${theme},color-mix(in srgb,${theme} 60%,#000));box-shadow:0 6px 0 color-mix(in srgb,${theme} 55%,#000),var(--shadow);}
.nbd-lines{width:100%;height:50px;}
.nbd-lines svg{width:100%;height:100%;}
.nbd-bottom{display:flex;justify-content:space-between;width:100%;padding:0 8px;}
.nbd-circle--small{width:72px;height:72px;font-size:1.8rem;background:linear-gradient(160deg,#fff,#ece6f7);color:${theme};box-shadow:0 5px 0 #c9b8e8,var(--shadow);}
.nbd-circle--reveal{animation:nbd-pop .4s ease;}
.nbd-opts{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;}
.nbd-opt{min-width:88px;min-height:60px;font-size:1.5rem;font-weight:900;border-radius:16px;background:#fff;color:#3a2e4a;box-shadow:0 5px 0 #c9c4d0,var(--shadow);border:2px solid #eee;display:flex;align-items:center;justify-content:center;gap:6px;}
.nbd-opt .nbd-plus{color:${theme};}
.nbd-opt:active{transform:translateY(3px);box-shadow:0 2px 0 #c9c4d0,var(--shadow);}
.nbd-opt--correct{background:linear-gradient(160deg,#6bcf7f,#3da858);color:#fff;border-color:#3da858;animation:nbd-pop .4s ease;}
.nbd-opt--correct .nbd-plus{color:#fff;}
.nbd-opt--wrong{background:#ff6348;color:#fff;border-color:#c4452f;animation:nbd-shake .4s ease;}
@keyframes nbd-pop{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes nbd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media(max-width:380px){.nbd-circle--big{width:80px;height:80px;font-size:2rem;}.nbd-circle--small{width:60px;height:60px;font-size:1.4rem;}.nbd-opt{min-width:72px;min-height:54px;font-size:1.3rem;}}
`;
}

export function create(): NumberBondGame {
  return new NumberBondGame();
}
