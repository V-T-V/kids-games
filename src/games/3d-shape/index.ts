/* 立体图形 3DShape —— 给立体图形的名字，从选项中选对应的立体图形图。
   巧思：用 CSS 3D transform 画立方体/球/圆柱/圆锥，并持续旋转。
   难度 = 图形种类。通关 = 答对目标题数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

type ShapeKind = "cube" | "sphere" | "cylinder" | "cone";

interface ShapeDef {
  kind: ShapeKind;
  name: string;
  /** 构建展示该立体的 DOM（含 3D 旋转） */
  build: () => HTMLElement;
}

const CUBE_FACES: [string, string][] = [
  ["td-face td-front", "translateZ(40px)"],
  ["td-face td-back", "rotateY(180deg) translateZ(40px)"],
  ["td-face td-right", "rotateY(90deg) translateZ(40px)"],
  ["td-face td-left", "rotateY(-90deg) translateZ(40px)"],
  ["td-face td-top", "rotateX(90deg) translateZ(40px)"],
  ["td-face td-bottom", "rotateX(-90deg) translateZ(40px)"],
];

function buildCube(): HTMLElement {
  const scene = document.createElement("div");
  scene.className = "td-scene";
  const box = document.createElement("div");
  box.className = "td-cube";
  for (const [cls, tf] of CUBE_FACES) {
    const f = document.createElement("div");
    f.className = cls;
    f.style.transform = tf;
    box.appendChild(f);
  }
  scene.appendChild(box);
  return scene;
}

function buildSphere(): HTMLElement {
  const scene = document.createElement("div");
  scene.className = "td-scene";
  const ball = document.createElement("div");
  ball.className = "td-sphere";
  // 用经纬线模拟球面
  for (let i = 0; i < 6; i++) {
    const ring = document.createElement("div");
    ring.className = "td-ring";
    ring.style.transform = `rotateY(${i * 30}deg)`;
    ball.appendChild(ring);
  }
  for (let j = 0; j < 4; j++) {
    const lat = document.createElement("div");
    lat.className = "td-lat";
    lat.style.transform = `rotateX(${j * 45}deg) scale(${1 - Math.abs(j - 1.5) * 0.25})`;
    ball.appendChild(lat);
  }
  scene.appendChild(ball);
  return scene;
}

function buildCylinder(): HTMLElement {
  const scene = document.createElement("div");
  scene.className = "td-scene";
  const body = document.createElement("div");
  body.className = "td-cylinder";
  for (let i = 0; i < 12; i++) {
    const panel = document.createElement("div");
    panel.className = "td-cyl-panel";
    panel.style.transform = `rotateY(${i * 30}deg) translateZ(34px)`;
    body.appendChild(panel);
  }
  const top = document.createElement("div");
  top.className = "td-cyl-top";
  body.appendChild(top);
  const bottom = document.createElement("div");
  bottom.className = "td-cyl-bottom";
  body.appendChild(bottom);
  scene.appendChild(body);
  return scene;
}

function buildCone(): HTMLElement {
  const scene = document.createElement("div");
  scene.className = "td-scene";
  const body = document.createElement("div");
  body.className = "td-cone";
  for (let i = 0; i < 12; i++) {
    const panel = document.createElement("div");
    panel.className = "td-cone-panel";
    panel.style.transform = `rotateY(${i * 30}deg)`;
    body.appendChild(panel);
  }
  scene.appendChild(body);
  return scene;
}

const ALL_SHAPES: ShapeDef[] = [
  { kind: "cube", name: "正方体", build: buildCube },
  { kind: "sphere", name: "球体", build: buildSphere },
  { kind: "cylinder", name: "圆柱", build: buildCylinder },
  { kind: "cone", name: "圆锥", build: buildCone },
];

