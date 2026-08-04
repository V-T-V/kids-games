/* 果汁调配 Juice Blend —— 给出目标比例（如 苹果汁 2 份 + 橙汁 1 份），
   烧杯有刻度，孩子按比例点对应果汁瓶往里倒，每点一次加 1 份。
   独特点：比例/数量对应 + 分层视觉（不同果汁在杯里叠成彩色层）。
   视觉：目标配方卡 + 玻璃烧杯（带刻度）+ 分层液面 + 果汁瓶。
   难度=比例复杂度（种类数/份数）。通关=调对目标轮数。前缀 jxb-。
   关键可解性：每按一次 +1 份，所有目标份数均为正整数，step=1 必能到达。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

interface Juice {
  key: string;
  emoji: string;
  name: string;
  color: string;
}

const JUICES: Juice[] = [
  { key: "apple", emoji: "🧃", name: "苹果汁", color: "#f6c453" },
  { key: "orange", emoji: "🍊", name: "橙汁", color: "#ff9f43" },
  { key: "grape", emoji: "🍇", name: "葡萄汁", color: "#a55eea" },
  { key: "strawberry", emoji: "🍓", name: "草莓汁", color: "#ff6b9d" },
  { key: "watermelon", emoji: "🍉", name: "西瓜汁", color: "#ff6348" },
  { key: "kiwi", emoji: "🥝", name: "猕猴桃汁", color: "#8bc34a" },
];

interface PourItem {
  juice: Juice;
  target: number;
  poured: number;
}

export class JuiceBlendGame extends BaseGame {
  constructor() {
    super("juice-blend");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private items: PourItem[] = [];
  /** 倒入顺序（用于分层着色）：juice key 数组 */
  private layerSeq: string[] = [];
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

  /** 难度=果汁种类数 + 每种份数上限 */
  private kinds(): number {
    return this.difficulty === "easy"
      ? 2
      : this.difficulty === "medium"
        ? 2
        : 3;
  }
  private maxParts(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 3;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    this.layerSeq = [];

    const picked = shuffle([...JUICES]).slice(0, this.kinds());
    this.items = picked.map((j) => ({
      juice: j,
      target: randInt(1, this.maxParts()),
      poured: 0,
    }));

    const wrap = document.createElement("div");
    wrap.className = "jxb-wrap";

    const task = document.createElement("div");
    task.className = "jxb-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 照配方把果汁倒进烧杯，每点一瓶加 1 份 🥤`;
    wrap.appendChild(task);

    // 配方卡
    const card = document.createElement("div");
    card.className = "jxb-card";
    card.innerHTML = `<div class="jxb-card__title">📋 配方</div>`;
    const list = document.createElement("div");
    list.className = "jxb-card__list";
    this.items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "jxb-recipe";
      row.innerHTML = `<span class="jxb-emoji">${it.juice.emoji}</span><span class="jxb-name">${it.juice.name}</span><span class="jxb-x">×</span><b class="jxb-cnt" id="jxb-cnt-${it.juice.key}">${it.target}</b><span class="jxb-unit">份</span>`;
      row.style.setProperty("--jxb-c", it.juice.color);
      list.appendChild(row);
    });
    card.appendChild(list);
    wrap.appendChild(card);

    const stage = document.createElement("div");
    stage.className = "jxb-stage";
    // 烧杯
    const beaker = document.createElement("div");
    beaker.className = "jxb-beaker";
    // 刻度
    const ticks = document.createElement("div");
    ticks.className = "jxb-ticks";
    const total = this.items.reduce((s, x) => s + x.target, 0);
    for (let i = 1; i <= total; i++) {
      const t = document.createElement("div");
      t.className = "jxb-tick";
      t.style.bottom = `${(i / total) * 100}%`;
      t.innerHTML = `<span class="jxb-tick__n">${i}</span>`;
      ticks.appendChild(t);
    }
    beaker.appendChild(ticks);
    // 液体层容器
    const fill = document.createElement("div");
    fill.className = "jxb-fill";
    fill.id = "jxb-fill";
    beaker.appendChild(fill);
    // 烧杯嘴
    const spout = document.createElement("div");
    spout.className = "jxb-spout";
    beaker.appendChild(spout);
    stage.appendChild(beaker);
    wrap.appendChild(stage);

    // 进度
    const readout = document.createElement("div");
    readout.className = "jxb-readout";
    readout.innerHTML = `已倒：<span id="jxb-poured">0</span> / ${total} 份`;
    wrap.appendChild(readout);

    // 果汁瓶
    const tray = document.createElement("div");
    tray.className = "jxb-tray";
    this.items.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "jxb-btn";
      b.dataset.key = it.juice.key;
      b.style.setProperty("--jxb-c", it.juice.color);
      b.innerHTML = `<span class="jxb-btn__emoji">${it.juice.emoji}</span><span class="jxb-btn__name">${it.juice.name}</span><span class="jxb-btn__done" id="jxb-done-${it.juice.key}">${it.poured}/${it.target}</span>`;
      b.addEventListener("click", () => this.pour(it, b));
      tray.appendChild(b);
    });
    wrap.appendChild(tray);

    // 倒掉按钮
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "jxb-reset";
    reset.textContent = "🚽 倒掉重来";
    reset.addEventListener("click", () => this.restartRound());
    wrap.appendChild(reset);

    this.root.appendChild(wrap);
  }

  private pour(it: PourItem, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (it.poured >= it.target) {
      // 已经倒够了再多倒 -> 错
      btn.classList.add("jxb-btn--wrong");
      this.trackTimeout(() => btn.classList.remove("jxb-btn--wrong"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    it.poured += 1;
    this.layerSeq.push(it.juice.key);
    sfxPop();
    this.resetWrongStreak();
    this.renderLayers();

    const done = this.root.querySelector(`#jxb-done-${it.juice.key}`);
    if (done) done.textContent = `${it.poured}/${it.target}`;
    if (it.poured === it.target) btn.classList.add("jxb-btn--done");

    const total = this.items.reduce((s, x) => s + x.target, 0);
    const poured = this.layerSeq.length;
    const pouredEl = this.root.querySelector("#jxb-poured");
    if (pouredEl) pouredEl.textContent = String(poured);

    const r = btn.getBoundingClientRect();
    if (poured === total && this.items.every((x) => x.poured === x.target)) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 700);
      }, 400);
    }
  }

  private renderLayers(): void {
    const fill = this.root.querySelector("#jxb-fill");
    if (!fill) return;
    fill.innerHTML = "";
    const total = this.items.reduce((s, x) => s + x.target, 0);
    // 从底向上叠层：layerSeq 顺序 = 从底到顶
    this.layerSeq.forEach((key, idx) => {
      const juice = this.items.find((x) => x.juice.key === key);
      if (!juice) return;
      const layer = document.createElement("div");
      layer.className = "jxb-layer";
      layer.style.background = juice.juice.color;
      layer.style.height = `${100 / total}%`;
      layer.style.bottom = `${(idx / total) * 100}%`;
      layer.style.animationDelay = `${idx * 0.02}s`;
      fill.appendChild(layer);
    });
  }

  private restartRound(): void {
    this.items.forEach((it) => (it.poured = 0));
    this.layerSeq = [];
    this.renderLayers();
    this.items.forEach((it) => {
      const done = this.root.querySelector(`#jxb-done-${it.juice.key}`);
      if (done) done.textContent = `${it.poured}/${it.target}`;
      const btn = this.root.querySelector<HTMLElement>(
        `.jxb-btn[data-key="${it.juice.key}"]`,
      );
      btn?.classList.remove("jxb-btn--done");
    });
    const pouredEl = this.root.querySelector("#jxb-poured");
    if (pouredEl) pouredEl.textContent = "0";
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🥤",
      variant: "rest",
      body: `看清楚配方上每种果汁要几份，倒够了就别再点啦～ ${sample(["调得真香！", "比例记得真准！"])}`,
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
    if (document.getElementById("jxb-style")) return;
    const st = document.createElement("style");
    st.id = "jxb-style";
    st.textContent = JXB_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function JXB_CSS(theme: string): string {
  return `
.jxb-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.jxb-task{font-size:1.02rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.jxb-card{width:100%;max-width:400px;background:linear-gradient(180deg,#fffef7,#fff4d6);border:2px solid ${theme}55;border-radius:18px;padding:10px 14px;box-shadow:var(--shadow);}
.jxb-card__title{font-size:.9rem;font-weight:900;color:${theme};margin-bottom:6px;}
.jxb-card__list{display:flex;flex-direction:column;gap:6px;}
.jxb-recipe{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:12px;background:color-mix(in srgb,var(--jxb-c,#eee) 16%,#fff);font-weight:800;font-size:.95rem;}
.jxb-emoji{font-size:1.3rem;}
.jxb-name{flex:1;}
.jxb-x{color:#999;}
.jxb-cnt{color:${theme};font-size:1.1rem;}
.jxb-unit{color:#999;font-size:.85rem;}
.jxb-stage{display:flex;justify-content:center;}
.jxb-beaker{position:relative;width:150px;height:240px;background:linear-gradient(180deg,rgba(255,255,255,.4),rgba(255,255,255,.12));border:4px solid rgba(255,255,255,.75);border-top:none;border-radius:0 0 24px 24px;backdrop-filter:blur(2px);box-shadow:var(--shadow),inset 0 0 16px rgba(255,255,255,.3);overflow:hidden;}
.jxb-spout{position:absolute;top:-2px;left:-8px;width:20px;height:14px;background:rgba(255,255,255,.7);border:3px solid rgba(255,255,255,.75);border-radius:6px 0 0 0;}
.jxb-ticks{position:absolute;inset:0;pointer-events:none;z-index:3;}
.jxb-tick{position:absolute;left:0;width:100%;border-top:1px dashed rgba(0,0,0,.18);}
.jxb-tick__n{position:absolute;right:6px;top:-9px;font-size:.7rem;font-weight:800;color:#777;background:rgba(255,255,255,.7);padding:0 4px;border-radius:4px;}
.jxb-fill{position:absolute;inset:0;}
.jxb-layer{position:absolute;left:0;width:100%;animation:jxb-rise .35s ease;}
@keyframes jxb-rise{0%{transform:scaleY(0);transform-origin:bottom;opacity:.5}100%{transform:scaleY(1);opacity:1}}
.jxb-readout{font-size:.95rem;font-weight:900;color:${theme};background:#fff;padding:4px 16px;border-radius:999px;box-shadow:var(--shadow);}
.jxb-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.jxb-btn{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:80px;padding:8px 6px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--jxb-c,#eee) 30%,#fff));box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:pointer;transition:transform .1s;}
.jxb-btn:active{transform:translateY(3px);}
.jxb-btn__emoji{font-size:1.7rem;}
.jxb-btn__name{font-size:.78rem;font-weight:800;color:#555;}
.jxb-btn__done{font-size:.78rem;font-weight:900;color:${theme};background:#fff;padding:1px 8px;border-radius:999px;}
.jxb-btn--done{background:linear-gradient(180deg,#bff0c1,#6bcf7f);}
.jxb-btn--done .jxb-btn__done{color:#1d6b2c;}
.jxb-btn--wrong{animation:jxb-shake .45s ease;}
@keyframes jxb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.jxb-reset{padding:6px 16px;border:none;border-radius:999px;background:#fff;color:#888;font-weight:800;box-shadow:var(--shadow);cursor:pointer;}
.jxb-reset:active{transform:translateY(2px);}
@media (max-width:380px){.jxb-beaker{width:128px;height:210px;}.jxb-btn{min-width:68px;}}
`;
}

export function create(): JuiceBlendGame {
  return new JuiceBlendGame();
}
