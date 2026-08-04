/* 消防安全 Fire-Safety —— 按正确逃生顺序点出 4 步。
   逻辑复用 _shared/StepOrderGame。前缀 frs2-。 */

import { StepOrderGame, type StepGroup } from "../_shared/StepOrderGame.ts";

const STEPS: StepGroup = [
  { emoji: "🤭", text: "捂住口鼻" },
  { emoji: "🙇", text: "弯下腰走" },
  { emoji: "🏃", text: "赶紧往外跑" },
  { emoji: "📞", text: "拨打 119" },
];

export class FireSafetyGame extends StepOrderGame {
  constructor() {
    super("fire-safety", {
      prefix: "frs2",
      themeVar: "--c-red",
      groups: [STEPS],
      stepCount: { easy: 4, medium: 4, hard: 4 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
      taskTemplate: () => `着火了怎么逃生？按<b>正确顺序</b>点图～`,
      restEmoji: "🚒",
      restBody: "想想着火时<b>第一步</b>：先用湿布捂住口鼻～",
    });
  }
}

export function create(): FireSafetyGame {
  return new FireSafetyGame();
}
