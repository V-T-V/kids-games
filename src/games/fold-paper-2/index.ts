/* 折纸精细 Fold-Paper-2 —— 按顺序点出折纸的 4 步。
   逻辑复用 _shared/StepOrderGame。前缀 fpw2-。 */

import { StepOrderGame, type StepGroup } from "../_shared/StepOrderGame.ts";

const STEPS: StepGroup = [
  { emoji: "📄", text: "对折成长方形" },
  { emoji: "📐", text: "折成三角形" },
  { emoji: "📃", text: "展开变回纸" },
  { emoji: "🕊️", text: "捏成小鸟成型" },
];

export class FoldPaper2Game extends StepOrderGame {
  constructor() {
    super("fold-paper-2", {
      prefix: "fpw2",
      themeVar: "--c-yellow",
      groups: [STEPS],
      stepCount: { easy: 4, medium: 4, hard: 4 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
      taskTemplate: () => `折纸分<b>4 步</b>，按顺序点图～`,
      restEmoji: "🕊️",
      restBody: "想想<b>第一步</b>：先把纸对折一下～",
    });
  }
}

export function create(): FoldPaper2Game {
  return new FoldPaper2Game();
}
