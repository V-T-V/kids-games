/* 系鞋带 Tie Shoe —— 按顺序点出系鞋带的 4 步。
   逻辑复用 _shared/StepOrderGame。前缀 tsh-。 */

import { StepOrderGame, type StepGroup } from "../_shared/StepOrderGame.ts";

const SEQUENCE: StepGroup = [
  { emoji: "🩱", text: "交叉" },
  { emoji: "🕳️", text: "穿洞" },
  { emoji: "💪", text: "拉紧" },
  { emoji: "🦋", text: "打结" },
];

export class TieShoeGame extends StepOrderGame {
  constructor() {
    super("tie-shoe", {
      prefix: "tsh",
      themeVar: "--c-purple",
      groups: [SEQUENCE],
      stepCount: { easy: 4, medium: 4, hard: 4 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
      taskTemplate: () => `系鞋带分<b>4 步</b>，按正确顺序点图～`,
      restEmoji: "👟",
      restBody: "想想<b>第一步</b>：先把两根鞋带交叉～",
    });
  }
}

export function create(): TieShoeGame {
  return new TieShoeGame();
}
