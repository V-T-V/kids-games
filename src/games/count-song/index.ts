/* 数数歌 Count Song —— 数数儿歌填空，从选项选出缺的词。
   独特点：经典中文数数儿歌填空，融合数字认知与语言节奏。
   巧思：用 __ 标记空缺，正确答案用 emoji 提示；难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Song {
  // 含 __ 占位的歌词
  line: string;
  blank: string; // 正确答案
  emoji: string;
}

const SONGS: Song[] = [
  { line: "一二三四五，上山打__", blank: "老虎", emoji: "🐯" },
  { line: "一二三，三二一，一二三四五六__", blank: "七", emoji: "7️⃣" },
  { line: "一二三四五，金木水火__", blank: "土", emoji: "🌍" },
  { line: "一只青蛙一张__", blank: "嘴", emoji: "👄" },
  { line: "七个星星，七颗__", blank: "糖", emoji: "🍬" },
  { line: "一二三，数到__，拍拍手，笑哈哈", blank: "三", emoji: "3️⃣" },
];

const DISTRACTORS_POOL = [
  "小猫",
  "小鸟",
  "苹果",
  "雨",
  "花",
  "书",
  "车",
  "球",
  "八",
  "六",
  "九",
  "十",
  "眼",
  "手",
];

export class CountSongGame extends BaseGame {
  constructor() {
    super("count-song");
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

  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const song = sample(SONGS);
    const pool = shuffle(
      DISTRACTORS_POOL.filter((d) => d !== song.blank),
    ).slice(0, this.optCount() - 1);
    const options = shuffle([song.blank, ...pool]);

    const wrap = document.createElement("div");
    wrap.className = "csg-wrap";

    const task = document.createElement("div");
    task.className = "csg-task";
    task.textContent = "儿歌里缺了哪个词？选出来～";
    wrap.appendChild(task);

    const line = document.createElement("div");
    line.className = "csg-line";
    line.innerHTML = song.line.replace(
      "__",
      `<span class="csg-blank">__</span>`,
    );
    wrap.appendChild(line);

    const grid = document.createElement("div");
    grid.className = "csg-grid";
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "csg-opt";
      b.textContent = opt;
      b.addEventListener("click", () => this.choose(opt, song, b, grid, line));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    opt: string,
    song: Song,
    btn: HTMLButtonElement,
    grid: HTMLElement,
    lineEl: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt === song.blank) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".csg-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("csg-opt--right");
      lineEl.innerHTML = song.line.replace(
        "__",
        `<span class="csg-filled">${song.emoji}${song.blank}</span>`,
      );
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("csg-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("csg-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "跟着儿歌的节奏念一念，缺的是哪个词～",
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
    if (document.getElementById("csg-style")) return;
    const st = document.createElement("style");
    st.id = "csg-style";
    st.textContent = CSG_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CSG_CSS(theme: string): string {
  return `
.csg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.csg-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.csg-line{background:#fff;border-radius:20px;padding:22px 24px;font-size:1.5rem;font-weight:800;line-height:1.7;text-align:center;box-shadow:var(--shadow);color:#333;letter-spacing:.05em;}
.csg-blank{display:inline-block;min-width:1.6em;color:#bbb;border-bottom:4px dotted ${theme};margin:0 4px;}
.csg-filled{color:${theme};animation:csg-pop .3s ease;}
@keyframes csg-pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
.csg-grid{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;}
.csg-opt{min-width:96px;min-height:60px;padding:0 20px;border-radius:16px;background:#fff;font-weight:800;font-size:1.2rem;color:${theme};box-shadow:var(--shadow);}
.csg-opt:active{transform:scale(.93);}
.csg-opt--right{background:#d4f4dd;outline:4px solid #34c759;color:#2e8b57;}
.csg-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;}
`;
}

export function create(): CountSongGame {
  return new CountSongGame();
}
