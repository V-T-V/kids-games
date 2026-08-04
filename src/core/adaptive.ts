/**
 * 自适应难度算法 —— 根据孩子近局表现建议升降档。
 *
 * 之前的「自适应」是假的：只读 bestDifficulty 当起始档，不会根据表现变化。
 * 本模块基于最近若干局结算（recentResults）输出建议难度，真正闭环。
 *
 * 规则（保守，避免频繁抖动）：
 *  - 连续 2 局在该档拿 3★ 且通关 → 升一档
 *  - 连续 2 局拿 1★ 或未通关 → 降一档
 *  - 否则保持当前档
 *
 * 全部是纯函数，便于单测。
 */
import type { Difficulty, GameResult } from "../types.ts";

const ORDER: Difficulty[] = ["easy", "medium", "hard"];

/** 取某档的序号（0/1/2）。 */
export function rank(d: Difficulty): number {
  return ORDER.indexOf(d);
}

/** 升一档；已最高则不变。 */
export function bumpUp(d: Difficulty): Difficulty {
  return d === "easy" ? "medium" : d === "medium" ? "hard" : "hard";
}

/** 降一档；已最低则不变。 */
export function bumpDown(d: Difficulty): Difficulty {
  return d === "hard" ? "medium" : d === "medium" ? "easy" : "easy";
}

/**
 * 根据最近表现给出建议难度。
 * @param current 当前难度（建议基于此升降，而非全局最优）
 * @param recent 最近若干局结算（最新在末尾）
 * @returns 建议难度（可能与 current 相同）
 */
export function suggestDifficulty(
  current: Difficulty,
  recent: readonly GameResult[],
): Difficulty {
  if (recent.length < 2) return current;

  // 取最近 2 局
  const last2 = recent.slice(-2);

  // 升档条件：最近 2 局都在当前档、都通关、都 3 星
  const allPerfect = last2.every(
    (r) => r.difficulty === current && r.cleared && r.stars >= 3,
  );
  if (allPerfect && current !== "hard") return bumpUp(current);

  // 降档条件：最近 2 局都未通关，或都拿 1 星
  const allPoor = last2.every((r) => !r.cleared || r.stars <= 1);
  if (allPoor && current !== "easy") return bumpDown(current);

  return current;
}

/**
 * 综合解析：决定本局起始难度。
 * 优先级：家长锁定 > 自适应建议（含"太难"反馈降档信号） > 历史最高档 > easy。
 * @param locked 家长锁定的难度（null 表示不锁，交给自适应）
 * @param recent 最近若干局结算
 * @param bestDifficulty 历史最高通关档（可能为 null）
 * @param hardFeedbackCount 该游戏"太难/玩不通"反馈条数（可选，>0 时倾向降一档）
 */
export function resolveDifficulty(
  locked: Difficulty | null,
  recent: readonly GameResult[],
  bestDifficulty: Difficulty | null,
  hardFeedbackCount = 0,
): Difficulty {
  if (locked) return locked;
  const base = bestDifficulty ?? "easy";
  let suggested = suggestDifficulty(base, recent);
  // 联动反馈：若有"太难/玩不通"反馈且当前非 easy，温柔降一档。
  // 这不强制（家长锁定优先），只是给孩子一个更友好的起点。
  if (hardFeedbackCount > 0 && suggested !== "easy") {
    suggested = bumpDown(suggested);
  }
  return suggested;
}
