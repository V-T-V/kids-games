/* 音乐回声 Music Echo —— 3-4 个彩色琴键，先播放一段由 Web Audio 合成的
   音调序列，孩子照着把序列复奏一遍。
   独特点：纯听音记忆 + 复奏（区别于看图案的节奏模仿）。
   巧思：用 playNote 合成 C 大调单音；播放时对应琴键高亮"自己唱"；
   复奏时按顺序匹配，错则温柔重来；难度=序列长度。 */

import { BaseGame } from "../../core/engine.ts";
import { playNote, sfxCorrect } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface KeyDef {
  note: string;
  label: string;
  color: string;
}

const KEYS: KeyDef[] = [
  { note: "C4", label: "Do", color: "#ff6b9d" },
  { note: "E4", label: "Mi", color: "#ffd93d" },
  { note: "G4", label: "Sol", color: "#6bcf7f" },
  { note: "C5", label: "Do", color: "#4d96ff" },
];

export class MusicEchoGame extends BaseGame {
  constructor() {
    super("music-echo");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private sequence: KeyDef[] = [];
  private echoIdx = 0;
  private listening = false; // 是否正在播放示范（播放时禁止点）
  private replaying = false; // 是否在孩子复奏中
  private keyEls: HTMLButtonElement[] = [];
  private hint!: HTMLDivElement;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空；定时器由基类清理 */
  }

