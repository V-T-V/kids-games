/* 宠物医生 Pet Vet —— 小动物有不同症状（打喷嚏/咳嗽/受伤），
   孩子把对症的药（感冒药/止咳药/创可贴）拖到对应症状的动物身上治好它。
   独特点：对症给药的拖拽配对 + 治好后动物开心挥手。
   视觉：动物 + 药瓶。用 bindPointer 拖拽。难度=动物数。通关=治好目标轮数。
   巧思：每个动物的症状唯一对应一种药，每种药各一份，保证 1:1 有解。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

/** 症状定义 + 对应药物 */
interface Symptom {
  id: string;
  /** 动物显示的表情/动作 */
  emoji: string;
  /** 症状气泡 emoji */
  bubble: string;
  /** 症状中文（给孩子看） */
  name: string;
  /** 对症的药 */
  medEmoji: string;
  medName: string;
  medColor: string;
}

const SYMPTOMS: Symptom[] = [
  {
    id: "sneeze",
    emoji: "🤧",
    bubble: "🤧",
    name: "打喷嚏",
    medEmoji: "💊",
    medName: "感冒药",
    medColor: "#ff9f43",
  },
  {
    id: "cough",
    emoji: "😷",
    bubble: "😷",
    name: "咳嗽",
    medEmoji: "🧪",
    medName: "止咳糖浆",
    medColor: "#4d96ff",
  },
  {
    id: "hurt",
    emoji: "🤕",
    bubble: "🩹",
    name: "受伤",
    medEmoji: "🩹",
    medName: "创可贴",
    medColor: "#ff6b9d",
  },
  {
    id: "fever",
    emoji: "🥵",
    bubble: "🌡️",
    name: "发烧",
    medEmoji: "🌡️",
    medName: "退烧贴",
    medColor: "#a55eea",
  },
];

/** 动物形象池 */
const PETS = ["🐱", "🐶", "🐰", "🐹", "🐼", "🐨", "🦊", "🐷"];

const ENCOURAGE = [
  "医术真棒！",
  "对症下药啦～",
  "小动物谢谢你！",
  "治好它啦！",
];

interface Pet {
  symptom: Symptom;
  petEmoji: string;
  el: HTMLDivElement;
  healed: boolean;
}

