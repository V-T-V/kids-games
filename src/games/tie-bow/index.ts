/* 蝴蝶结 Tie-Bow —— 按顺序点出打蝴蝶结的 4 步。
   逻辑复用 _shared/StepOrderGame。前缀 tbw-。 */

import { StepOrderGame, type StepGroup } from "../_shared/StepOrderGame.ts";

const STEPS: StepGroup = [
  { emoji: "🟰", text: "两根带子交叉" },
  { emoji: "➰", text: "绕一个小圈圈" },
  { emoji: "🕳️", text: "穿过去" },
  { emoji: "🎀", text: "拉紧成蝴蝶结" },
];

export class TieBowGame extends StepOrderGame {
  constructor() {
    super("tie-bow", {
      prefix: "tbw",
      themeVar: "--c-pink",
      groups: [STEPS],
      stepCount: { easy: 4, medium: 4, hard: 4 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
      taskTemplate: () => `打蝴蝶结分<b>4 步</b>，按顺序点图～`,
      restEmoji: "🎀",
      restBody: "想想<b>第一步</b>：先把两根带子交叉～",
    });
  }
}

export function create(): TieBowGame {
  return new TieBowGame();
}
