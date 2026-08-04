/* 你好世界 Hello World —— 给一个国家，选出对应语言的"你好"，并可用 TTS 朗读。
   独特点：多语言启蒙 + 语音朗读，听一听各国的问候。
   巧思：点喇叭听发音；难度=选项数；通关=答对目标轮数。前缀 hlw-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Greeting {
  country: string;
  flag: string;
  hello: string; // 你好（原文）
  say: string; // TTS 朗读文本（带语言）
  lang: string; // BCP-47 语言码
  langName: string;
}

const GREETINGS: Greeting[] = [
  {
    country: "中国",
    flag: "🇨🇳",
    hello: "你好",
    say: "你好",
    lang: "zh-CN",
    langName: "中文",
  },
  {
    country: "日本",
    flag: "🇯🇵",
    hello: "こんにちは",
    say: "こんにちは",
    lang: "ja-JP",
    langName: "日语",
  },
  {
    country: "韩国",
    flag: "🇰🇷",
    hello: "안녕하세요",
    say: "안녕하세요",
    lang: "ko-KR",
    langName: "韩语",
  },
  {
    country: "英国",
    flag: "🇬🇧",
    hello: "Hello",
    say: "Hello",
    lang: "en-GB",
    langName: "英语",
  },
  {
    country: "法国",
    flag: "🇫🇷",
    hello: "Bonjour",
    say: "Bonjour",
    lang: "fr-FR",
    langName: "法语",
  },
  {
    country: "德国",
    flag: "🇩🇪",
    hello: "Hallo",
    say: "Hallo",
    lang: "de-DE",
    langName: "德语",
  },
  {
    country: "西班牙",
    flag: "🇪🇸",
    hello: "Hola",
    say: "Hola",
    lang: "es-ES",
    langName: "西语",
  },
  {
    country: "俄罗斯",
    flag: "🇷🇺",
    hello: "Привет",
    say: "Привет",
    lang: "ru-RU",
    langName: "俄语",
  },
];

/** 用语音合成朗读文本。 */
function speak(text: string, lang: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.8;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* 浏览器不支持则静默 */
  }
}

export class HelloWorldGame extends BaseGame {
  constructor() {
    super("hello-world");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Greeting | null = null;
  private usedIdx: number[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.usedIdx = [];
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

  private choiceN(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    let pool = GREETINGS.map((_, i) => i).filter(
      (i) => !this.usedIdx.includes(i),
    );
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = GREETINGS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = GREETINGS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), GREETINGS.length);
    const distractors = shuffle(
      GREETINGS.filter((g) => g.country !== answer.country),
    ).slice(0, n - 1);
    const choices = shuffle([answer, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Greeting, choices: Greeting[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "hlw-wrap";

    const task = document.createElement("div");
    task.className = "hlw-task";
    task.innerHTML = `${answer.flag} <b>${answer.country}</b>的人怎么<b>打招呼</b>？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    // 提示 + 听一听（朗读答案的语言名作引子，但不剧透答案）
    const hint = document.createElement("div");
    hint.className = "hlw-hint";
    hint.textContent = "点下面的句子，听一听哪句是它的「你好」～";
    wrap.appendChild(hint);

    const opts = document.createElement("div");
    opts.className = "hlw-opts";
    for (const g of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hlw-opt";
      b.innerHTML = `<span class="hlw-opt__hello">${g.hello}</span><span class="hlw-opt__speak" aria-label="听一听">🔊</span>`;
      // 点喇叭只朗读，不判定
      b.querySelector(".hlw-opt__speak")?.addEventListener("click", (ev) => {
        ev.stopPropagation();
        speak(g.say, g.lang);
      });
      b.addEventListener("click", () => this.choose(g, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(g: Greeting, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok = g.country === this.target.country;
    if (ok) {
      btn.classList.add("hlw-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      // 朗读正确答案
      this.trackTimeout(() => speak(this.target!.say, this.target!.lang), 250);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1400);
    } else {
      btn.classList.add("hlw-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".hlw-opt--wrong")
          .forEach((el) => el.classList.remove("hlw-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("hlw-style")) return;
    const st = document.createElement("style");
    st.id = "hlw-style";
    st.textContent = HLW_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function HLW_CSS(theme: string): string {
  return `
.hlw-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.hlw-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.hlw-task b{color:${theme};}
.hlw-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.hlw-hint{font-size:.9rem;font-weight:700;color:var(--ink-soft);background:#fff;padding:6px 14px;border-radius:999px;box-shadow:var(--shadow);}
.hlw-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.hlw-opt{display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 14px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#ffeef5);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:62px;}
.hlw-opt:active{transform:scale(.97);}
.hlw-opt__hello{font-size:1.6rem;font-weight:900;color:var(--ink);letter-spacing:.5px;}
.hlw-opt__speak{font-size:1.3rem;line-height:1;opacity:.85;cursor:pointer;}
.hlw-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:hlw-yes .4s ease;}
@keyframes hlw-yes{0%{transform:scale(1)}50%{transform:scale(1.06)}100%{transform:scale(1)}}
.hlw-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:hlw-no .3s ease;}
@keyframes hlw-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): HelloWorldGame {
  return new HelloWorldGame();
}