export class Shape3DGame extends BaseGame {
  constructor() {
    super("3d-shape");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    const pool =
      this.difficulty === "easy"
        ? ALL_SHAPES.filter((s) => s.kind === "cube" || s.kind === "sphere")
        : this.difficulty === "medium"
          ? ALL_SHAPES.filter((s) => s.kind !== "cone")
          : ALL_SHAPES;
    const answer = sample(pool)!;

    // 选项：含正确答案 + 若干干扰
    const optCount =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    const distractors = shuffle(
      ALL_SHAPES.filter((s) => s.kind !== answer.kind),
    ).slice(0, optCount - 1);
    const choices = shuffle([answer, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "td-wrap";

    const task = document.createElement("div");
    task.className = "td-task";
    task.textContent = `哪个是「${answer.name}」？（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const grid = document.createElement("div");
    grid.className = "td-grid";
    choices.forEach((s) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "td-card";
      card.appendChild(s.build());
      card.addEventListener("click", () =>
        this.choose(s.kind, answer.kind, card),
      );
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    kind: ShapeKind,
    answer: ShapeKind,
    btn: HTMLButtonElement,
  ): void {
    if (this.locked) return;
    if (kind === answer) {
      this.locked = true;
      sfxPop();
      btn.classList.add("td-card--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("td-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("td-card--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "转一转看看：方方的是正方体，圆圆会滚的是球～",
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
    if (document.getElementById("td-style")) return;
    const st = document.createElement("style");
    st.id = "td-style";
    st.textContent = TD_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function TD_CSS(theme: string): string {
  return `
.td-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(460px,100%);}
.td-task{font-size:1.2rem;font-weight:800;text-align:center;}
.td-grid{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.td-card{width:150px;height:170px;border-radius:20px;background:linear-gradient(160deg,#fff,#f3edff);box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;border:4px solid transparent;transition:transform .1s ease,border-color .15s ease;perspective:520px;}
.td-card:active{transform:scale(.95);}
.td-card--done{border-color:${theme};animation:td-pop .4s ease;}
.td-card--wrong{animation:td-shake .4s ease;border-color:#ff6348;}
.td-scene{width:120px;height:120px;perspective:600px;display:flex;align-items:center;justify-content:center;transform-style:preserve-3d;}

/* 立方体 */
.td-cube{position:relative;width:80px;height:80px;transform-style:preserve-3d;animation:td-spin 8s linear infinite;}
.td-face{position:absolute;width:80px;height:80px;border:2px solid rgba(0,0,0,.15);background:linear-gradient(135deg,${theme},#c9a7ff);opacity:.88;border-radius:6px;}
.td-front{background:linear-gradient(135deg,#a55eea,#7d3ce0);}
.td-top{background:linear-gradient(135deg,#c9a7ff,#a55eea);}
.td-right{background:linear-gradient(135deg,#8e4fe6,#6a2bc4);}

/* 球体 */
.td-sphere{position:relative;width:80px;height:80px;transform-style:preserve-3d;animation:td-spin 10s linear infinite;}
.td-ring{position:absolute;inset:0;border-radius:50%;border:2px solid ${theme};opacity:.5;}
.td-lat{position:absolute;inset:0;border-radius:50%;border:2px solid #c9a7ff;opacity:.6;}
.td-sphere::after{content:"";position:absolute;inset:6px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#e9d8ff,${theme});box-shadow:inset -8px -10px 18px rgba(0,0,0,.2);}

/* 圆柱 */
.td-cylinder{position:relative;width:80px;height:100px;transform-style:preserve-3d;animation:td-spin 9s linear infinite;}
.td-cyl-panel{position:absolute;left:6px;top:0;width:68px;height:100px;background:linear-gradient(90deg,#8e4fe6,#a55eea,#8e4fe6);clip-path:polygon(10% 0,90% 0,100% 100%,0 100%);opacity:.85;}
.td-cyl-top{position:absolute;top:-8px;left:6px;width:68px;height:16px;background:#c9a7ff;border-radius:50%;}
.td-cyl-bottom{position:absolute;bottom:-8px;left:6px;width:68px;height:16px;background:#6a2bc4;border-radius:50%;}

/* 圆锥 */
.td-cone{position:relative;width:80px;height:100px;transform-style:preserve-3d;animation:td-spin 9s linear infinite;}
.td-cone-panel{position:absolute;left:0;top:0;width:80px;height:100px;background:linear-gradient(${theme},#6a2bc4);clip-path:polygon(50% 0,60% 100%,40% 100%);opacity:.85;}

@keyframes td-spin{from{transform:rotateX(-18deg) rotateY(0)}to{transform:rotateX(-18deg) rotateY(360deg)}}
@keyframes td-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes td-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): Shape3DGame {
  return new Shape3DGame();
}
