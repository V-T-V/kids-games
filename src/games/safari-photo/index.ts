/* 野生动物拍照 Safari Photo —— 草丛和树后藏着动物（只露出一部分），
   题目给出要拍的目标动物名，孩子观察并点击它来"拍照"。
   独特点：观察力训练 + 隐藏元素（动物部分被草丛遮挡），点击对焦拍照。
   视觉：草原场景 + 半透明草丛遮罩 + 隐约可见的动物 emoji。
   巧思：每轮目标一定在场（保证可解），动物从草丛间歇性探头增加趣味。
   难度=动物数。通关=拍对目标轮数。点击拍照玩法。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Animal {
  name: string;
  emoji: string;
  el: HTMLButtonElement;
  /** 在场景中的位置百分比 */
  left: number;
  top: number;
}

const ANIMALS: { name: string; emoji: string }[] = [
  { name: "狮子", emoji: "🦁" },
  { name: "大象", emoji: "🐘" },
  { name: "长颈鹿", emoji: "🦒" },
  { name: "斑马", emoji: "🦓" },
  { name: "老虎", emoji: "🐯" },
  { name: "犀牛", emoji: "🦏" },
  { name: "猴子", emoji: "🐵" },
  { name: "袋鼠", emoji: "🦘" },
];

export class SafariPhotoGame extends BaseGame {
  constructor() {
    super("safari-photo");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target: { name: string; emoji: string } | null = null;
  private animals: Animal[] = [];
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

  private count(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.animals = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 选 count 个动物，保证互不重名（可定位目标）
    const pool = shuffle([...ANIMALS]).slice(0, this.count());
    this.target = sample(pool);

    const wrap = document.createElement("div");
    wrap.className = "sf2-wrap";

    const task = document.createElement("div");
    task.className = "sf2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 拍到 <b>${this.target.emoji} ${this.target.name}</b>！`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "sf2-scene";
    scene.id = "sf2-scene";

    // 动物散布（网格化避免重叠，保证可点）
    const n = pool.length;
    const cols = n <= 4 ? 2 : 3;
    pool.forEach((a, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sf2-animal";
      el.dataset.name = a.name;
      el.textContent = a.emoji;
      const row = Math.floor(i / cols);
      const col = i % cols;
      const left =
        12 + (col * 76) / Math.max(1, cols - 1) + (Math.random() * 6 - 3);
      const top =
        18 +
        (row * 64) / Math.max(1, Math.ceil(n / cols) - 1) +
        (Math.random() * 6 - 3);
      el.style.left = `${left}%`;
      el.style.top = `${top}%`;
      scene.appendChild(el);
      const an: Animal = { name: a.name, emoji: a.emoji, el, left, top };
      this.animals.push(an);
      el.addEventListener("click", () => this.shoot(an));
    });

    // 草丛遮罩（盖在动物之上，但动物仍可点击——动物 z-index 高于草尖）
    const grass = document.createElement("div");
    grass.className = "sf2-grass";
    scene.appendChild(grass);

    // 相机取景框装饰
    const frame = document.createElement("div");
    frame.className = "sf2-frame";
    frame.textContent = "📷";
    scene.appendChild(frame);

    wrap.appendChild(scene);
    this.root.appendChild(wrap);
  }

  private shoot(an: Animal): void {
    if (this.locked) return;
    if (an.name === this.target?.name) {
      this.locked = true;
      sfxPop();
      const r = an.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 拍照闪光 + 放大动画
      an.el.classList.add("sf2-animal--shot");
      const flash = document.createElement("div");
      flash.className = "sf2-flash";
      this.root.querySelector("#sf2-scene")?.appendChild(flash);
      this.trackTimeout(() => flash.remove(), 400);

      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      this.onWrong();
      an.el.classList.add("sf2-animal--shake");
      this.trackTimeout(() => an.el.classList.remove("sf2-animal--shake"), 400);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("sf2-style")) return;
    const st = document.createElement("style");
    st.id = "sf2-style";
    st.textContent = SF2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SF2_CSS(theme: string): string {
  return `
.sf2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(520px,100%);}
.sf2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sf2-task b{color:${theme};}
.sf2-scene{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#aed581 0%,#c5e1a5 50%,#8d6e63 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.sf2-animal{position:absolute;font-size:2.6rem;line-height:1;background:transparent;border:none;cursor:pointer;padding:0;transform:translate(-50%,-50%);z-index:3;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));transition:transform .12s;animation:sf2-peek 2.4s ease-in-out infinite;opacity:.82;}
.sf2-animal:nth-child(2n){animation-delay:.6s;}
.sf2-animal:nth-child(3n){animation-delay:1.2s;}
.sf2-animal:active{transform:translate(-50%,-50%) scale(1.18);}
@keyframes sf2-peek{0%,100%{transform:translate(-50%,-50%) translateY(6px)}50%{transform:translate(-50%,-50%) translateY(-2px)}}
.sf2-animal--shot{animation:sf2-shot .9s ease forwards;z-index:5;}
@keyframes sf2-shot{0%{transform:translate(-50%,-50%) scale(1);filter:drop-shadow(0 0 0 #fff)}30%{transform:translate(-50%,-50%) scale(1.6);filter:drop-shadow(0 0 16px #fff)}100%{transform:translate(-50%,-50%) scale(1.4);opacity:1}}
.sf2-animal--shake{animation:sf2-shake .4s ease;}
@keyframes sf2-shake{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(-55%,-50%)}75%{transform:translate(-45%,-50%)}}
.sf2-grass{position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(180deg,transparent 0%,rgba(124,179,66,.4) 30%,#7cb342 100%);z-index:4;pointer-events:none;}
.sf2-grass::before{content:"🌿🌾🌿🌱🌾🌿🌱🌿🌾🌿🌱🌿🌱🌾🌿";position:absolute;bottom:-4px;left:0;right:0;font-size:1.6rem;letter-spacing:2px;white-space:nowrap;line-height:1;}
.sf2-frame{position:absolute;top:10px;right:14px;font-size:1.8rem;z-index:6;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));animation:sf2-zoom 3s ease-in-out infinite;}
@keyframes sf2-zoom{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.sf2-flash{position:absolute;inset:0;background:rgba(255,255,255,.85);z-index:7;pointer-events:none;animation:sf2-flash .4s ease forwards;}
@keyframes sf2-flash{0%{opacity:.9}100%{opacity:0}}
@media (max-width:380px){.sf2-animal{font-size:2.1rem;}.sf2-task{font-size:.95rem;}}
.sf2-theme{color:${theme};}
`;
}

export function create(): SafariPhotoGame {
  return new SafariPhotoGame();
}
