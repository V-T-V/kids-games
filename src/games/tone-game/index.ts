/* 声调练习 Tone-Game —— 练习中文四声。
   玩法 A：给一个汉字（如"妈"），从 4 个声调变体（mā/má/mǎ/mà）选出正确读音。
   玩法 B：给一个带调拼音（如 mā），从 4 个汉字选出对应的。
   独特点：聚焦"同音不同调"的最小对立对，训练声调分辨。
   巧思：可点喇叭听发音对照；声调用颜色+符号双重编码。难度=对立对相似度。
   前缀 tng-（tone-game；tg- 已被 tangram 占用）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 一组同音节四声字。tones[0..3] 对应一声..四声，至少要有正确答案。 */
interface ToneGroup {
  /** 拼音音节（不含调） */
  base: string;
  /** 四个声调对应的带调拼音：mā má mǎ mà */
  pinyin: [string, string, string, string];
  /** 四个声调对应的常见字 */
  chars: [string, string, string, string];
}

const GROUPS: ToneGroup[] = [
  { base: "ma", pinyin: ["mā", "má", "mǎ", "mà"], chars: ["妈", "麻", "马", "骂"] },
  { base: "ba", pinyin: ["bā", "bá", "bǎ", "bà"], chars: ["八", "拔", "把", "爸"] },
  { base: "fa", pinyin: ["fā", "fá", "fǎ", "fà"], chars: ["发", "乏", "法", "发"] },
  { base: "da", pinyin: ["dā", "dá", "dǎ", "dà"], chars: ["搭", "达", "打", "大"] },
  { base: "ta", pinyin: ["tā", "tá", "tǎ", "tà"], chars: ["他", "踏", "塔", "踏"] },
  { base: "hu", pinyin: ["hū", "hú", "hǔ", "hù"], chars: ["呼", "湖", "虎", "户"] },
  { base: "gu", pinyin: ["gū", "gú", "gǔ", "gù"], chars: ["姑", "骨", "古", "故"] },
  { base: "ji", pinyin: ["jī", "jí", "jǐ", "jì"], chars: ["机", "及", "几", "记"] },
  { base: "qi", pinyin: ["qī", "qí", "qǐ", "qì"], chars: ["七", "旗", "起", "气"] },
  { base: "shi", pinyin: ["shī", "shí", "shǐ", "shì"], chars: ["狮", "十", "史", "是"] },
  { base: "yi", pinyin: ["yī", "yí", "yǐ", "yì"], chars: ["一", "姨", "椅", "意"] },
  { base: "wu", pinyin: ["wū", "wú", "wǔ", "wù"], chars: ["屋", "无", "五", "物"] },
];

