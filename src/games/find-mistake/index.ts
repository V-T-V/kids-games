/* 找语病 Find-Mistake —— 显示一句话（如"太阳从西边出来"），
   判断它对不对（✅ 对 / ❌ 不对）。
   独特点：考察常识 + 逻辑判断，辨别"违背常理/不合逻辑"的句子。
   巧思：句子分为"对（合常理）"和"不对（违常理）"两类，难度=句子复杂度。
         错句的错误点都是孩子能理解的常识错误（不是语法语病，避免超龄）。
   视觉：句子卡 + 两个大判断按钮（✅/❌），答对亮绿、答错亮红。
   通关=答对目标轮数。前缀 fms-（find-mistake）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Sentence {
  /** 句子 */
  text: string;
  /** 是否合乎常理（true=对，false=不对） */
  ok: boolean;
  /** 难度档：1=简单短句，2=中等，3=较复杂 */
  level: number;
}

const SENTENCES: Sentence[] = [
  // 简单（level 1）
  { text: "太阳从东边出来。", ok: true, level: 1 },
  { text: "太阳从西边出来。", ok: false, level: 1 },
  { text: "鱼在水里游。", ok: true, level: 1 },
  { text: "鱼在天上飞。", ok: false, level: 1 },
  { text: "小鸟会飞。", ok: true, level: 1 },
  { text: "小猫会飞。", ok: false, level: 1 },
  { text: "晚上有月亮。", ok: true, level: 1 },
  { text: "白天有月亮和星星。", ok: false, level: 1 },
  // 中等（level 2）
  { text: "下大雨要打伞。", ok: true, level: 2 },
  { text: "下大雨不用打伞。", ok: false, level: 2 },
  { text: "渴了要喝水。", ok: true, level: 2 },
  { text: "渴了要吃石头。", ok: false, level: 2 },
  { text: "冬天要穿厚衣服。", ok: true, level: 2 },
  { text: "夏天要穿棉袄。", ok: false, level: 2 },
  { text: "红灯停，绿灯走。", ok: true, level: 2 },
  { text: "绿灯停，红灯走。", ok: false, level: 2 },
  // 较复杂（level 3）
  { text: "种子浇水后会发芽长大。", ok: true, level: 3 },
  { text: "种子不浇水也会长大。", ok: false, level: 3 },
  { text: "把手洗干净再吃东西。", ok: true, level: 3 },
  { text: "玩完泥巴马上吃饭。", ok: false, level: 3 },
  { text: "过马路要走斑马线。", ok: true, level: 3 },
  { text: "过马路可以乱跑。", ok: false, level: 3 },
  { text: "看到陌生人给糖果可以拿。", ok: false, level: 3 },
  { text: "妈妈做饭很辛苦，我帮她。", ok: true, level: 3 },
];

