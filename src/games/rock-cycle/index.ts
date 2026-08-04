/* 岩石循环 Rock Cycle —— 把岩石变化的阶段按顺序点出来。
   逻辑复用 _shared/CycleFlowGame（箭头时间线）。前缀 rkc-。 */

import { CycleFlowGame, type FlowCycle } from "../_shared/CycleFlowGame.ts";

const CYCLES: FlowCycle[] = [
  {
    theme: "火成岩",
    stages: [
      { emoji: "🌋", name: "岩浆" },
      { emoji: "🪨", name: "冷却成岩" },
      { emoji: "💨", name: "风化碎裂" },
      { emoji: "🧱", name: "沉积岩" },
    ],
  },
  {
    theme: "山变沙",
    stages: [
      { emoji: "⛰️", name: "大石头" },
      { emoji: "💨", name: "风吹雨打" },
      { emoji: "🟫", name: "小石子" },
      { emoji: "🏖️", name: "沙子" },
    ],
  },
  {
    theme: "火山变石",
    stages: [
      { emoji: "🌋", name: "火山喷发" },
      { emoji: "🪨", name: "岩浆岩" },
      { emoji: "🌧️", name: "被雨水冲" },
      { emoji: "🧱", name: "沉积成岩" },
    ],
  },
];

export class RockCycleGame extends CycleFlowGame {
  constructor() {
    super("rock-cycle", {
      prefix: "rkc",
      themeVar: "--c-brown",
      cycles: CYCLES,
      maxLen: { easy: 3, medium: 4, hard: 4 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
    });
  }
}

export function create(): RockCycleGame {
  return new RockCycleGame();
}
