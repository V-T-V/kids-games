/* 洗手步骤 Wash Hands —— 把洗手步骤按正确顺序点出来。
   步骤：①湿水 ②抹肥皂 ③手心搓 ④手背搓 ⑤指缝搓 ⑥冲洗 ⑦擦干。
   逻辑复用 _shared/StepOrderGame。前缀 whs-。 */

import { StepOrderGame, type StepGroup } from "../_shared/StepOrderGame.ts";

const STEPS: StepGroup = [
  { emoji: "💧", text: "湿水" },
  { emoji: "🧼", text: "抹肥皂" },
  { emoji: "🤲", text: "手心搓" },
  { emoji: "✋", text: "手背搓" },
  { emoji: "🤝", text: "指缝搓" },
  { emoji: "🚿", text: "冲洗" },
  { emoji: "🧻", text: "擦干" },
];

export class WashHandsGame extends StepOrderGame {
  constructor() {
    super("wash-hands", {
      prefix: "whs",
      themeVar: "--c-blue",
      groups: [STEPS],
      stepCount: { easy: 4, medium: 6, hard: 7 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
      taskTemplate: (n) => `洗手分<b>${n} 步</b>，按正确顺序点图～`,
      restEmoji: "🧼",
      restBody: "想想洗手<b>第一步</b>：先用水把小手打湿～",
    });
  }
}

export function create(): WashHandsGame {
  return new WashHandsGame();
}
