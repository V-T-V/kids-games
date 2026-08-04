/* 穿衣顺序 Dress Order —— 按从里到外的顺序点出穿衣步骤。
   步骤：内裤→背心→袜子→裤子→外套。逻辑复用 _shared/StepOrderGame。前缀 dro-。 */

import { StepOrderGame, type StepGroup } from "../_shared/StepOrderGame.ts";

const STEPS: StepGroup = [
  { emoji: "🩲", text: "内裤" },
  { emoji: "🥼", text: "背心" },
  { emoji: "🧦", text: "袜子" },
  { emoji: "👖", text: "裤子" },
  { emoji: "🧥", text: "外套" },
];

export class DressOrderGame extends StepOrderGame {
  constructor() {
    super("dress-order", {
      prefix: "dro",
      themeVar: "--c-orange",
      groups: [STEPS],
      stepCount: { easy: 3, medium: 4, hard: 5 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
      taskTemplate: () => `早上穿衣，按<b>从里到外</b>的顺序点图～`,
      restEmoji: "🧥",
      restBody: "想想<b>最先</b>穿哪件：贴身的内裤最先穿～",
    });
  }
}

export function create(): DressOrderGame {
  return new DressOrderGame();
}
