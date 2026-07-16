/* 幸运转盘 Wheel —— 彩色扇形转盘，点击旋转后随机停在某个颜色区。
   独特点：CSS conic-gradient 扇形 + 旋转减速动画 + 顶部指针。
   题目：屏幕提示"转到红色"，停在该颜色即得分。
   难度=扇区数（easy 4 / medium 6 / hard 8）。通关=答对目标次数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

const COLOR_POOL = [
  { name: "红", hex: "#ff6348" },
  { name: "黄", hex: "#ffd93d" },
  { name: "蓝", hex: "#4d96ff" },
  { name: "绿", hex: "#6bcf7f" },
  { name: "紫", hex: "#a55eea" },
  { name: "橙", hex: "#ff9f43" },
  { name: "青", hex: "#22d3ee" },
  { name: "粉", hex: "#ff8fb1" },
];

export class WheelGame extends BaseGame {
  constructor() {
    super("wheel");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private spinning = false;
  private currentAngle = 0;
  private sectors: { name: string; hex: string }[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空；无定时器需手动清理（旋转用 CSS transition） */
  }

  private sectorCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.spinning = false;
    const n = this.sectorCount();
    // 取 n 种颜色；难度高时每种只出现一次（区分度更好）
    this.sectors = shuffle(COLOR_POOL).slice(0, n);
    const target = sample(this.sectors);

    const wrap = document.createElement("div");
    wrap.className = "wh-wrap";

    const task = document.createElement("div");
    task.className = "wh-task";
    task.innerHTML = `转盘要转到 <span style="color:${target.hex}">${target.name}色</span> 哦～`;
    wrap.appendChild(task);

    const dial = document.createElement("div");
    dial.className = "wh-dial";
    // 指针（顶部朝下）
    const pointer = document.createElement("div");
    pointer.className = "wh-pointer";
    pointer.innerHTML = "🔻";
    dial.appendChild(pointer);

    const wheel = document.createElement("div");
    wheel.className = "wh-wheel";
    wheel.style.background = this.conicGradient(this.sectors);
    wheel.style.transform = `rotate(${this.currentAngle}deg)`;
    // 扇区分隔线 + 中心
    this.drawSectorLines(wheel, n);
    const hub = document.createElement("div");
    hub.className = "wh-hub";
    wheel.appendChild(hub);
    dial.appendChild(wheel);
    wrap.appendChild(dial);

    const scoreLine = document.createElement("div");
    scoreLine.className = "wh-score";
    scoreLine.innerHTML = `已答对 <b>${this.roundsDone}</b> / ${this.roundTotal}`;
    wrap.appendChild(scoreLine);

    const spinBtn = document.createElement("button");
    spinBtn.type = "button";
    spinBtn.className = "wh-btn";
    spinBtn.textContent = "🎡 转动！";
    wrap.appendChild(spinBtn);

    this.root.appendChild(wrap);

    const onSpin = (): void => {
      if (this.spinning) return;
      this.spinning = true;
      spinBtn.disabled = true;
      sfxPop();
      // 让转盘额外转 4~6 圈，并随机停在某个扇区中心
      const turns = 4 + Math.floor(Math.random() * 3);
      // 随机目标扇区
      const targetSector = Math.floor(Math.random() * n);
      const segAngle = 360 / n;
      // 指针在顶部（12 点方向，即 -90°/270°）。扇区 i 的中心角度（顺时针，从顶部起）= i*seg + seg/2
      // 要让扇区 targetSector 停在指针下，转盘需 rotate 使该扇区中心对齐顶部
      // finalAngle mod 360 应使 (360 - finalAngle) ≡ targetSectorCenter
      const targetCenter = targetSector * segAngle + segAngle / 2;
      // 我们希望 wheel 旋转后，顶部位置对应 targetSector。
      // 顶部对应扇区索引 = (360 - (angle mod 360) + seg/2 ) / seg 的整数部分（粗略）
      // 简化：直接累加旋转，并附加随机偏移使最终停在 targetSector
      const baseFromCurrent = 360 - (this.currentAngle % 360);
      let final = this.currentAngle + turns * 360 + baseFromCurrent;
      // 现在 final % 360 == 0（顶部对齐第 0 扇区中心）；偏移到 targetSector
      final += targetCenter;
      // 加入扇区内的小随机（避免每次正中），但保持在扇区内
      final += (Math.random() - 0.5) * (segAngle * 0.6);
      this.currentAngle = final;
      wheel.style.transition = "transform 3.6s cubic-bezier(0.15,0.7,0.2,1)";
      wheel.style.transform = `rotate(${final}deg)`;

      this.trackTimeout(() => {
        this.judge(target, wheel, spinBtn);
      }, 3700);
    };
    spinBtn.addEventListener("click", onSpin);
  }

  /** 旋转结束后判定停在哪一扇区。 */
  private judge(
    target: { name: string; hex: string },
    _wheel: HTMLElement,
    spinBtn: HTMLButtonElement,
  ): void {
    const n = this.sectors.length;
    const segAngle = 360 / n;
    // 顶部扇区索引：currentAngle 取模后，反推
    const norm = ((this.currentAngle % 360) + 360) % 360;
    // 顶部对应扇区中心角度（顺时针从顶部）= (360 - norm) mod 360
    const topAngle = (360 - norm + 360) % 360;
    const idx = Math.floor(topAngle / segAngle) % n;
    const landed = this.sectors[idx]!;
    const correct = landed.name === target.name;

    if (correct) {
      this.roundsDone += 1;
      this.resetWrongStreak();
      const rect = (
        _wheel.parentElement as HTMLElement
      ).getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else {
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
    }
    this.spinning = false;
    spinBtn.disabled = false;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 900);
  }

  private conicGradient(sectors: { hex: string }[]): string {
    const n = sectors.length;
    const seg = 100 / n;
    const stops: string[] = [];
    for (let i = 0; i < n; i++) {
      const from = i * seg;
      const to = (i + 1) * seg;
      stops.push(`${sectors[i]!.hex} ${from}% ${to}%`);
    }
    return `conic-gradient(${stops.join(",")})`;
  }

  /** 在 wheel 内叠加扇区分隔线（用 conic 渐变的描边难以做分隔，这里用伪元素数组）。 */
  private drawSectorLines(wheel: HTMLElement, n: number): void {
    const segAngle = 360 / n;
    for (let i = 0; i < n; i++) {
      const line = document.createElement("div");
      line.className = "wh-line";
      line.style.transform = `rotate(${i * segAngle}deg)`;
      wheel.appendChild(line);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "深呼吸，再来一次～",
      primary: {
        text: "继续",
        icon: "🎈",
        onClick: () => {
          ov.destroy();
          this.startRound();
        },
      },
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
    if (document.getElementById("wh-style")) return;
    const st = document.createElement("style");
    st.id = "wh-style";
    st.textContent = WH_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function WH_CSS(theme: string): string {
  return `
.wh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;}
.wh-task{font-size:1.25rem;font-weight:800;text-align:center;}
.wh-task span{font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.15);}
.wh-score{font-size:1.1rem;font-weight:700;color:#3a2e4a;}
.wh-score b{color:${theme};}
.wh-dial{position:relative;width:300px;height:300px;}
.wh-wheel{position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 10px #fff,0 0 0 14px ${theme},var(--shadow-lg);}
.wh-line{position:absolute;left:50%;top:0;width:2px;height:50%;background:rgba(255,255,255,.55);transform-origin:bottom center;}
.wh-hub{position:absolute;left:50%;top:50%;width:54px;height:54px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#ffe27a);box-shadow:var(--shadow);border:4px solid #fff;}
.wh-pointer{position:absolute;left:50%;top:-18px;transform:translateX(-50%);font-size:2rem;z-index:3;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));animation:wh-bob 1.2s ease-in-out infinite;}
.wh-btn{min-height:60px;padding:0 40px;font-size:1.25rem;font-weight:800;border-radius:999px;background:${theme};color:#fff;box-shadow:0 6px 0 #c46a00,var(--shadow);}
.wh-btn:active{transform:translateY(3px);box-shadow:0 3px 0 #c46a00,var(--shadow);}
.wh-btn:disabled{opacity:.6;cursor:default;}
@keyframes wh-bob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(4px)}}
@media(max-width:340px){.wh-dial{width:260px;height:260px;}}
`;
}

export function create(): WheelGame {
  return new WheelGame();
}