export class FindMistakeGame extends BaseGame {
  constructor() {
    super("find-mistake");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  /** 记录最近用过的句子，避免连续重复 */
  private recent: Sentence[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 难度=句子复杂度：easy=level 1，medium=level 1-2，hard=level 2-3。 */
  private pickSentence(): Sentence {
    const maxLevel =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    const minLevel =
      this.difficulty === "easy" ? 1 : this.difficulty === "medium" ? 1 : 2;
    const pool = SENTENCES.filter(
      (s) => s.level >= minLevel && s.level <= maxLevel,
    );
    // 排除最近 3 句，避免重复
    const avail = pool.filter((s) => !this.recent.includes(s));
    const chosen = avail.length > 0 ? sample(avail) : sample(pool);
    this.recent.push(chosen);
    if (this.recent.length > 3) this.recent.shift();
    return chosen;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const sent = this.pickSentence();

    const wrap = document.createElement("div");
    wrap.className = "fms-wrap";

    const task = document.createElement("div");
    task.className = "fms-task";
    task.innerHTML = `这句话<b>对不对</b>？<br><span class="fms-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "fms-card";
    card.innerHTML = `<div class="fms-card__quote">“</div><div class="fms-card__text">${sent.text}</div>`;
    wrap.appendChild(card);

    const opts = document.createElement("div");
    opts.className = "fms-opts";

    const yesBtn = document.createElement("button");
    yesBtn.type = "button";
    yesBtn.className = "fms-judge fms-judge--yes";
    yesBtn.innerHTML = `<span class="fms-judge__icon">✅</span><span class="fms-judge__text">对</span>`;
    yesBtn.addEventListener("click", () =>
      this.judge(true, sent.ok, yesBtn, opts),
    );

    const noBtn = document.createElement("button");
    noBtn.type = "button";
    noBtn.className = "fms-judge fms-judge--no";
    noBtn.innerHTML = `<span class="fms-judge__icon">❌</span><span class="fms-judge__text">不对</span>`;
    noBtn.addEventListener("click", () =>
      this.judge(false, sent.ok, noBtn, opts),
    );

    opts.appendChild(yesBtn);
    opts.appendChild(noBtn);
    wrap.appendChild(opts);

    // 答案提示条（答错时显示正确答案）
    const hint = document.createElement("div");
    hint.className = "fms-answer";
    hint.innerHTML = sent.ok
      ? `<span>✅</span> 这句话<b>是对的</b>`
      : `<span>❌</span> 这句话<b>不对</b>，因为不合常理`;
    hint.style.display = "none";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  private judge(
    ans: boolean,
    ok: boolean,
    btn: HTMLButtonElement,
    opts: HTMLElement,
  ): void {
    if (opts.classList.contains("fms-opts--lock")) return;
    if (ans === ok) {
      btn.classList.add("fms-judge--right");
      opts.classList.add("fms-opts--lock");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1200);
    } else {
      btn.classList.add("fms-judge--wrong");
      const paused = this.onWrong();
      // 显示正确答案提示
      const answer = this.root.querySelector(
        ".fms-answer",
      ) as HTMLElement | null;
      if (answer) answer.style.display = "block";
      this.trackTimeout(() => {
        btn.classList.remove("fms-judge--wrong");
        if (answer) answer.style.display = "none";
      }, 1100);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想这句话在生活中<b>是不是</b>真的这样～",
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
    if (document.getElementById("fms-style")) return;
    const st = document.createElement("style");
    st.id = "fms-style";
    st.textContent = FMS_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function FMS_CSS(theme: string): string {
  return `
.fms-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.fms-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.fms-hint{font-size:.8rem;color:var(--ink-soft,#888);font-weight:600;}
.fms-card{position:relative;width:min(460px,100%);min-height:120px;background:#fff;border-radius:22px;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;padding:28px 36px;border-top:6px solid ${theme};}
.fms-card__quote{position:absolute;top:-6px;left:18px;font-size:3rem;color:${theme};line-height:1;font-family:Georgia,serif;}
.fms-card__text{font-size:1.4rem;font-weight:800;color:var(--ink,#333);text-align:center;line-height:1.6;}
.fms-opts{display:flex;gap:20px;}
.fms-judge{display:flex;flex-direction:column;align-items:center;gap:6px;width:130px;padding:18px 10px;border:none;border-radius:22px;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s,background .2s;font-weight:800;}
.fms-judge:active{transform:scale(.93);}
.fms-judge--yes{background:linear-gradient(135deg,#e8fce8,#c8ecc8);color:#2e7d32;}
.fms-judge--no{background:linear-gradient(135deg,#ffe8e8,#fcc8c8);color:#c0392b;}
.fms-judge__icon{font-size:2.6rem;line-height:1;}
.fms-judge__text{font-size:1.3rem;}
.fms-judge--right{background:linear-gradient(135deg,#a5d6a7,#66bb6a);color:#fff;animation:fms-pop .35s ease;}
.fms-judge--wrong{background:linear-gradient(135deg,#ef9a9a,#e57373);color:#fff;animation:fms-shake .4s ease;}
.fms-opts--lock{pointer-events:none;}
.fms-answer{display:none;font-size:1.05rem;font-weight:700;color:var(--ink,#333);background:#fff8e1;border:2px solid #ffd54f;border-radius:14px;padding:10px 18px;box-shadow:var(--shadow);}
.fms-answer b{color:#e65100;}
@keyframes fms-pop{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes fms-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.fms-card__text{font-size:1.15rem;}.fms-judge{width:108px;padding:14px 6px;}.fms-judge__icon{font-size:2.2rem;}}
`;
}

export function create(): FindMistakeGame {
  return new FindMistakeGame();
}
