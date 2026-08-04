/* 认琴键 Piano Keys —— 听一个音，找出对应的那只白键。
   独特点：用 Web Audio 合成 C 大调音阶，孩子听音高后点对应琴键；
   7 个白键 CDEFGAB，难度高时加入黑键选项。 */

import { BaseGame } from "../../core/engine.ts";
import { playNote, sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface KeyDef {
  note: string;
  label: string;
  isBlack?: boolean;
}

// 一组白键 C4-C5（含 B4）。8 个白键稍多，这里取 7 个 CDEFGAB + C5
const WHITE_KEYS: KeyDef[] = [
  { note: "C4", label: "Do" },
  { note: "D4", label: "Re" },
  { note: "E4", label: "Mi" },
  { note: "F4", label: "Fa" },
  { note: "G4", label: "Sol" },
  { note: "A4", label: "La" },
  { note: "B4", label: "Si" },
];
const BLACK_KEYS: KeyDef[] = [
  { note: "C#4", label: "", isBlack: true },
  { note: "D#4", label: "", isBlack: true },
  { note: "F#4", label: "", isBlack: true },
  { note: "G#4", label: "", isBlack: true },
  { note: "A#4", label: "", isBlack: true },
];

export class PianoKeysGame extends BaseGame {
  constructor() {
    super("piano-keys");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private currentTarget = "";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  /** 简单模式只用前 5 个白键（CDEFG），中等 7 个，困难 7 白 + 黑键选项。 */
  private keyPool(): KeyDef[] {
    if (this.difficulty === "easy") return WHITE_KEYS.slice(0, 5);
    if (this.difficulty === "medium") return WHITE_KEYS.slice();
    return [...WHITE_KEYS, ...BLACK_KEYS];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const pool = this.keyPool();
    const target = sample(pool);
    this.currentTarget = target.note;

    const wrap = document.createElement("div");
    wrap.className = "pk-wrap";

    const task = document.createElement("div");
    task.className = "pk-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 听一听，点出刚才那个音`;
    wrap.appendChild(task);

    const listen = document.createElement("div");
    listen.className = "pk-listen";
    listen.appendChild(
      createButton({
        text: "🔊 再听一次",
        icon: "🎵",
        variant: "primary",
        onClick: () => playNote(target.note, 0.5),
      }),
    );
    wrap.appendChild(listen);

    // 钢琴
    const piano = document.createElement("div");
    piano.className = "pk-piano";

    // 白键
    const whiteRow = document.createElement("div");
    whiteRow.className = "pk-whites";
    pool
      .filter((k) => !k.isBlack)
      .forEach((k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pk-white";
        b.innerHTML = `<span class="pk-white-label">${k.label}</span>`;
        b.addEventListener("click", () => this.hit(b, k, target));
        whiteRow.appendChild(b);
      });
    piano.appendChild(whiteRow);

    // 黑键（仅困难模式显示，覆盖在白键之间）
    if (this.difficulty === "hard") {
      const blackLayer = document.createElement("div");
      blackLayer.className = "pk-blacks";
      BLACK_KEYS.forEach((k, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pk-black";
        b.style.setProperty("--bidx", String(i));
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hit(b, k, target);
        });
        blackLayer.appendChild(b);
      });
      piano.appendChild(blackLayer);
    }
    wrap.appendChild(piano);

    this.root.appendChild(wrap);

    // 自动播放一次目标音
    this.trackTimeout(() => playNote(target.note, 0.5), 400);
  }

  private hit(btn: HTMLButtonElement, k: KeyDef, target: KeyDef): void {
    if (btn.classList.contains("pk-key--used")) return;
    playNote(k.note, 0.4);
    btn.classList.add("pk-key--down");
    this.trackTimeout(() => btn.classList.remove("pk-key--down"), 200);

    if (k.note === target.note) {
      btn.classList.add("pk-key--correct");
      btn.classList.add("pk-key--used");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    } else {
      btn.classList.add("pk-key--wrong");
      this.trackTimeout(() => btn.classList.remove("pk-key--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "仔细听那个音是高还是低，再找找是哪个键～",
      primary: { text: "继续", icon: "🎹", onClick: () => ov.destroy() },
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
    if (document.getElementById("pk-style")) return;
    const st = document.createElement("style");
    st.id = "pk-style";
    st.textContent = PK_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function PK_CSS(theme: string): string {
  return `
.pk-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.pk-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.pk-listen{display:flex;}
.pk-piano{position:relative;display:inline-block;padding:12px 12px 16px;background:linear-gradient(180deg,#3a2a40,#2a1c30);border-radius:18px;box-shadow:var(--shadow);touch-action:none;}
.pk-whites{display:flex;gap:4px;}
.pk-white{
  position:relative;width:54px;height:200px;border:none;border-radius:0 0 8px 8px;cursor:pointer;
  background:linear-gradient(180deg,#fff 0%,#fff 85%,#e2e2e8 100%);
  box-shadow:inset 0 -6px 8px rgba(0,0,0,.12),0 4px 6px rgba(0,0,0,.2);
  display:flex;align-items:flex-end;justify-content:center;padding-bottom:12px;
  transition:transform .08s ease,background .15s;
}
.pk-white:active{transform:translateY(2px);}
.pk-white-label{font-size:.85rem;font-weight:800;color:${theme};opacity:.7;}
.pk-key--down{transform:translateY(3px) scale(.99);}
.pk-key--correct{background:linear-gradient(180deg,#b7f3bf 0%,#6bcf7f 100%)!important;animation:pk-glow .6s ease;}
.pk-key--wrong{background:linear-gradient(180deg,#ffd2c8 0%,#ff9f8a 100%)!important;animation:pk-shake .4s ease;}
.pk-key--used{pointer-events:none;}
@keyframes pk-glow{0%{filter:brightness(1.6)}100%{filter:brightness(1)}}
@keyframes pk-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.pk-blacks{position:absolute;top:12px;left:12px;display:flex;pointer-events:none;}
.pk-black{
  position:absolute;width:34px;height:124px;border:none;border-radius:0 0 6px 6px;cursor:pointer;pointer-events:auto;
  background:linear-gradient(180deg,#555 0%,#1a1a1a 90%);
  box-shadow:inset 0 -4px 6px rgba(0,0,0,.5),0 4px 4px rgba(0,0,0,.4);
  /* 5 个黑键分别覆盖在白键缝隙位置 */
  left:calc(38px + var(--bidx) * 58px - 17px);
}
.pk-black:nth-child(2){left:calc(38px + 58px - 17px);} /* D# */
.pk-black:nth-child(3){left:calc(38px + 2*58px - 17px + 8px);} /* F# 跳过 E-F */
.pk-black:nth-child(4){left:calc(38px + 3*58px - 17px + 8px);} /* G# */
.pk-black:nth-child(5){left:calc(38px + 4*58px - 17px + 8px);} /* A# */
.pk-black:active{transform:translateY(2px);}
@media (max-width:380px){.pk-white{width:42px;height:160px;}.pk-black{width:28px;height:100px;left:calc(30px + var(--bidx) * 46px - 14px);}.pk-black:nth-child(2){left:calc(30px + 46px - 14px);}.pk-black:nth-child(3){left:calc(30px + 2*46px - 14px + 6px);}.pk-black:nth-child(4){left:calc(30px + 3*46px - 14px + 6px);}.pk-black:nth-child(5){left:calc(30px + 4*46px - 14px + 6px);}}
`;
}

export function create(): PianoKeysGame {
  return new PianoKeysGame();
}
