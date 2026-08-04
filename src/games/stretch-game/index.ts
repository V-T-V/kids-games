/* 伸展运动 Stretch Game —— 显示伸展动作图卡，孩子跟着做，
   然后点"✅ 做到了"确认。完成 N 个动作通关。沙盒类（不计错）。
   独特点：身体活动引导，鼓励孩子动起来；带计时引导每个动作保持几秒。
   注：spec 要求前缀 str2-，但 str2- 已被 sort-trash 占用（CSS 类 + style id
   均冲突），故改用 strg- 避免样式污染（符合"确认CSS前缀不冲突"硬约束）。
   前缀 strg-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const STRETCHES: { emoji: string; name: string; hold: number; tip: string }[] =
  [
    { emoji: "🙆", name: "举手伸展", hold: 5, tip: "双手举高高，数到 5" },
    { emoji: "🤸", name: "侧弯腰", hold: 5, tip: "向左边弯一弯，再向右边" },
    { emoji: "🧘", name: "深呼吸坐", hold: 6, tip: "盘腿坐，慢慢吸一口气" },
    { emoji: "🦵", name: "踢踢腿", hold: 5, tip: "左腿踢一踢，右腿踢一踢" },
    { emoji: "🤳", name: "转脖子", hold: 5, tip: "慢慢转一转小脖子" },
    { emoji: "🙆‍♂️", name: "扩扩胸", hold: 5, tip: "双手张开，挺起小胸膛" },
    { emoji: "🧎", name: "蹲一蹲", hold: 5, tip: "蹲下去，再站起来" },
    { emoji: "🤲", name: "手腕转转", hold: 5, tip: "小手腕转一转圈圈" },
  ];

export class StretchGameGame extends BaseGame {
  constructor() {
    super("stretch-game");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private poses: typeof STRETCHES = [];
  private answered = false;
  private countdownId = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startSequence();
  }
  protected unmount(): void {
    if (this.countdownId) window.clearInterval(this.countdownId);
    this.countdownId = 0;
  }

  private startSequence(): void {
    this.poses = shuffle(STRETCHES).slice(0, this.roundTotal);
    this.roundsDone = 0;
    this.renderPose();
  }

  private renderPose(): void {
    if (this.countdownId) window.clearInterval(this.countdownId);
    this.countdownId = 0;
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const pose = this.poses[this.roundsDone]!;
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "strg-wrap";

    const task = document.createElement("div");
    task.className = "strg-task";
    task.innerHTML = `跟着做<b>伸展动作</b> <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "strg-card";
    card.innerHTML = `
      <div class="strg-emoji">${pose.emoji}</div>
      <div class="strg-name">${pose.name}</div>
      <div class="strg-tip">${pose.tip}</div>
      <div class="strg-count" id="strg-count">${pose.hold}</div>
    `;
    wrap.appendChild(card);

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "strg-btn";
    doneBtn.textContent = "✅ 我做到了！";
    doneBtn.addEventListener("click", () => this.done(doneBtn));
    wrap.appendChild(doneBtn);
    this.root.appendChild(wrap);

    // 倒计时引导
    let left = pose.hold;
    this.countdownId = window.setInterval(() => {
      left--;
      const c = this.root.querySelector("#strg-count");
      if (c) c.textContent = String(Math.max(0, left));
      if (left <= 0 && this.countdownId) {
        window.clearInterval(this.countdownId);
        this.countdownId = 0;
        // 倒计时结束后高亮按钮鼓励确认
        doneBtn.classList.add("strg-btn--ready");
      }
    }, 1000);
  }

  private done(btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    if (this.countdownId) window.clearInterval(this.countdownId);
    this.countdownId = 0;
    btn.classList.add("strg-btn--done");
    sfxPop();
    const rect = btn.getBoundingClientRect();
    this.onCorrect(rect.left + rect.width / 2, rect.top);
    this.trackTimeout(() => {
      this.roundsDone++;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(3);
      } else {
        this.renderPose();
      }
    }, 900);
  }

  private injectStyle(): void {
    if (document.getElementById("strg-style")) return;
    const st = document.createElement("style");
    st.id = "strg-style";
    st.textContent = STRG_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function STRG_CSS(theme: string): string {
  return `
.strg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.strg-task{font-size:1.1rem;font-weight:800;color:var(--ink);background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.strg-task b{color:${theme};}
.strg-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.strg-card{display:flex;flex-direction:column;align-items:center;gap:10px;padding:30px 36px;border-radius:28px;background:linear-gradient(160deg,#fff,#e0f7fa);box-shadow:var(--shadow);position:relative;overflow:hidden;}
.strg-emoji{font-size:6rem;line-height:1;animation:strg-breathe 2s ease-in-out infinite;}
@keyframes strg-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.strg-name{font-size:1.4rem;font-weight:900;color:${theme};}
.strg-tip{font-size:1rem;font-weight:700;color:var(--ink-soft);text-align:center;max-width:280px;}
.strg-count{position:absolute;top:14px;right:18px;width:40px;height:40px;border-radius:50%;background:${theme};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.1rem;box-shadow:var(--shadow);}
.strg-btn{padding:18px 48px;border:none;border-radius:999px;background:linear-gradient(135deg,#ccc,#ddd);color:#666;font-size:1.3rem;font-weight:900;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s,background .3s,color .3s;}
.strg-btn--ready{background:linear-gradient(135deg,${theme},#48d1cc);color:#fff;animation:strg-pulse 1s ease-in-out infinite;}
@keyframes strg-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.strg-btn:active{transform:scale(.93);}
.strg-btn--done{background:linear-gradient(135deg,#6bcf7f,#4a9d57);color:#fff;}
@media (max-width:380px){.strg-emoji{font-size:4.5rem;}.strg-card{padding:24px 24px;}}
`;
}

export function create(): StretchGameGame {
  return new StretchGameGame();
}
