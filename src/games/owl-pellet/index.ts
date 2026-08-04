/* 猫头鹰丸子 Owl Pellet —— 猫头鹰吐出的丸子里有不同骨头，孩子按骨头类型
   分类（头骨/腿骨/肋骨）到对应框。独特点：从"丸子"里扒出骨头的发现感 + 分类。
   视觉：棕色丸子 + 骨头 emoji + 分类框。用 bindPointer 拖拽。
   难度=骨头数量。通关=分对目标轮数。前缀 owc-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const BONE_TYPES = [
  { type: "skull", emoji: "💀", name: "头骨", color: "#b08968" },
  { type: "leg", emoji: "🦴", name: "腿骨", color: "#6bcf7f" },
  { type: "rib", emoji: "🥖", name: "肋骨", color: "#4d96ff" },
] as const;

interface Bone {
  type: string;
  emoji: string;
  el: HTMLElement;
  placed: boolean;
}

export class OwlPelletGame extends BaseGame {
  constructor() {
    super("owl-pellet");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private boxes: HTMLDivElement[] = [];
  private bones: Bone[] = [];
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.bones = [];

    // 难度=使用的骨头类型数 + 每类数量
    const typeCount =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    const perType =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 2 : 3;
    const types = shuffle([...BONE_TYPES]).slice(0, typeCount);

    const wrap = document.createElement("div");
    wrap.className = "owc-wrap";
    const task = document.createElement("div");
    task.className = "owc-task";
    task.innerHTML = `猫头鹰 🦉 吐出丸子啦！把骨头放到对的盒子里～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 骨头散落区
    const boneArea = document.createElement("div");
    boneArea.className = "owc-bones";

    const allBones: { type: string; emoji: string }[] = [];
    types.forEach((t) => {
      for (let i = 0; i < perType; i++)
        allBones.push({ type: t.type, emoji: t.emoji });
    });
    this.remaining = allBones.length;

    shuffle(allBones).forEach((b) => {
      const el = document.createElement("div");
      el.className = "owc-bone";
      el.textContent = b.emoji;
      boneArea.appendChild(el);
      const bone: Bone = { type: b.type, emoji: b.emoji, el, placed: false };
      this.bones.push(bone);
      this.enableDrag(bone);
    });

    // 分类盒区
    const boxRow = document.createElement("div");
    boxRow.className = "owc-boxes";
    this.boxes = [];
    types.forEach((t) => {
      const box = document.createElement("div");
      box.className = "owc-box";
      box.style.setProperty("--box-color", t.color);
      box.dataset.type = t.type;
      box.dataset.need = String(perType);
      box.innerHTML = `<div class="owc-box__label">${t.name}</div><div class="owc-box__count">0/${perType}</div>`;
      boxRow.appendChild(box);
      this.boxes.push(box);
    });

    wrap.appendChild(boneArea);
    wrap.appendChild(boxRow);
    this.root.appendChild(wrap);
  }

  private enableDrag(bone: Bone): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (bone.placed) return;
      dragging = true;
      const r = bone.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = bone.el.parentElement;
      bone.el.classList.add("owc-bone--drag");
      bone.el.style.position = "fixed";
      bone.el.style.left = `${p.x - offX}px`;
      bone.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(bone.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      bone.el.style.left = `${p.x - offX}px`;
      bone.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      bone.el.classList.remove("owc-bone--drag");
      const box = this.boxes.find((b) => {
        const r = b.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (box && box.dataset.type === bone.type) {
        bone.placed = true;
        bone.el.remove();
        this.remaining -= 1;
        // 更新计数
        const cnt = box.querySelector(".owc-box__count")!;
        const [cur, need] = cnt.textContent!.split("/");
        const next = Number(cur) + 1;
        cnt.textContent = `${next}/${need}`;
        if (next >= Number(need)) box.classList.add("owc-box--full");
        const r = box.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.trackTimeout(() => {
            this.roundsDone += 1;
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 900);
        }
      } else {
        bone.el.style.position = "";
        bone.el.style.left = "";
        bone.el.style.top = "";
        origin?.appendChild(bone.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(bone.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看盒子上写的是什么骨头～",
      primary: { text: "继续", icon: "🦴", onClick: () => ov.destroy() },
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
    if (document.getElementById("owc-style")) return;
    const st = document.createElement("style");
    st.id = "owc-style";
    st.textContent = OWC_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function OWC_CSS(_theme: string): string {
  return `
.owc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(540px,100%);}
.owc-task{font-size:1.1rem;font-weight:800;text-align:center;}
.owc-bones{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;min-height:90px;padding:14px;background:radial-gradient(circle at 30% 30%,#6b4a2e,#4a3120);border-radius:20px;box-shadow:var(--shadow),inset 0 2px 8px rgba(0,0,0,.3);}
.owc-bone{font-size:2.4rem;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35));transition:transform .1s ease;}
.owc-bone:hover{transform:scale(1.1);}
.owc-bone--drag{cursor:grabbing;transform:scale(1.25);z-index:100;}
.owc-boxes{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.owc-box{width:110px;height:120px;border-radius:14px 14px 10px 10px;background:color-mix(in srgb,var(--box-color) 22%,#fff);border:4px solid var(--box-color);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transition:transform .2s ease,background .2s ease;}
.owc-box__label{font-size:1.1rem;font-weight:800;color:var(--ink);}
.owc-box__count{font-size:.9rem;font-weight:700;color:var(--ink-soft);}
.owc-box--full{animation:owc-pop .5s ease;background:color-mix(in srgb,var(--box-color) 45%,#fff);}
@keyframes owc-pop{0%{transform:scale(1)}50%{transform:scale(1.12) rotate(-4deg)}100%{transform:scale(1)}}
@media (max-width:380px){.owc-box{width:92px;height:104px;}.owc-bone{font-size:2rem;}}
`;
}

export function create(): OwlPelletGame {
  return new OwlPelletGame();
}