export class PetVetGame extends BaseGame {
  constructor() {
    super("pet-vet");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private pets: Pet[] = [];
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

  private petCount(): number {
    if (this.difficulty === "easy") return 2;
    if (this.difficulty === "medium") return 3;
    return 4;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.pets = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 选 N 种不同症状（确保每个症状唯一 → 每种药只需一份，1:1 有解） */
    const chosenSymptoms = shuffle(SYMPTOMS).slice(0, this.petCount());
    this.remaining = chosenSymptoms.length;

    const wrap = document.createElement("div");
    wrap.className = "pv-wrap";

    const task = document.createElement("div");
    task.className = "pv-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 把药拖到 <b>对症</b> 的小动物身上 · <span id="pv-left">还剩 ${this.remaining} 只</span>`;
    wrap.appendChild(task);

    /* 动物候诊区 */
    const ward = document.createElement("div");
    ward.className = "pv-ward";
    const petEmojis = shuffle(PETS).slice(0, chosenSymptoms.length);
    chosenSymptoms.forEach((sym, i) => {
      const card = document.createElement("div");
      card.className = "pv-pet";
      const petEmoji = petEmojis[i] ?? sample(PETS);
      card.innerHTML = `
        <div class="pv-pet-emoji">${petEmoji}</div>
        <div class="pv-symptom-bubble">${sym.bubble}</div>
        <div class="pv-symptom-name">${sym.name}</div>
      `;
      card.setAttribute("aria-label", `患${sym.name}的小动物`);
      ward.appendChild(card);
      this.pets.push({ symptom: sym, petEmoji, el: card, healed: false });
    });
    wrap.appendChild(ward);

    /* 药柜：每种症状一份对应的药（顺序打乱） */
    const tray = document.createElement("div");
    tray.className = "pv-tray";
    shuffle(chosenSymptoms).forEach((sym) => {
      const med = document.createElement("div");
      med.className = "pv-med";
      med.style.setProperty("--pv-color", sym.medColor);
      med.innerHTML = `<span class="pv-med-emoji">${sym.medEmoji}</span><span class="pv-med-name">${sym.medName}</span>`;
      med.setAttribute("aria-label", `${sym.medName}（治${sym.name}）`);
      tray.appendChild(med);
      this.enableDrag(med, sym);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(med: HTMLElement, symptom: Symptom): void {
    const u = bindPointer(med, {
      down: (p) => this.startDrag(med, symptom, p),
    });
    this.unbinds.push(u);
  }

  private startDrag(
    med: HTMLElement,
    symptom: Symptom,
    p0: { x: number; y: number },
  ): void {
    if (med.classList.contains("pv-med--gone")) return;
    const rect = med.getBoundingClientRect();
    const ox = p0.x - rect.left;
    const oy = p0.y - rect.top;
    const placeholder = document.createElement("div");
    placeholder.className = "pv-med-ph";
    med.parentElement?.insertBefore(placeholder, med);
    med.classList.add("pv-med--drag");
    med.style.position = "fixed";
    med.style.left = `${p0.x - ox}px`;
    med.style.top = `${p0.y - oy}px`;
    med.style.width = `${rect.width}px`;
    document.body.appendChild(med);

    const move = (pt: { x: number; y: number }) => {
      med.style.left = `${pt.x - ox}px`;
      med.style.top = `${pt.y - oy}px`;
      /* 高亮可接药的动物 */
      this.pets.forEach((p) => {
        if (p.healed) return;
        const r = p.el.getBoundingClientRect();
        const hit =
          pt.x >= r.left &&
          pt.x <= r.right &&
          pt.y >= r.top &&
          pt.y <= r.bottom;
        p.el.classList.toggle(
          "pv-pet--hover",
          hit && p.symptom.id === symptom.id,
        );
      });
    };
    const up = (pt: { x: number; y: number }) => {
      window.removeEventListener("pointermove", onMove as EventListener);
      window.removeEventListener("pointerup", onUp as EventListener);
      window.removeEventListener("pointercancel", onUp as EventListener);
      med.classList.remove("pv-med--drag");
      this.pets.forEach((p) => p.el.classList.remove("pv-pet--hover"));
      let placed = false;
      for (const p of this.pets) {
        if (p.healed) continue;
        const r = p.el.getBoundingClientRect();
        if (
          pt.x >= r.left &&
          pt.x <= r.right &&
          pt.y >= r.top - 8 &&
          pt.y <= r.bottom + 8
        ) {
          if (p.symptom.id === symptom.id) {
            this.heal(p, med, placeholder);
            placed = true;
          } else {
            /* 拖错动物：摇头反馈 */
            this.wrongDrop(p);
          }
          break;
        }
      }
      if (!placed) {
        med.style.position = "";
        med.style.left = "";
        med.style.top = "";
        med.style.width = "";
        placeholder.replaceWith(med);
      }
    };
    const onMove = (e: PointerEvent) => move({ x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => up({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  private heal(pet: Pet, med: HTMLElement, placeholder: HTMLElement): void {
    pet.healed = true;
    pet.el.classList.add("pv-pet--healed");
    /* 换成开心的动物 + 治愈标记 */
    const emojiEl = pet.el.querySelector(".pv-pet-emoji");
    if (emojiEl) emojiEl.textContent = "😊";
    pet.el.querySelector(".pv-symptom-bubble")?.remove();
    const ok = document.createElement("div");
    ok.className = "pv-healed-mark";
    ok.textContent = "❤️";
    pet.el.appendChild(ok);
    med.classList.add("pv-med--gone");
    placeholder.remove();
    sfxPop();
    this.resetWrongStreak();
    const r = pet.el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);

    this.remaining -= 1;
    const left = this.root.querySelector("#pv-left");
    if (left) left.textContent = `还剩 ${this.remaining} 只`;

    if (this.remaining <= 0) {
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    }
  }

  private wrongDrop(pet: Pet): void {
    pet.el.classList.add("pv-pet--shake");
    this.trackTimeout(() => pet.el.classList.remove("pv-pet--shake"), 450);
    const paused = this.onWrong();
    if (paused) this.showRest();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🩺",
      variant: "rest",
      body: `每种药治一种病：感冒药治打喷嚏，止咳糖浆治咳嗽，创可贴治受伤。${sample(ENCOURAGE)}`,
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
    if (document.getElementById("pv-style")) return;
    const st = document.createElement("style");
    st.id = "pv-style";
    st.textContent = PV_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function PV_CSS(theme: string): string {
  return `
.pv-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(540px,100%);}
.pv-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 18px;border-radius:999px;box-shadow:var(--shadow);}
.pv-ward{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;padding:20px 16px;background:linear-gradient(180deg,#e8f4ff,#d4ebff);border-radius:24px;box-shadow:var(--shadow);max-width:500px;}
.pv-pet{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;width:96px;padding:14px 8px 10px;background:#fff;border-radius:20px;box-shadow:0 4px 0 rgba(0,0,0,.08),0 6px 10px rgba(0,0,0,.1);transition:transform .2s;}
.pv-pet--hover{transform:translateY(-4px) scale(1.04);box-shadow:0 8px 0 rgba(0,0,0,.08),0 10px 18px rgba(0,0,0,.18),0 0 0 3px ${theme};}
.pv-pet--healed{background:linear-gradient(180deg,#eafff0,#d4f7dd);}
.pv-pet--shake{animation:pv-shake .45s ease;}
@keyframes pv-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
.pv-pet-emoji{font-size:3.2rem;line-height:1;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));transition:transform .3s;}
.pv-pet--healed .pv-pet-emoji{animation:pv-wave 1.4s ease-in-out infinite;}
@keyframes pv-wave{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
.pv-symptom-bubble{position:absolute;top:-6px;right:-4px;font-size:1.6rem;background:#fff;border-radius:50%;padding:2px;box-shadow:0 2px 5px rgba(0,0,0,.2);animation:pv-pulse 1.2s ease-in-out infinite;}
@keyframes pv-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.pv-symptom-name{font-size:.82rem;font-weight:700;color:#555;}
.pv-healed-mark{position:absolute;top:-8px;right:-6px;font-size:1.5rem;animation:pv-pop .4s ease;}
@keyframes pv-pop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.pv-tray{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:480px;}
.pv-med{display:flex;flex-direction:column;align-items:center;gap:3px;width:74px;padding:10px 6px;background:#fff;border-radius:16px;border:3px solid var(--pv-color,${theme});cursor:grab;box-shadow:0 4px 0 rgba(0,0,0,.1),0 5px 8px rgba(0,0,0,.12);transition:transform .12s;touch-action:none;user-select:none;}
.pv-med:active{cursor:grabbing;transform:scale(1.05);}
.pv-med--drag{z-index:9999;cursor:grabbing;box-shadow:0 10px 20px rgba(0,0,0,.3);transform:scale(1.08) rotate(-3deg);}
.pv-med--gone{opacity:0;transform:scale(.4);pointer-events:none;}
.pv-med-ph{width:74px;height:0;}
.pv-med-emoji{font-size:2rem;line-height:1;}
.pv-med-name{font-size:.72rem;font-weight:700;color:#555;text-align:center;}
@media (max-width:380px){.pv-pet{width:80px;}.pv-pet-emoji{font-size:2.6rem;}.pv-med{width:62px;}.pv-med-emoji{font-size:1.6rem;}}
`;
}

export function create(): PetVetGame {
  return new PetVetGame();
}
