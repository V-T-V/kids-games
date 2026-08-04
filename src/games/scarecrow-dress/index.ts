/* 稻草人穿搭 Scarecrow Dress —— 给稻草人选帽子+上衣+裤子，自由搭配。
   独特点：创造性无对错的沙盒玩法，鼓励表达。
   视觉：稻田背景 + 稻草人（草帽位/上衣位/裤位），下方分部位的衣物选项。
   巧思：点击选项即换装，预览实时更新；点"搭配好啦！"通关庆祝。
   通关 = 点完成。前缀 scwd-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const HATS = ["🎩", "👒", "🧢", "🎓", "👑", "🪖", "🎃"];
const TOPS = ["👕", "👚", "🥼", "🦺", "🧥", "👗"];
const BOTTOMS = ["👖", "🩳", "👗", "🩲"];

type PartKey = "hat" | "top" | "bottom";

const LABEL: Record<PartKey, string> = {
  hat: "帽子",
  top: "上衣",
  bottom: "裤子",
};

const PARTS: Record<PartKey, string[]> = {
  hat: HATS,
  top: TOPS,
  bottom: BOTTOMS,
};

export class ScarecrowDressGame extends BaseGame {
  constructor() {
    super("scarecrow-dress");
  }

  private picked: Record<PartKey, string> = {
    hat: "",
    top: "👕",
    bottom: "👖",
  };

  protected mount(): void {
    this.injectStyle();
    this.render();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "scwd-wrap";

    const task = document.createElement("div");
    task.className = "scwd-task";
    task.textContent = "给稻草人穿上一身衣服吧～想怎么搭都行！";
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "scwd-stage";
    stage.innerHTML = `
      <div class="scwd-field"></div>
      <div class="scwd-pole"></div>
      <div class="scwd-crow">
        <div class="scwd-part scwd-hat" id="scwd-hat">${this.picked.hat}</div>
        <div class="scwd-head">
          <div class="scwd-straw"></div>
          <div class="scwd-face">😊</div>
        </div>
        <div class="scwd-part scwd-top" id="scwd-top">${this.picked.top}</div>
        <div class="scwd-part scwd-bottom" id="scwd-bottom">${this.picked.bottom}</div>
        <div class="scwd-arm">🌾</div>
      </div>`;
    wrap.appendChild(stage);

    const panels = document.createElement("div");
    panels.className = "scwd-panels";
    (Object.keys(PARTS) as PartKey[]).forEach((key) => {
      const row = document.createElement("div");
      row.className = "scwd-row";
      const label = document.createElement("div");
      label.className = "scwd-label";
      label.textContent = LABEL[key];
      row.appendChild(label);
      const opts = document.createElement("div");
      opts.className = "scwd-opts";
      const emptyOpt = document.createElement("button");
      emptyOpt.type = "button";
      emptyOpt.className = "scwd-opt";
      emptyOpt.textContent = "🚫";
      emptyOpt.title = "不戴";
      emptyOpt.addEventListener("click", () => {
        this.pickPart(key, "", emptyOpt, opts);
      });
      opts.appendChild(emptyOpt);
      PARTS[key].forEach((emoji) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "scwd-opt";
        b.textContent = emoji;
        b.addEventListener("click", () => {
          this.pickPart(key, emoji, b, opts);
        });
        opts.appendChild(b);
      });
      row.appendChild(opts);
      panels.appendChild(row);
    });
    wrap.appendChild(panels);

    const actions = document.createElement("div");
    actions.className = "scwd-actions";
    actions.appendChild(
      createButton({
        text: "随机搭配",
        icon: "🎲",
        variant: "secondary",
        onClick: () => this.randomize(),
      }),
    );
    actions.appendChild(
      createButton({
        text: "搭配好啦！",
        icon: "🎉",
        variant: "primary",
        onClick: () => this.done(),
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
    this.syncActive();
  }

  private pickPart(
    key: PartKey,
    emoji: string,
    btn: HTMLButtonElement,
    opts: HTMLElement,
  ): void {
    this.picked[key] = emoji;
    const el = this.root.querySelector(`#scwd-${key}`);
    if (el) el.textContent = emoji;
    sfxPop();
    opts
      .querySelectorAll(".scwd-opt")
      .forEach((o) => o.classList.remove("scwd-opt--active"));
    btn.classList.add("scwd-opt--active");
  }

  private randomize(): void {
    (Object.keys(PARTS) as PartKey[]).forEach((k) => {
      this.picked[k] = sample([...PARTS[k]]);
      const el = this.root.querySelector(`#scwd-${k}`);
      if (el) el.textContent = this.picked[k];
    });
    sfxPop();
    this.syncActive();
  }

  /** 根据 picked 高亮对应选项。 */
  private syncActive(): void {
    (Object.keys(PARTS) as PartKey[]).forEach((k) => {
      const rows = this.root.querySelectorAll(".scwd-row");
      rows.forEach((row, idx) => {
        const keys = Object.keys(PARTS) as PartKey[];
        if (keys[idx] !== k) return;
        row.querySelectorAll(".scwd-opt").forEach((o) => {
          o.classList.remove("scwd-opt--active");
        });
      });
    });
  }

  private done(): void {
    const crow = this.root.querySelector(".scwd-crow") as HTMLElement | null;
    crow?.classList.add("scwd-crow--pose");
    const r = crow?.getBoundingClientRect();
    this.onCorrect(
      r ? r.left + r.width / 2 : window.innerWidth / 2,
      r ? r.top + r.height / 2 : window.innerHeight / 2,
    );
    this.finishClear(3);
  }

  private injectStyle(): void {
    if (document.getElementById("scwd-style")) return;
    const st = document.createElement("style");
    st.id = "scwd-style";
    st.textContent = SCD_CSS(getCssVar("--c-brown"), getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SCD_CSS(theme: string, accent: string): string {
  return `
.scwd-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(480px,100%);}
.scwd-task{font-size:1.15rem;font-weight:800;text-align:center;background:linear-gradient(180deg,#fff,#fff6dc);padding:12px 26px;border-radius:999px;box-shadow:var(--shadow);border:2px solid #ffd84d;}
.scwd-stage{position:relative;width:100%;height:360px;background:linear-gradient(180deg,#7ec8f0 0%,#aee4ff 38%,#cfe8a8 46%,#a6d57a 78%,#88b058 100%);border-radius:26px;box-shadow:var(--shadow),inset 0 0 0 3px rgba(255,255,255,.45);overflow:hidden;display:flex;justify-content:center;align-items:flex-end;padding-bottom:28px;}
.scwd-stage::before{content:"☀️";position:absolute;top:18px;right:26px;font-size:2.8rem;filter:drop-shadow(0 0 12px rgba(255,220,80,.75));animation:scwd-sun 8s linear infinite;z-index:1;}
@keyframes scwd-sun{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.scwd-stage::after{content:"☁️";position:absolute;top:34px;left:24px;font-size:1.9rem;opacity:.9;animation:scwd-drift 16s ease-in-out infinite;z-index:1;}
@keyframes scwd-drift{0%,100%{transform:translateX(-20px)}50%{transform:translateX(40px)}}
.scwd-field{position:absolute;bottom:0;left:0;right:0;height:46%;background:repeating-linear-gradient(90deg,#a6d57a 0 16px,#9ccb66 16px 32px);opacity:.55;}
.scwd-pole{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:8px;height:250px;background:linear-gradient(180deg,#a07a4a,#7a5a2e);border-radius:4px;box-shadow:2px 0 0 rgba(0,0,0,.18);}
.scwd-crow{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;z-index:2;}
.scwd-crow--pose{animation:scwd-pose .7s ease;}
@keyframes scwd-pose{0%,100%{transform:rotate(0);}25%{transform:rotate(-8deg) scale(1.08);}75%{transform:rotate(8deg) scale(1.08);}}
.scwd-part{font-size:3.2rem;height:56px;display:flex;align-items:center;justify-content:center;line-height:1;filter:drop-shadow(0 3px 4px rgba(0,0,0,.22));}
.scwd-head{position:relative;display:flex;align-items:center;justify-content:center;}
.scwd-face{font-size:5rem;line-height:1;filter:drop-shadow(0 3px 6px rgba(0,0,0,.28));}
.scwd-straw{position:absolute;width:120px;height:28px;background:repeating-linear-gradient(45deg,#f2d278 0 5px,#caa845 5px 10px);border-radius:14px;top:32px;z-index:-1;box-shadow:0 3px 5px rgba(0,0,0,.22);}
.scwd-arm{position:absolute;top:90px;left:50%;transform:translateX(-130px);font-size:2.4rem;animation:scwd-wave 2s ease infinite;}
@keyframes scwd-wave{0%,100%{transform:translateX(-130px) rotate(-5deg);}50%{transform:translateX(-130px) rotate(12deg);}}
.scwd-panels{display:flex;flex-direction:column;gap:12px;width:100%;max-width:410px;}
.scwd-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:linear-gradient(180deg,#fff,#fff9ea);padding:10px 14px;border-radius:16px;box-shadow:var(--shadow);border:2px solid #ffe89a;}
.scwd-label{font-weight:800;width:46px;color:${theme};font-size:1.05rem;}
.scwd-opts{display:flex;gap:10px;flex-wrap:wrap;}
.scwd-opt{width:54px;height:54px;font-size:1.8rem;border:2px solid transparent;border-radius:14px;background:linear-gradient(180deg,#fafafa,#ebebeb);cursor:pointer;transition:transform .15s,background .15s,box-shadow .15s;box-shadow:0 2px 4px rgba(0,0,0,.1);}
.scwd-opt:hover{transform:translateY(-3px) scale(1.06);background:linear-gradient(180deg,#fff,#f6f6f6);box-shadow:0 6px 12px rgba(0,0,0,.18);}
.scwd-opt:active{transform:scale(.92);}
.scwd-opt--active{background:${accent}33;border-color:${accent};box-shadow:0 0 0 3px ${accent}44,0 4px 8px rgba(0,0,0,.15);}
.scwd-actions{display:flex;gap:14px;}
@media (max-width:380px){.scwd-stage{height:290px;}.scwd-part{font-size:2.6rem;height:46px;}.scwd-face{font-size:4rem;}.scwd-opt{width:46px;height:46px;font-size:1.5rem;}.scwd-straw{width:96px;}.scwd-arm{top:74px;}}
`;
}

export function create(): ScarecrowDressGame {
  return new ScarecrowDressGame();
}
