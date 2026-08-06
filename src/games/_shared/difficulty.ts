/**
 * 难度配置解析 —— 纯函数，消除遍布 547 个游戏的「三目难度分支」重复。
 *
 * 游戏里几乎都有这种代码：
 *   const n = this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
 * 这种分支散落 900+ 处，无法集中校验"难度递增"这一教育内核约束。
 *
 * 本模块提供 byDifficulty(diff, {easy,medium,hard}) 一行替代，
 * 使难度切片表显式化、可被单测批量校验（见 difficulty.test.ts）。
 */
import type { Difficulty } from "../../types.ts";

/** 三档难度映射的值表。 */
export interface DiffMap<T> {
  easy: T;
  medium: T;
  hard: T;
}

/** 按难度取值（替代三目链）。 */
export function byDifficulty<T>(diff: Difficulty, m: DiffMap<T>): T {
  return diff === "easy" ? m.easy : diff === "medium" ? m.medium : m.hard;
}

/** 整数难度切片：校验 easy < medium <= hard 的单调递增（教育内核约束）。
 *  允许 medium===hard（部分游戏 medium 与 hard 同档）但禁止 easy>=medium 或 medium>hard。
 *  返回是否满足"不回退"。 */
export function isMonotonic(m: DiffMap<number>): boolean {
  return m.easy <= m.medium && m.medium <= m.hard;
}

/** 严格递增（三档互不相同）。用于步骤数等应随难度严格增加的场合。 */
export function isStrictlyIncreasing(m: DiffMap<number>): boolean {
  return m.easy < m.medium && m.medium < m.hard;
}

/** 难度枚举顺序（用于遍历/比较）。 */
export const DIFFICULTY_ORDER: readonly Difficulty[] = [
  "easy",
  "medium",
  "hard",
] as const;

/** 难度排序权重：easy=0 < medium=1 < hard=2。 */
export function difficultyRank(diff: Difficulty): number {
  return diff === "easy" ? 0 : diff === "medium" ? 1 : 2;
}
