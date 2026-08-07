/**
 * 图案设计核心逻辑 —— 纯函数 + 不变量校验，无 DOM 依赖，便于单元测试。
 *
 * 从 index.ts 提取。谜题结构：一个长度为 total 的重复图形序列（由长度 unitLen
 * 的基础单元重复 total/unitLen 次），其中 blanks 个位置被挖空；玩家从候选池里
 * 选图形补上。核心不变量保证谜题「可解且答案唯一」：
 *  - 序列由基础单元严格周期重复；
 *  - 空缺位置两两不相邻（避免歧义干扰）；
 *  - 空缺不出现在首尾（保证从已显露的单元可推断规律）；
 *  - 候选池恰含全部正确答案 + 若干扰项（来自未在单元里出现的形状，避免与正确
 *    答案混淆）。
 */
import { shuffle } from "../../lobby/util.ts";

/** 可用形状全集（10 个互不相同的 emoji）。 */
export const SHAPES = [
  "🔴",
  "🟡",
  "🔵",
  "🟢",
  "🟣",
  "🟠",
  "⭐",
  "🔺",
  "🟦",
  "🔶",
] as const;

export interface Puzzle {
  /** 完整序列（含空缺处的正确答案） */
  full: string[];
  /** 空缺位置索引（升序、两两不相邻、不含首尾） */
  blanks: number[];
  /** 候选答案池（含全部正确答案 + 干扰项） */
  pool: string[];
  /** 基础重复单元长度（2 或 3） */
  unitLen: number;
}

/** 从 full 中按周期 unitLen 提取基础单元（去重保序）。 */
export function extractUnit(full: string[], unitLen: number): string[] {
  const unit: string[] = [];
  for (let i = 0; i < unitLen && i < full.length; i++) {
    unit.push(full[i]!);
  }
  return unit;
}

/** 校验序列是否由长度 unitLen 的单元严格周期重复。 */
export function isPeriodic(full: string[], unitLen: number): boolean {
  if (unitLen <= 0 || full.length === 0) return false;
  if (full.length % unitLen !== 0) return false;
  for (let i = unitLen; i < full.length; i++) {
    if (full[i] !== full[i % unitLen]) return false;
  }
  return true;
}

/** 校验空缺位置两两不相邻（曼哈顿距离 > 1），且不含首尾。 */
export function blanksAreValid(blanks: number[], total: number): boolean {
  if (blanks.length === 0) return true;
  const sorted = [...blanks].sort((a, b) => a - b);
  // 不含首尾
  if (sorted[0]! <= 0 || sorted[sorted.length - 1]! >= total - 1) return false;
  // 两两不相邻
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i]! - sorted[i - 1]!) <= 1) return false;
  }
  return true;
}

/** 校验候选池恰含全部正确答案，且干扰项不与单元形状重复。 */
export function poolIsValid(
  pool: string[],
  correct: string[],
  unit: string[],
): boolean {
  const poolSet = new Set(pool);
  const correctSet = new Set(correct);
  // 池含全部正确答案
  for (const c of correctSet) {
    if (!poolSet.has(c)) return false;
  }
  // 干扰项不在单元里
  const unitSet = new Set(unit);
  for (const p of poolSet) {
    if (!correctSet.has(p) && unitSet.has(p)) return false;
  }
  return true;
}

/** 构造一个可解规律谜题：基础重复单元 + 不相邻空缺 + 干扰项。 */
export function makePuzzle(blanks: number): Puzzle {
  // 重复单元长度 2 或 3
  const unitLen = Math.random() < 0.5 ? 2 : 3;
  const unitShapes = shuffle([...SHAPES]).slice(0, unitLen);
  // 总长度 = unitLen 的倍数（2→6，3→9）
  const total = unitLen * 3;
  const full: string[] = [];
  for (let i = 0; i < total; i++) {
    full.push(unitShapes[i % unitLen]!);
  }
  // 选空缺位置（避开彼此太近导致歧义，且保证答案唯一）
  const blankIdx: number[] = [];
  const positions = shuffle(full.map((_, i) => i)).filter(
    (i) => i > 0 && i < total - 1,
  );
  for (const p of positions) {
    if (blankIdx.length >= blanks) break;
    // 避免相邻空缺
    if (blankIdx.some((b) => Math.abs(b - p) <= 1)) continue;
    blankIdx.push(p);
  }
  blankIdx.sort((a, b) => a - b);
  // 干扰选项：用未在单元里的形状
  const used = new Set(unitShapes);
  const distract = SHAPES.filter((s) => !used.has(s)).slice(0, blanks + 1);
  // 正确答案集合（去重）
  const correct = blankIdx.map((i) => full[i]!);
  const pool = shuffle([...correct, ...distract]);
  return { full, blanks: blankIdx, pool, unitLen };
}
