/* 音乐楼梯 Music Stairs —— 点台阶发音符；按顺序点出旋律解锁成就。
   巧思：每个台阶一个音符（音高随高度递增），小球弹跳动画；
   提供"跟我唱"模式：播放一段旋律，孩子照着点。 */

import { BaseGame } from "../../core/engine.ts";
import { playNote, playMelody, sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { createButton } from "../../ui/Button.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { getCssVar } from "../../lobby/util.ts";

/** 台阶从低到高对应的音符（C 大调八度）。 */
const SCALE = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"] as const;

/** 可弹的儿歌旋律（小星星前半段）。 */
const SONG: string[] = ["C4", "C4", "G4", "G4", "A4", "A4", "G5", "F5"];

interface Stair {
  note: string;
  el: HTMLButtonElement;
}

export class MusicStairsGame extends BaseGame {
  constructor() {
    super("music-stairs");
  }

  private stairs: Stair[] = [];
  private melodyProgress = 0;
  private inFollowMode = false;

  protected mount(): void {
    this.injectStyle();
    this.render();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "ms-wrap";

    const task = document.createElement("div");
    task.className = "ms-task";
    task.textContent = "点台阶听声音，或点「跟我唱」学一首歌～";
    wrap.appendChild(task);

    const stairsBox = document.createElement("div");
    stairsBox.className = "ms-stairs";

    this.stairs = SCALE.map((note, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ms-stair";
      btn.style.setProperty("--idx", String(i));
      btn.textContent = note;
      btn.addEventListener("click", () => this.hit(note, btn));
      stairsBox.appendChild(btn);
      return { note, el: btn };
    });
    wrap.appendChild(stairsBox);

    const ball = document.createElement("div");
    ball.className = "ms-ball";
    ball.id = "ms-ball";
    wrap.appendChild(ball);

    const actions = document.createElement("div");
    actions.className = "ms-actions";
    actions.appendChild(
      createButton({
        text: "跟我唱",
        icon: "🎵",
        variant: "primary",
        onClick: () => this.followAlong(),
      }),
    );
    actions.appendChild(
      createButton({
        text: "弹小星星",
        icon: "⭐",
        variant: "secondary",
        onClick: () => {
          playMelody(SONG, 0.32);
          this.checkAchievement(true);
        },
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
  }

  private hit(note: string, btn: HTMLButtonElement): void {
    playNote(note, 0.35);
    btn.classList.remove("ms-stair--hit");
    void btn.offsetWidth;
    btn.classList.add("ms-stair--hit");
    // 小球弹到该台阶
    this.moveBall(note);
    sfxPop();

    // 跟唱模式：检测是否按旋律顺序点
    if (this.inFollowMode) {
      const expected = SONG[this.melodyProgress];
      if (note === expected) {
        const r = btn.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top, 8);
        this.melodyProgress += 1;
        if (this.melodyProgress >= SONG.length) {
          // 完整弹奏
          this.inFollowMode = false;
          this.melodyProgress = 0;
          this.unlock("musician");
          this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
          this.trackTimeout(() => this.finishClear(3), 1200);
        }
      } else {
        // 弹错，重置进度但不惩罚（音乐游戏重在探索）
        this.melodyProgress = 0;
      }
    }
  }

  private moveBall(note: string): void {
    const ball = this.root.querySelector("#ms-ball") as HTMLElement | null;
    if (!ball) return;
    const idx = SCALE.indexOf(note as (typeof SCALE)[number]);
    if (idx < 0) return;
    ball.style.setProperty("--step", String(idx));
    ball.classList.remove("ms-ball--bounce");
    void ball.offsetWidth;
    ball.classList.add("ms-ball--bounce");
  }

  private followAlong(): void {
    this.inFollowMode = true;
    this.melodyProgress = 0;
    // 先示范一遍
    SONG.forEach((n, i) => {
      this.trackTimeout(() => {
        playNote(n, 0.3);
        const s = this.stairs.find((x) => x.note === n);
        if (s) {
          s.el.classList.remove("ms-stair--hit");
          void s.el.offsetWidth;
          s.el.classList.add("ms-stair--hit");
          this.moveBall(n);
        }
      }, i * 380);
    });
    // 示范结束后提示孩子照着点
    this.trackTimeout(
      () => {
        const ov = new Overlay({
          title: "轮到你啦！",
          emoji: "🎶",
          body: "照着刚才的顺序，点出台阶弹出小星星～",
          primary: { text: "开始", icon: "🎹", onClick: () => ov.destroy() },
        });
        ov.show();
      },
      SONG.length * 380 + 200,
    );
  }

  private checkAchievement(autoPlayed: boolean): void {
    if (autoPlayed) {
      // 自动播放也算体验，但不解锁成就（需手动跟唱）
    }
  }

  private injectStyle(): void {
    if (document.getElementById("ms-style")) return;
    const st = document.createElement("style");
    st.id = "ms-style";
    st.textContent = MS_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function MS_CSS(theme: string): string {
  return `
.ms-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.ms-task{font-size:1.1rem;font-weight:800;text-align:center;}
.ms-stairs{display:flex;align-items:flex-end;gap:6px;height:320px;padding:10px;background:rgba(255,255,255,.5);border-radius:24px;box-shadow:var(--shadow);position:relative;}
.ms-stair{
  height:calc(40px + var(--idx) * 32px);
  width:48px;border-radius:10px 10px 4px 4px;border:none;color:#fff;font-weight:800;font-size:.8rem;
  background:linear-gradient(180deg,color-mix(in srgb,${theme} calc(var(--idx) * 8% + 70%),#fff),${theme});
  box-shadow:var(--shadow);transition:transform .1s ease;
}
.ms-stair:active{transform:scaleY(.92);}
.ms-stair--hit{animation:ms-glow .4s ease;}
@keyframes ms-glow{0%{filter:brightness(1.6)}100%{filter:brightness(1)}}
.ms-ball{
  position:absolute;width:36px;height:36px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#fff,${theme});
  box-shadow:var(--shadow);left:calc(var(--step,0) * 54px + 16px);bottom:calc(var(--step,0) * 32px + 14px);
  transition:left .25s ease,bottom .25s ease;
}
.ms-ball--bounce{animation:ms-bounce .35s ease;}
@keyframes ms-bounce{0%{transform:translateY(0)}50%{transform:translateY(-30px) scale(1.1)}100%{transform:translateY(0)}}
.ms-actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
@media (max-width:380px){.ms-stair{width:38px;}.ms-ball{width:30px;height:30px;left:calc(var(--step,0) * 44px + 12px);}}
`;
}

export function create(): MusicStairsGame {
  return new MusicStairsGame();
}
