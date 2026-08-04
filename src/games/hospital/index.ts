/* 小医院 Hospital —— 几个病人（不同症状：发烧/骨折/牙痛/咳嗽），
   对应科室（内科/骨科/口腔科/呼吸科），孩子拖病人到对应科室。
   独特点：症状-科室配对认知 + 病人卡拖入诊室动画。
   视觉：病人 emoji + 科室诊室。难度=病人数。通关=分诊目标轮数。
   用 bindPointer 实现拖拽。巧思：每轮每科室至少 1 位对应病人（可解）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Dept {
  name: string;
  symptom: string;
  color: string;
  icon: string;
}

const DEPTS: Dept[] = [
  { name: "内科", symptom: "发烧", color: "#ef5350", icon: "🌡️" },
  { name: "骨科", symptom: "骨折", color: "#42a5f5", icon: "🦴" },
  { name: "口腔科", symptom: "牙痛", color: "#66bb6a", icon: "🦷" },
  { name: "呼吸科", symptom: "咳嗽", color: "#ab47bc", icon: "🤧" },
];

const PATIENTS: Record<string, string[]> = {
  发烧: ["🤒", "😷"],
  骨折: ["🤕", "🩼"],
  牙痛: ["😷", "😣"],
  咳嗽: ["🤧", "😷"],
};

interface Patient {
  dept: Dept;
  emoji: string;
  el: HTMLElement;
  placed: boolean;
}

const ENCOURAGE = [
  "分诊正确！",
  "小医生真棒！",
  "病人看上病啦！",
  "再分一位～",
];

export class HospitalGame extends BaseGame {
  constructor() {
    super("hospital");
  }

  private unbinds: (() => void)[] = [];
  private rooms: Record<string, HTMLElement> = {};
  private patients: Patient[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private activeDepts: Dept[] = [];

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

  private deptCount(): number {
    return this.difficulty === "easy" ? 3 : 4;
  }
  private patientCount(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 8
        : 11;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.patients = [];
    this.rooms = {};
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const dn = this.deptCount();
    this.activeDepts = shuffle([...DEPTS]).slice(0, dn);
    const total = this.patientCount();

    // 先给每个科室配 1 位对应病人（保证可解），再随机补足
    const plan: { dept: Dept; emoji: string }[] = this.activeDepts.map((d) => ({
      dept: d,
      emoji: sample(PATIENTS[d.symptom]!),
    }));
    for (let i = this.activeDepts.length; i < total; i++) {
      const d = sample(this.activeDepts);
      plan.push({ dept: d, emoji: sample(PATIENTS[d.symptom]!) });
    }
    const list = shuffle(plan);

    const wrap = document.createElement("div");
    wrap.className = "hp2-wrap";

    const task = document.createElement("div");
    task.className = "hp2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 看病人症状，拖到对应科室 🏥`;
    wrap.appendChild(task);

    // 科室区
    const rooms = document.createElement("div");
    rooms.className = "hp2-rooms";
    this.activeDepts.forEach((d) => {
      const r = document.createElement("div");
      r.className = "hp2-room";
      r.dataset.dept = d.name;
      r.style.setProperty("--hp2-c", d.color);
      r.innerHTML = `<div class="hp2-room__head">${d.icon} ${d.name}</div><div class="hp2-room__body" id="hp2-body-${d.name}"></div>`;
      rooms.appendChild(r);
      this.rooms[d.name] = r;
    });
    wrap.appendChild(rooms);

    // 病人候诊区
    const waiting = document.createElement("div");
    waiting.className = "hp2-wait";
    waiting.id = "hp2-wait";
    list.forEach((p) => {
      const el = document.createElement("div");
      el.className = "hp2-patient";
      el.dataset.dept = p.dept.name;
      el.innerHTML = `<span class="hp2-patient__face">${p.emoji}</span><span class="hp2-patient__tag" style="background:${p.dept.color}">${p.dept.symptom}</span>`;
      waiting.appendChild(el);
      const pt: Patient = { dept: p.dept, emoji: p.emoji, el, placed: false };
      this.patients.push(pt);
      this.enableDrag(pt);
    });
    wrap.appendChild(waiting);

    this.root.appendChild(wrap);
    this.remaining = this.patients.length;
  }

  private enableDrag(pt: Patient): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (pt.placed || this.locked) return;
      dragging = true;
      const r = pt.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = pt.el.parentElement;
      pt.el.classList.add("hp2-patient--drag");
      pt.el.style.position = "fixed";
      pt.el.style.left = `${p.x - offX}px`;
      pt.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(pt.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      pt.el.style.left = `${p.x - offX}px`;
      pt.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      pt.el.classList.remove("hp2-patient--drag");
      let hit: string | null = null;
      for (const name of Object.keys(this.rooms)) {
        const r = this.rooms[name]!;
        const rr = r.getBoundingClientRect();
        if (
          p.x >= rr.left &&
          p.x <= rr.right &&
          p.y >= rr.top &&
          p.y <= rr.bottom
        ) {
          hit = name;
          break;
        }
      }
      if (hit === pt.dept.name) {
        pt.placed = true;
        pt.el.style.position = "";
        pt.el.style.left = "";
        pt.el.style.top = "";
        pt.el.classList.add("hp2-patient--in");
        const body = this.root.querySelector(`#hp2-body-${hit}`);
        if (body) body.appendChild(pt.el);
        this.remaining -= 1;
        const r = this.rooms[hit]!.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.locked = true;
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 800);
        }
      } else {
        pt.el.style.position = "";
        pt.el.style.left = "";
        pt.el.style.top = "";
        origin?.appendChild(pt.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(pt.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🏥",
      variant: "rest",
      body: `看看病人哪里不舒服，找对的科室哦～ ${sample(ENCOURAGE)}`,
      primary: { text: "继续", icon: "🩺", onClick: () => ov.destroy() },
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
    if (document.getElementById("hp2-style")) return;
    const st = document.createElement("style");
    st.id = "hp2-style";
    st.textContent = HP2_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function HP2_CSS(theme: string): string {
  return `
.hp2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.hp2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.hp2-rooms{display:flex;gap:12px;justify-content:center;width:100%;flex-wrap:wrap;}
.hp2-room{flex:1;min-width:96px;max-width:140px;background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,.7));border:3px solid var(--hp2-c,#ef5350);border-radius:18px;padding:8px;box-shadow:var(--shadow);}
.hp2-room__head{font-size:.85rem;font-weight:900;color:#fff;background:var(--hp2-c,#ef5350);border-radius:999px;padding:4px;text-align:center;margin-bottom:6px;text-shadow:0 1px 2px rgba(0,0,0,.2);}
.hp2-room__body{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;align-content:flex-start;min-height:90px;padding:6px;border-radius:10px;background:rgba(0,0,0,.03);}
.hp2-wait{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.65);border-radius:22px;box-shadow:var(--shadow);max-width:480px;min-height:72px;}
.hp2-patient{display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff;border-radius:14px;padding:6px 8px;box-shadow:0 2px 4px rgba(0,0,0,.15);cursor:grab;touch-action:none;user-select:none;transition:transform .12s;}
.hp2-patient:active{transform:scale(1.1);}
.hp2-patient__face{font-size:1.8rem;line-height:1;}
.hp2-patient__tag{color:#fff;font-size:.7rem;font-weight:900;padding:1px 8px;border-radius:999px;text-shadow:0 1px 1px rgba(0,0,0,.25);}
.hp2-patient--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
.hp2-patient--in{animation:hp2-cure .5s ease;cursor:default;}
@keyframes hp2-cure{0%{transform:scale(1.2) rotate(-5deg)}60%{transform:scale(.9) rotate(5deg)}100%{transform:scale(1) rotate(0)}}
@media (max-width:380px){.hp2-patient__face{font-size:1.5rem;}.hp2-room{min-width:82px;}.hp2-task{font-size:.95rem;}}
.hp2-theme{color:${theme};}
`;
}

export function create(): HospitalGame {
  return new HospitalGame();
}
