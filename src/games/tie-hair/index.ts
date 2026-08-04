/* 扎头发 Tie-Hair —— 按顺序点出扎头发的 4 步。
   逻辑复用 _shared/StepOrderGame。前缀 thrh-。 */

import { StepOrderGame, type StepGroup } from "../_shared/StepOrderGame.ts";

const STEPS: StepGroup = [
  { emoji: "🪮", text: "梳顺头发" },
  { emoji: "✂️", text: "分一缕头发" },
  { emoji: "🧶", text: "皮筋绕几圈" },
  { emoji: "💮", text: "打个结固定" },
];

export class TieHairGame extends StepOrderGame {
  constructor() {
    super("tie-hair", {
      prefix: "thrh",
      themeVar: "--c-purple",
      groups: [STEPS],
      stepCount: { easy: 4, medium: 4, hard: 4 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
      taskTemplate: () => `扎头发分<b>4 步</b>，按顺序点图～`,
      restEmoji: "🪮",
      restBody: "想想<b>第一步</b>：先把头发梳顺～",
    });
  }
}

export function create(): TieHairGame {
  return new TieHairGame();
}
