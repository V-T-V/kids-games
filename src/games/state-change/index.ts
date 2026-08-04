/* 物质三态变化 State Change —— 把物体的变化阶段按顺序点出来。
   逻辑复用 _shared/CycleFlowGame（箭头时间线）。前缀 stch-。
   内容：水的三态循环（冰→水→水蒸气→云→雨）、巧克力融化、蜡烛变蜡油等日常物态变化。
   难度=变化步骤数：easy 3 步、medium 4 步、hard 5 步；轮数 4/6/8。 */

import { CycleFlowGame, type FlowCycle } from "../_shared/CycleFlowGame.ts";

const CYCLES: FlowCycle[] = [
  {
    theme: "水的变化",
    stages: [
      { emoji: "🧊", name: "冰块" },
      { emoji: "💧", name: "化成水" },
      { emoji: "🌫️", name: "变水蒸气" },
      { emoji: "☁️", name: "升上云" },
      { emoji: "🌧️", name: "下成雨" },
    ],
  },
  {
    theme: "巧克力的变化",
    stages: [
      { emoji: "🍫", name: "硬巧克力" },
      { emoji: "🫠", name: "受热变软" },
      { emoji: "🍮", name: "化成巧克力酱" },
      { emoji: "❄️", name: "放凉又变硬" },
    ],
  },
  {
    theme: "蜡烛的变化",
    stages: [
      { emoji: "🕯️", name: "点燃蜡烛" },
      { emoji: "🔥", name: "火焰烧它" },
      { emoji: "🫠", name: "蜡化成蜡油" },
      { emoji: "💧", name: "蜡油滴下" },
    ],
  },
  {
    theme: "冬天到春天",
    stages: [
      { emoji: "🧊", name: "河面结冰" },
      { emoji: "☀️", name: "太阳出来晒" },
      { emoji: "💧", name: "冰化成水" },
      { emoji: "🌊", name: "河水流动" },
    ],
  },
  {
    theme: "做饭的水",
    stages: [
      { emoji: "💧", name: "冷水" },
      { emoji: "♨️", name: "烧开了" },
      { emoji: "💨", name: "冒白气" },
      { emoji: "🌫️", name: "变成水蒸气" },
    ],
  },
  {
    theme: "雪的小旅行",
    stages: [
      { emoji: "❄️", name: "天上飘雪" },
      { emoji: "🏔️", name: "落在山上" },
      { emoji: "☀️", name: "春天晒化" },
      { emoji: "💧", name: "化成雪水" },
      { emoji: "🌊", name: "流进小河" },
    ],
  },
];

export class StateChangeGame extends CycleFlowGame {
  constructor() {
    super("state-change", {
      prefix: "stch",
      themeVar: "--c-blue",
      cycles: CYCLES,
      maxLen: { easy: 3, medium: 4, hard: 5 },
      roundTotal: { easy: 4, medium: 6, hard: 8 },
    });
  }
}

export function create(): StateChangeGame {
  return new StateChangeGame();
}
