/* 换装搭配 Dress Up —— 给角色搭配帽子/上衣/裤子/鞋子，自由组合。
   巧思：创造性无对错，角色摆 pose 庆祝；可随机搭配。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const PARTS = {
  hat: ["🎩", "👑", "🧢", "🎓", "🪖", ""],
  top: ["👕", "👚", "🥼", "🦺", "👗", ""],
  bottom: ["👖", "短裤", "🩳", ""],
  shoes: ["👟", "🥾", "👠", "🩴", ""],
} as const;

type PartKey = keyof typeof PARTS;

export class DressUpGame extends BaseGame {
  constructor() {
    super("dress-up");
  }
  private picked: Record<PartKey, string> = {
    hat: "",
    top: "👕",
    bottom: "👖",
    shoes: "👟",
  };

  protected mount(): void {
    this.injectStyle();
    this.render();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "du-wrap";
    const task = document.createElement("div");
    task.className = "du-task";
    task.textContent = "给小伙伴搭配衣服吧～";
    wrap.appendChild(task);

    // 角色展示
    const stage = document.createElement("div");
    stage.className = "du-stage";
    stage.innerHTML = `<div class="du-char">
      <div class="du-part du-hat" id="du-hat">${this.picked.hat}</div>
      <div class="du-head">😊</div>
      <div class="du-part du-top" id="du-top">${this.picked.top}</div>
      <div class="du-part du-bottom" id="du-bottom">${this.picked.bottom}</div>
      <div class="du-part du-shoes" id="du-shoes">${this.picked.shoes}</div>
    </div>`;
    wrap.appendChild(stage);

    // 各部位选择器
    const panels = document.createElement("div");
    panels.className = "du-panels";
    (Object.keys(PARTS) as PartKey[]).forEach((key) => {
      const row = document.createElement("div");
      row.className = "du-row";
      const label = document.createElement("div");
      label.className = "du-label";
      label.textContent = {
        hat: "帽子",
        top: "上衣",
        bottom: "裤子",
        shoes: "鞋子",
      }[key];
      row.appendChild(label);
      const opts = document.createElement("div");
      opts.className = "du-opts";
      PARTS[key].forEach((emoji) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "du-opt";
        b.textContent = emoji === "" ? "🚫" : emoji;
        b.addEventListener("click", () => {
          this.picked[key] = emoji;
          const el = this.root.querySelector(`#du-${key}`);
          if (el) el.textContent = emoji;
          sfxPop();
          row
            .querySelectorAll(".du-opt")
            .forEach((o) => o.classList.remove("du-opt--active"));
          b.classList.add("du-opt--active");
        });
        opts.appendChild(b);
        row.appendChild(opts);
      });
      panels.appendChild(row);
    });
    wrap.appendChild(panels);

    const actions = document.createElement("div");
    actions.className = "du-actions";
    actions.appendChild(
      createButton({
        text: "随机搭配",
        icon: "🎲",
        variant: "secondary",
        onClick: () => {
          (Object.keys(PARTS) as PartKey[]).forEach((k) => {
            this.picked[k] = sample([...PARTS[k]]);
            const el = this.root.querySelector(`#du-${k}`);
            if (el) el.textContent = this.picked[k];
          });
          sfxPop();
        },
      }),
    );
    actions.appendChild(
      createButton({
        text: "搭配好啦！",
        icon: "🎉",
        variant: "primary",
        onClick: () => {
          const char = this.root.querySelector(".du-char") as HTMLElement;
          char?.classList.add("du-char--pose");
          const r = char?.getBoundingClientRect();
          this.onCorrect(
            r ? r.left + r.width / 2 : window.innerWidth / 2,
            r ? r.top : window.innerHeight / 2,
          );
          this.finishClear(3);
        },
      }),
    );
    wrap.appendChild(actions);
    this.root.appendChild(wrap);
  }

  private injectStyle(): void {
    if (document.getElementById("du-style")) return;
    const st = document.createElement("style");
    st.id = "du-style";
    st.textContent = DU_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function DU_CSS(theme: string): string {
  return `
.du-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.du-task{font-size:1.1rem;font-weight:800;}
.du-stage{display:flex;justify-content:center;width:100%;}
.du-char{display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff;padding:16px 24px;border-radius:20px;box-shadow:var(--shadow);}
.du-char--pose{animation:du-pose .6s ease;}
.du-part{font-size:1.8rem;height:30px;display:flex;align-items:center;justify-content:center;}
.du-head{font-size:3rem;}
.du-hat{margin-bottom:-6px;}
.du-panels{display:flex;flex-direction:column;gap:10px;width:100%;max-width:360px;}
.du-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.du-label{font-weight:800;width:40px;}
.du-opts{display:flex;gap:8px;flex-wrap:wrap;}
.du-opt{width:44px;height:44px;font-size:1.4rem;border-radius:12px;background:#fff;box-shadow:var(--shadow);}
.du-opt:active{transform:scale(.9);}
.du-opt--active{outline:3px solid ${theme};outline-offset:1px;}
.du-actions{display:flex;gap:12px;}
@keyframes du-pose{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg) scale(1.05)}75%{transform:rotate(8deg) scale(1.05)}}
`;
}

export function create(): DressUpGame {
  return new DressUpGame();
}
