/* 情绪故事 Emotion-Story —— 按情绪变化顺序排列故事卡片。
   独特点：用小故事串联情绪变化（开心→难过→开心），训练情绪识别与因果顺序。
   视觉：故事卡片带表情 emoji，孩子按顺序点出来。难度=卡片数。
   通关=排对目标轮数。前缀 es2- 避免冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface StoryCard {
  emoji: string;
  face: string;
  text: string;
}

interface Story {
  title: string;
  cards: StoryCard[];
}

const STORIES: Story[] = [
  {
    title: "小明和气球",
    cards: [
      { emoji: "🎈", face: "😀", text: "得到一个气球，好开心" },
      { emoji: "💨", face: "😢", text: "气球飞走了，好难过" },
      { emoji: "🎈", face: "😄", text: "妈妈又买了一个，又开心了" },
    ],
  },
  {
    title: "小猫走丢了",
    cards: [
      { emoji: "😺", face: "😀", text: "和小猫一起玩，很开心" },
      { emoji: "❓", face: "😨", text: "小猫不见了，好着急" },
      { emoji: "😿", face: "😢", text: "到处找不到，好难过" },
      { emoji: "😺", face: "😄", text: "终于找到了，又开心了" },
    ],
  },
  {
    title: "下雨天",
    cards: [
      { emoji: "🏖️", face: "😀", text: "要去公园玩，很开心" },
      { emoji: "🌧️", face: "😟", text: "下大雨了，去不了，有点失望" },
      { emoji: "🎲", face: "😄", text: "在家玩棋也很有趣，又开心了" },
    ],
  },
  {
    title: "学骑自行车",
    cards: [
      { emoji: "🚲", face: "😀", text: "新自行车到了，好开心" },
      { emoji: "💥", face: "😨", text: "摔了一跤，有点害怕" },
      { emoji: "😢", face: "😢", text: "膝盖疼，哭了一下" },
      { emoji: "🚲", face: "😄", text: "再试一次学会了，超开心" },
      { emoji: "🏆", face: "🤩", text: "被夸奖了，更开心了" },
    ],
  },
  {
    title: "生日礼物",
    cards: [
      { emoji: "🎁", face: "😀", text: "收到一个礼物，很开心" },
      { emoji: "📦", face: "😯", text: "打开盒子，是空的，很惊讶" },
      { emoji: "🐶", face: "🤩", text: "小狗从后面蹦出来，超惊喜" },
    ],
  },
];

const ENCOURAGE = [
  "故事讲得真好！",
  "想想接下来发生了什么～",
  "顺序排对了！",
  "差一点点！",
];

export class EmotionStoryGame extends BaseGame {
  constructor() {
    super("emotion-story");
  }

  private cardCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private order: number[] = [];
  private nextNeed = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.order = [];
    this.nextNeed = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 选一个长度合适的故事 */
    const want = this.cardCount();
    const candidates = STORIES.filter((s) => s.cards.length === want);
    const story = sample(candidates.length > 0 ? candidates : STORIES);
    const cards = story.cards;
    const total = cards.length;

    const wrap = document.createElement("div");
    wrap.className = "es2-wrap";

    const task = document.createElement("div");
    task.className = "es2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 《${story.title}》 按<b>发生顺序</b>点卡片`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "es2-hint";
    hint.innerHTML = `故事从哪里开始？按顺序点一点 👇`;
    wrap.appendChild(hint);

    /* 已排序列（顶部） */
    const seq = document.createElement("div");
    seq.className = "es2-seq";
    seq.id = "es2-seq";
    for (let i = 0; i < total; i++) {
      const slot = document.createElement("div");
      slot.className = "es2-slot";
      slot.innerHTML = `<span class="es2-slot-num">${i + 1}</span>`;
      seq.appendChild(slot);
    }
    wrap.appendChild(seq);

    /* 打乱的卡片池 */
    const pool = document.createElement("div");
    pool.className = "es2-pool";
    const indices = shuffle(cards.map((_, i) => i));
    indices.forEach((idx) => {
      const c = cards[idx]!;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "es2-card";
      card.dataset.idx = String(idx);
      card.innerHTML = `
        <span class="es2-face">${c.face}</span>
        <span class="es2-emoji">${c.emoji}</span>
        <span class="es2-text">${c.text}</span>
      `;
      card.addEventListener("click", () => this.pick(card, idx, total));
      pool.appendChild(card);
    });
    wrap.appendChild(pool);

    this.root.appendChild(wrap);
  }

  private pick(card: HTMLButtonElement, idx: number, total: number): void {
    if (this.locked || card.classList.contains("es2-card--used")) return;
    if (idx === this.nextNeed) {
      /* 正确：放入序列 */
      card.classList.add("es2-card--used");
      this.order.push(idx);
      sfxPop();
      const seq = this.root.querySelector<HTMLElement>("#es2-seq");
      if (seq) {
        const slot = seq.children[this.order.length - 1] as
          | HTMLElement
          | undefined;
        if (slot) {
          slot.classList.add("es2-slot--filled");
          const c = card.querySelector(".es2-face")?.cloneNode(true);
          if (c) slot.appendChild(c);
        }
      }
      const r = card.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.nextNeed += 1;
      if (this.nextNeed >= total) {
        this.locked = true;
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1000);
      }
    } else {
      card.classList.add("es2-card--shake");
      const paused = this.onWrong();
      this.trackTimeout(() => card.classList.remove("es2-card--shake"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "📖",
      variant: "rest",
      body: `按事情发生的先后顺序排，先发生什么？ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("es2-style")) return;
    const st = document.createElement("style");
    st.id = "es2-style";
    st.textContent = ES2_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function ES2_CSS(theme: string): string {
  return `
.es2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(560px,100%);}
.es2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.es2-hint{font-size:.9rem;color:#666;font-weight:600;}
.es2-seq{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:10px;background:rgba(255,255,255,.5);border-radius:16px;box-shadow:var(--shadow);}
.es2-slot{width:62px;height:74px;border:2.5px dashed ${theme}99;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:rgba(255,255,255,.5);position:relative;}
.es2-slot-num{position:absolute;top:3px;left:5px;font-size:.62rem;font-weight:900;color:${theme};opacity:.7;}
.es2-slot--filled{border-style:solid;background:linear-gradient(180deg,#fff,${theme}22);animation:es2-pop .35s ease;}
.es2-slot--filled .es2-face{font-size:2rem;}
.es2-pool{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:540px;}
.es2-card{width:128px;min-height:96px;border:none;border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.1),0 5px 8px rgba(0,0,0,.1);transition:transform .12s;padding:8px 6px;border-top:4px solid ${theme};}
.es2-card:active{transform:translateY(2px);}
.es2-face{font-size:2.2rem;line-height:1;}
.es2-emoji{font-size:1.3rem;}
.es2-text{font-size:.72rem;font-weight:700;color:#444;text-align:center;line-height:1.2;}
.es2-card--used{opacity:.32;pointer-events:none;filter:grayscale(.6);}
.es2-card--shake{animation:es2-shake .5s ease;border-top-color:#ff6348;}
@keyframes es2-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes es2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:380px){.es2-card{width:108px;min-height:88px;}.es2-face{font-size:1.9rem;}.es2-slot{width:52px;height:64px;}}
`;
}

export function create(): EmotionStoryGame {
  return new EmotionStoryGame();
}