  private seqLen(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private keyCount(): number {
    return this.difficulty === "easy" ? 3 : 4;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.listening = false;
    this.replaying = false;
    this.echoIdx = 0;

    // 生成本轮序列：从可用琴键里随机选 seqLen 个（允许重复，但首尾不同更有趣）
    const pool = KEYS.slice(0, this.keyCount());
    const len = this.seqLen();
    this.sequence = Array.from({ length: len }, () => sample(pool));

    const wrap = document.createElement("div");
    wrap.className = "me-wrap";

    const task = document.createElement("div");
    task.className = "me-task";
    task.innerHTML = `听一听，再照着弹一遍（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    this.hint = document.createElement("div");
    this.hint.className = "me-hint";
    this.hint.id = "me-hint";
    this.hint.textContent = "准备好了吗？";
    wrap.appendChild(this.hint);

    // 进度灯：复奏时显示已对几个
    const lamps = document.createElement("div");
    lamps.className = "me-lamps";
    lamps.id = "me-lamps";
    for (let i = 0; i < len; i++) {
      const d = document.createElement("div");
      d.className = "me-lamp";
      lamps.appendChild(d);
    }
    wrap.appendChild(lamps);

    const board = document.createElement("div");
    board.className = "me-board";
    this.keyEls = [];
    pool.forEach((k) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "me-key";
      btn.style.setProperty("--kc", k.color);
      btn.innerHTML = `<span class="me-key__label">${k.label}</span>`;
      btn.addEventListener("click", () => this.press(k, btn));
      board.appendChild(btn);
      this.keyEls.push(btn);
    });
    wrap.appendChild(board);

    const actions = document.createElement("div");
    actions.className = "me-actions";
    actions.appendChild(
      createButton({
        text: "再听一次",
        icon: "🔊",
        variant: "secondary",
        onClick: () => {
          if (!this.replaying) this.playSequence();
        },
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
    // 自动播放示范
    this.trackTimeout(() => this.playSequence(), 600);
  }

  /** 播放示范序列，逐音高亮对应琴键。 */
  private playSequence(): void {
    if (this.listening) return;
    this.listening = true;
    this.replaying = false;
    this.echoIdx = 0;
    this.setHint("仔细听 🎵");
    // 清灯
    this.root
      .querySelectorAll(".me-lamp")
      .forEach((l) => l.classList.remove("me-lamp--on"));

    const stepMs = 620;
    this.sequence.forEach((k, i) => {
      this.trackTimeout(() => {
        playNote(k.note, 0.45);
        this.flash(k);
      }, i * stepMs);
    });
    // 示范结束 → 邀请孩子复奏
    this.trackTimeout(
      () => {
        this.listening = false;
        this.replaying = true;
        this.echoIdx = 0;
        this.setHint("轮到你啦！照着弹～ 🎹");
      },
      this.sequence.length * stepMs + 250,
    );
  }

  /** 高亮某个琴键。 */
  private flash(k: KeyDef): void {
    // 找到实际渲染的琴键（pool 内）
    const el = this.keyEls.find(
      (b) => b.style.getPropertyValue("--kc") === k.color,
    );
    if (!el) return;
    el.classList.remove("me-key--lit");
    void el.offsetWidth;
    el.classList.add("me-key--lit");
    this.trackTimeout(() => el.classList.remove("me-key--lit"), 320, true);
  }

  private press(k: KeyDef, btn: HTMLButtonElement): void {
    if (this.listening) return; // 示范中禁点
    playNote(k.note, 0.4);
    btn.classList.remove("me-key--lit");
    void btn.offsetWidth;
    btn.classList.add("me-key--lit");
    this.trackTimeout(() => btn.classList.remove("me-key--lit"), 300, true);

    if (!this.replaying) return; // 非复奏阶段随便弹，不判定
    const expected = this.sequence[this.echoIdx];
    if (!expected) return;
    if (k.color === expected.color) {
      // 点亮一盏灯
      const lamps = this.root.querySelectorAll(".me-lamp");
      const lamp = lamps[this.echoIdx];
      if (lamp) lamp.classList.add("me-lamp--on");
      this.echoIdx += 1;
      if (this.echoIdx >= this.sequence.length) {
        // 本关复奏成功
        this.replaying = false;
        sfxCorrect();
        const r = btn.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top);
        this.roundsDone += 1;
        this.setHint("太棒了！弹对啦～ 🌟");
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1200);
      }
    } else {
      // 弹错：温柔重来这一关
      this.replaying = false;
      const paused = this.onWrong();
      this.setHint("差一点点，再听一次试试～");
      this.trackTimeout(() => {
        if (paused) {
          this.showRest();
        } else {
          this.playSequence();
        }
      }, 700);
    }
  }

  private setHint(t: string): void {
    if (this.hint) this.hint.textContent = t;
  }

  private showRest(): void {
    this.replaying = false;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "竖起小耳朵，听听是哪个琴键在唱歌～",
      primary: {
        text: "再试一次",
        icon: "🎵",
        onClick: () => {
          ov.destroy();
          this.trackTimeout(() => this.playSequence(), 300);
        },
      },
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
    if (document.getElementById("me-style")) return;
    const st = document.createElement("style");
    st.id = "me-style";
    st.textContent = ME_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function ME_CSS(theme: string): string {
  return `
.me-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.me-task{font-size:1.1rem;font-weight:800;text-align:center;}
.me-hint{font-size:1.2rem;font-weight:800;color:${theme};min-height:1.4em;text-align:center;}
.me-lamps{display:flex;gap:10px;}
.me-lamp{width:18px;height:18px;border-radius:50%;background:#e3e3e3;box-shadow:inset 0 2px 3px rgba(0,0,0,.15);transition:background .2s,transform .2s;}
.me-lamp--on{background:${theme};transform:scale(1.15);box-shadow:0 0 10px ${theme};}
.me-board{display:flex;gap:12px;align-items:flex-end;padding:18px 16px 16px;background:rgba(255,255,255,.5);border-radius:24px;box-shadow:var(--shadow);}
.me-key{
  width:78px;height:170px;border:none;border-radius:14px 14px 8px 8px;cursor:pointer;
  background:linear-gradient(180deg,color-mix(in srgb,var(--kc) 88%,#fff),var(--kc));
  box-shadow:inset 0 -8px 0 rgba(0,0,0,.15),var(--shadow);
  display:flex;align-items:flex-end;justify-content:center;padding-bottom:14px;
  transition:transform .08s ease;position:relative;
}
.me-key:active{transform:translateY(2px);box-shadow:inset 0 -4px 0 rgba(0,0,0,.15),var(--shadow);}
.me-key__label{color:#fff;font-weight:900;font-size:1rem;text-shadow:0 1px 2px rgba(0,0,0,.3);}
.me-key--lit{animation:me-glow .32s ease;}
@keyframes me-glow{0%{filter:brightness(1.7) saturate(1.3);transform:translateY(2px) scale(1.02)}100%{filter:brightness(1);transform:none}}
.me-actions{display:flex;gap:12px;}
@media (max-width:380px){.me-key{width:62px;height:140px;}.me-board{gap:8px;}}
`;
}

export function create(): MusicEchoGame {
  return new MusicEchoGame();
}
