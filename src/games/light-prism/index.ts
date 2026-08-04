/* 光的折射 Light Prism —— 白光穿过棱镜分成七色彩虹。
   先点棱镜让光通过，再按正确顺序点出彩虹色（红橙黄绿蓝靛紫）。
   难度=颜色数：easy 3 色（红黄蓝）、medium 5 色、hard 7 色全彩虹。
   巧思：用 CSS linear-gradient 画白光束与七色分光带；点错颜色它「暗掉」。
         培养光谱顺序认知（ROYGBIV 的中文版：红橙黄绿蓝靛紫）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Band {
  name: string;
  color: string;
  emoji: string;
}
// 彩虹七色（按光谱顺序，红在外/上）
const RAINBOW: Band[] = [
  { name: "红", color: "#ff5b5b", emoji: "🔴" },
  { name: "橙", color: "#ff9f43", emoji: "🟠" },
  { name: "黄", color: "#ffd93d", emoji: "🟡" },
  { name: "绿", color: "#6bcf7f", emoji: "🟢" },
  { name: "蓝", color: "#4d96ff", emoji: "🔵" },
  { name: "靛", color: "#5b6bd6", emoji: "🔵" },
  { name: "紫", color: "#a55eea", emoji: "🟣" },
];

export class LightPrismGame extends BaseGame {
  constructor() {
    super("light-prism");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private lit = false; // 棱镜是否已点亮

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 本关要排的色带（按光谱顺序的前 N 色之一段，再随机截取以增加变化）。 */
  private pickBands(): Band[] {
    const n = this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 5 : 7;
    // easy 取前 3 主色，medium 取前 5，hard 全 7；为增加多样性随机起点
    if (n === 7) return RAINBOW;
    const start = this.difficulty === "easy" ? 0 : 0;
    return RAINBOW.slice(start, start + n);
  }

  private startRound(): void {
    this.answered = false;
    this.lit = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const bands = this.pickBands();
    // 正确顺序即 bands（光谱顺序）；打乱展示给点选
    const ordered = bands;
    const shuffled = shuffle(bands);
    // 下一个要点的索引
    let nextIdx = 0;

    const wrap = document.createElement("div");
    wrap.className = "lpr-wrap";

    const task = document.createElement("div");
    task.className = "lpr-task";
    task.innerHTML = `点 <b>🔮棱镜</b> 让光分开，再按 <b>红→紫</b> 顺序点亮彩虹！<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    // 光束舞台：左白光 → 棱镜 → 右七色分光
    const stage = document.createElement("div");
    stage.className = "lpr-stage";
    stage.innerHTML = `
      <div class="lpr-beam lpr-beam--white"></div>
      <button type="button" class="lpr-prism" aria-label="棱镜">🔮</button>
      <div class="lpr-spectrum"></div>`;
    wrap.appendChild(stage);

    const prism = stage.querySelector<HTMLButtonElement>(".lpr-prism")!;
    const spectrum = stage.querySelector<HTMLDivElement>(".lpr-spectrum")!;
    // 分光带（始终画好，但未点亮前是灰的）
    const total = ordered.length;
    ordered.forEach((b, i) => {
      const seg = document.createElement("div");
      seg.className = "lpr-seg";
      // 用渐变模拟扇形展开
      seg.style.background = `linear-gradient(90deg, ${b.color}, ${b.color}dd)`;
      seg.style.width = `${100 / total}%`;
      seg.style.setProperty("--seg-color", b.color);
      seg.dataset.idx = String(i);
      spectrum.appendChild(seg);
    });

    // 点选色块（打乱顺序）
    const palette = document.createElement("div");
    palette.className = "lpr-palette";
    shuffled.forEach((b) => {
      const idx = ordered.indexOf(b);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lpr-color";
      btn.style.background = b.color;
      btn.dataset.idx = String(idx);
      btn.innerHTML = `<span class="lpr-color__emoji">${b.emoji}</span><span class="lpr-color__name">${b.name}</span>`;
      btn.addEventListener("click", () =>
        this.chooseColor(idx, nextIdx, btn, ordered, () => {
          nextIdx++;
          if (nextIdx >= ordered.length) this.win(stage);
        }),
      );
      palette.appendChild(btn);
    });
    wrap.appendChild(palette);
    this.root.appendChild(wrap);

    // 点棱镜点亮
    prism.addEventListener("click", () => {
      if (this.lit) return;
      this.lit = true;
      this.resetWrongStreak();
      sfxPop();
      stage.classList.add("lpr-stage--lit");
      prism.classList.add("lpr-prism--lit");
      // 渐次点亮分光带
      [...spectrum.children].forEach((seg, i) => {
        const el = seg as HTMLElement;
        this.trackTimeout(() => el.classList.add("lpr-seg--show"), 120 + i * 90);
      });
    });
  }

  private chooseColor(
    idx: number,
    expected: number,
    btn: HTMLButtonElement,
    _ordered: Band[],
    onRight: () => void,
  ): void {
    void _ordered;
    if (this.answered || !this.lit) return;
    if (idx === expected) {
      sfxPop();
      btn.classList.add("lpr-color--done");
      // 对应分光段高亮闪烁
      const seg = this.root.querySelector<HTMLElement>(
        `.lpr-seg[data-idx="${idx}"]`,
      );
      seg?.classList.add("lpr-seg--hit");
      this.resetWrongStreak();
      onRight();
    } else {
      btn.classList.add("lpr-color--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("lpr-color--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private win(stage: HTMLElement): void {
    if (this.answered) return;
    this.answered = true;
    stage.classList.add("lpr-stage--win");
    const r = stage.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal)
        this.finishClear(starsByAccuracy(this.wrongCount));
      else this.startRound();
    }, 1300);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌈",
      variant: "rest",
      body: "从红色开始，一个一个点～",
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
    if (document.getElementById("lpr-style")) return;
    const st = document.createElement("style");
    st.id = "lpr-style";
    st.textContent = LPR_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function LPR_CSS(theme: string): string {
  return `
.lpr-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.lpr-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);}
.lpr-task b{color:${theme};}
.lpr-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.lpr-stage{position:relative;width:100%;height:150px;display:flex;align-items:center;background:radial-gradient(circle at 30% 50%,#1a204a,#0b0f2a);border-radius:22px;box-shadow:var(--shadow-lg);overflow:hidden;gap:0;}
.lpr-beam--white{width:38%;height:14px;background:linear-gradient(90deg,transparent,#fff);box-shadow:0 0 12px #fff;opacity:.5;transition:opacity .4s;}
.lpr-stage--lit .lpr-beam--white{opacity:1;animation:lpr-shine 1s ease-in-out infinite;}
@keyframes lpr-shine{0%,100%{filter:brightness(1)}50%{filter:brightness(1.6)}}
.lpr-prism{font-size:2.6rem;background:none;border:none;cursor:pointer;filter:grayscale(.6);transition:all .3s;flex-shrink:0;padding:0 4px;line-height:1;}
.lpr-prism--lit{filter:none;animation:lpr-spin 2s linear infinite;filter:drop-shadow(0 0 12px #fff);}
@keyframes lpr-spin{to{transform:rotate(360deg)}}
.lpr-spectrum{flex:1;height:80px;display:flex;align-items:center;transform-origin:left center;transform:perspective(200px) rotateY(-18deg);}
.lpr-seg{height:0;width:0;opacity:0;border-radius:4px;transition:all .4s cubic-bezier(.34,1.56,.64,1);box-shadow:0 0 8px var(--seg-color);}
.lpr-seg--show{height:64px;opacity:1;margin:0 2px;}
.lpr-seg--hit{animation:lpr-hit .5s ease;}
@keyframes lpr-hit{0%{filter:brightness(1)}50%{filter:brightness(2.2) drop-shadow(0 0 14px #fff)}100%{filter:brightness(1.3)}}
.lpr-stage--win .lpr-seg--show{animation:lpr-win .6s ease;}
@keyframes lpr-win{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.4)}}
.lpr-palette{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.lpr-color{width:74px;height:74px;border-radius:18px;border:3px solid rgba(255,255,255,.6);box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);}
.lpr-color:active{transform:scale(.93);}
.lpr-color__emoji{font-size:1.8rem;line-height:1;}
.lpr-color__name{font-size:.85rem;font-weight:800;}
.lpr-color--done{opacity:.4;pointer-events:none;animation:lpr-pop .4s ease;}
.lpr-color--wrong{animation:lpr-shake .4s ease;}
@keyframes lpr-pop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes lpr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): LightPrismGame {
  return new LightPrismGame();
}
