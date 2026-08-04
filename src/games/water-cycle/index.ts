/* 水循环 Water Cycle —— 把水的变化阶段按顺序点出来。
   逻辑复用 _shared/CycleFlowGame（箭头时间线）。前缀 wcy-。 */

import { CycleFlowGame, type FlowCycle } from "../_shared/CycleFlowGame.ts";

const CYCLES: FlowCycle[] = [
  {
    theme: "水循环",
    stages: [
      { emoji: "☀️", name: "太阳晒" },
      { emoji: "💨", name: "水变水汽" },
      { emoji: "☁️", name: "变成云" },
      { emoji: "🌧️", name: "下雨" },
      { emoji: "🌊", name: "流回大海" },
    ],
  },
  {
    theme: "下雨的过程",
    stages: [
      { emoji: "🌊", name: "海里的水" },
      { emoji: "☀️", name: "被太阳晒热" },
      { emoji: "☁️", name: "升上天空变云" },
      { emoji: "🌧️", name: "云变重下雨" },
    ],
  },
  {
    theme: "云的小旅行",
    stages: [
      { emoji: "💨", name: "水汽飞上天" },
      { emoji: "☁️", name: "聚成小云朵" },
      { emoji: "🌫️", name: "云越变越大" },
      { emoji: "⛈️", name: "下雨落下来" },
    ],
  },
];

export class WaterCycleGame extends CycleFlowGame {
  constructor() {
    super("water-cycle", {
      prefix: "wcy",
      themeVar: "--c-blue",
      cycles: CYCLES,
      maxLen: { easy: 3, medium: 4, hard: 5 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
    });
  }
}

export function create(): WaterCycleGame {
  return new WaterCycleGame();
}