/** 朗读。 */
function speak(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.75;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export class ToneGameGame extends BaseGame {
  constructor() {
    super("tone-game");
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
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  /** 选项数。easy=2（只给两个邻近声调对立），hard=4（全四声）。 */
  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const group = sample(GROUPS);
    // 正确声调索引（0-3）
    const correctTone = Math.floor(Math.random() * 4);

    // 决定玩法方向：约一半给字选拼音，一半给拼音选字
    const modePickToPy = Math.random() < 0.5;

    // 选干扰项声调索引
    const allTones = [0, 1, 2, 3];
    const others = shuffle(allTones.filter((t) => t !== correctTone));
    // hard：干扰优先取相邻声调（更难辨）；easy：取相隔的（明显不同）
    const adjacent = others.filter(
      (t) => Math.abs(t - correctTone) === 1,
    );
    const far = others.filter((t) => Math.abs(t - correctTone) > 1);
    const distractorTones =
      this.difficulty === "easy"
        ? shuffle(far.length >= this.optCount() - 1 ? far : others)
        : this.difficulty === "medium"
          ? others
          : shuffle(adjacent.length >= this.optCount() - 1 ? adjacent : others);
    const chosenTones = shuffle([correctTone, ...distractorTones.slice(0, this.optCount() - 1)]);

    const wrap = document.createElement("div");
    wrap.className = "tng-wrap";

    const task = document.createElement("div");
    task.className = "tng-task";
    task.innerHTML = `选出正确的读音<br><span class="tng-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    // 题目展示区：汉字 或 带调拼音 + 发音按钮
    const prompt = document.createElement("div");
    prompt.className = "tng-prompt";
    if (modePickToPy) {
      // 给字，选拼音
      const targetChar = group.chars[correctTone]!;
      const big = document.createElement("div");
      big.className = "tng-bigchar";
      big.textContent = targetChar;
      prompt.appendChild(big);
      this.trackTimeout(() => speak(targetChar), 200);
    } else {
      // 给带调拼音，选字
      const targetPy = group.pinyin[correctTone]!;
      const big = document.createElement("div");
      big.className = "tng-bigpy";
      big.textContent = targetPy;
      prompt.appendChild(big);
      this.trackTimeout(() => speak(group.chars[correctTone]!), 200);
    }
    // 发音按钮（再听一次）：无论哪种模式都朗读该声调对应的字
    const replay = createButton({
      text: "🔊 听",
      variant: "secondary",
      onClick: () => speak(group.chars[correctTone]!),
    });
    replay.classList.add("tng-replay");
    prompt.appendChild(replay);
    wrap.appendChild(prompt);

    // 选项：拼音 或 字
    const grid = document.createElement("div");
    grid.className = "tng-grid";
    for (const t of chosenTones) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `tng-opt tng-opt--t${t + 1}`;
      if (modePickToPy) {
        b.textContent = group.pinyin[t]!;
      } else {
        b.textContent = group.chars[t]!;
      }
      b.addEventListener("click", () => {
        if (this.locked) return;
        const r = b.getBoundingClientRect();
        if (t === correctTone) {
          this.locked = true;
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          grid.querySelectorAll(".tng-opt").forEach((el) => {
            (el as HTMLButtonElement).disabled = true;
          });
          b.classList.add("tng-opt--right");
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 900);
        } else {
          b.classList.add("tng-opt--wrong");
          const paused = this.onWrong();
          if (paused) this.showRest();
          this.trackTimeout(() => b.classList.remove("tng-opt--wrong"), 500);
        }
      });
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
    sfxPop();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "点🔊再听一遍，注意声音是<b>高的还是低的</b>～",
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
    if (document.getElementById("tng-style")) return;
    const st = document.createElement("style");
    st.id = "tng-style";
    st.textContent = TNG_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function TNG_CSS(theme: string): string {
  return `
.tng-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(460px,100%);}
.tng-task{font-size:1.1rem;font-weight:800;text-align:center;}
.tng-hint{font-size:.8rem;color:var(--ink-soft,#888);font-weight:600;}
.tng-prompt{display:flex;flex-direction:column;align-items:center;gap:10px;}
.tng-bigchar{font-size:5rem;font-weight:900;color:${theme};font-family:'KaiTi','STKaiti',serif;text-shadow:0 6px 12px rgba(0,0,0,.12);animation:tng-pulse 2s ease-in-out infinite;}
.tng-bigpy{font-size:4rem;font-weight:900;color:${theme};font-family:'Times New Roman',serif;text-shadow:0 6px 12px rgba(0,0,0,.12);animation:tng-pulse 2s ease-in-out infinite;}
@keyframes tng-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.tng-replay{font-size:1rem!important;}
.tng-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:min(360px,100%);}
.tng-opt{min-height:68px;font-size:1.8rem;font-weight:900;background:#fff;color:var(--ink,#333);border-radius:18px;box-shadow:var(--shadow);border-top:6px solid #ccc;font-family:'KaiTi','STKaiti',serif;}
.tng-opt--t1{border-top-color:#ff6b6b;} /* 一声 红 */
.tng-opt--t2{border-top-color:#4d96ff;} /* 二声 蓝 */
.tng-opt--t3{border-top-color:#6bcf7f;} /* 三声 绿 */
.tng-opt--t4{border-top-color:#ffa502;} /* 四声 橙 */
.tng-opt:active{transform:scale(.94);}
.tng-opt--right{background:#d4f4dd;outline:4px solid #34c759;animation:tng-pop .4s ease;}
.tng-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;animation:tng-shake .45s ease;}
@keyframes tng-pop{0%{transform:scale(.7)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes tng-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.tng-bigchar,.tng-bigpy{font-size:4rem;}.tng-opt{font-size:1.5rem;}}
`;
}

export function create(): ToneGameGame {
  return new ToneGameGame();
}
