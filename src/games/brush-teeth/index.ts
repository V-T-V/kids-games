/* 刷牙步骤 Brush Teeth —— 把刷牙步骤图按正确顺序点出来。
   步骤：①挤牙膏 ②刷外面 ③刷里面 ④刷上面 ⑤漱口 ⑥擦嘴。
   逻辑复用 _shared/StepOrderGame（与 wash-hands/dress-order 等同构）。前缀 brt-。 */

import { StepOrderGame, type StepGroup } from "../_shared/StepOrderGame.ts";

const STEPS: StepGroup = [
  { emoji: "🪥", text: "挤牙膏" },
  { emoji: "😬", text: "刷外面" },
  { emoji: "👅", text: "刷里面" },
  { emoji: "😁", text: "刷上面" },
  { emoji: "💦", text: "漱口" },
  { emoji: "🧻", text: "擦嘴" },
];

export class BrushTeethGame extends StepOrderGame {
  constructor() {
    super("brush-teeth", {
      prefix: "brt",
      themeVar: "--c-cyan",
      groups: [STEPS],
      stepCount: { easy: 4, medium: 5, hard: 6 },
      roundTotal: { easy: 2, medium: 3, hard: 4 },
      taskTemplate: (n) => `刷牙分<b>${n} 步</b>，按正确顺序点图～`,
      restEmoji: "🪥",
      restBody: "想想刷牙<b>第一步</b>做什么：先在牙刷上挤牙膏～",
    });
  }
}

export function create(): BrushTeethGame {
  return new BrushTeethGame();
}
