// 算星工具单测：各映射函数的边界与默认阈值。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  minStars,
  starsByAccuracy,
  starsByMoves,
  starsByRate,
  starsByScore,
  starsByTime,
} from "../src/core/scoring.ts";

test("starsByAccuracy 默认阈值：错1→3★，错3→2★，错4→1★", () => {
  assert.equal(starsByAccuracy(0), 3);
  assert.equal(starsByAccuracy(1), 3);
  assert.equal(starsByAccuracy(2), 2);
  assert.equal(starsByAccuracy(3), 2);
  assert.equal(starsByAccuracy(4), 1);
});

test("starsByAccuracy 自定义阈值", () => {
  assert.equal(starsByAccuracy(2, [0, 1]), 1);
  assert.equal(starsByAccuracy(0, [0, 1]), 3);
});

test("starsByRate 按正确率", () => {
  assert.equal(starsByRate(10, 10), 3); // 1.0 ≥ 0.95
  assert.equal(starsByRate(9, 10), 2); // 0.9 在 0.7~0.95 之间 → 2★
  assert.equal(starsByRate(8, 10), 2); // 0.8
  assert.equal(starsByRate(5, 10), 1); // 0.5
});

test("starsByRate total 为 0 返回 3 星", () => {
  assert.equal(starsByRate(0, 0), 3);
});

test("starsByTime 按耗时", () => {
  assert.equal(starsByTime(5000, [10000, 20000]), 3);
  assert.equal(starsByTime(15000, [10000, 20000]), 2);
  assert.equal(starsByTime(25000, [10000, 20000]), 1);
});

test("starsByMoves 按操作数", () => {
  assert.equal(starsByMoves(5, [10, 20]), 3);
  assert.equal(starsByMoves(15, [10, 20]), 2);
  assert.equal(starsByMoves(25, [10, 20]), 1);
});

test("starsByScore 按得分", () => {
  assert.equal(starsByScore(100, [80, 50]), 3);
  assert.equal(starsByScore(60, [80, 50]), 2);
  assert.equal(starsByScore(30, [80, 50]), 1);
});

test("minStars 取最小", () => {
  assert.equal(minStars(3, 2, 3), 2);
  assert.equal(minStars(1, 3), 1);
  assert.equal(minStars(), 3);
});

// 动作/反应类游戏的统一算星约定（见 scoring.ts 头注释）：
// 按本局失误数 wrongCount 用 starsByAccuracy(wrongCount, [0, 2]) 算星。
// 锁住阈值，防退化回"必 3 星"（曾用 starsByScore(need,[need,need]) 导致永远 3★）。
test("动作游戏算星约定 starsByAccuracy(wrongCount, [0,2])", () => {
  assert.equal(starsByAccuracy(0, [0, 2]), 3); // 0 失误 → 3★（完美通关）
  assert.equal(starsByAccuracy(1, [0, 2]), 2); // 1 失误 → 2★
  assert.equal(starsByAccuracy(2, [0, 2]), 2); // 2 失误 → 2★
  assert.equal(starsByAccuracy(3, [0, 2]), 1); // ≥3 失误 → 1★
  assert.equal(starsByAccuracy(5, [0, 2]), 1); // 更多失误仍通关 → 1★
});

// —— 边界与防御性测试（输入异常时不应崩溃或返回 NaN/越界）——

test("starsByAccuracy 边界：负错误数视为 0 错（>=3星，不崩溃）", () => {
  assert.equal(starsByAccuracy(-1), 3, "负数 wrongs 仍 <= 阈值应得 3 星");
  assert.equal(starsByAccuracy(-100, [0, 2]), 3);
});

test("starsByAccuracy 阈值边界精确：等于阈值即该档", () => {
  assert.equal(starsByAccuracy(3, [1, 3]), 2, "错3=thresholds[1] 应得 2 星");
  assert.equal(starsByAccuracy(4, [1, 3]), 1, "错4>thresholds[1] 应得 1 星");
  assert.equal(starsByAccuracy(1, [1, 3]), 3, "错1=thresholds[0] 应得 3 星");
});

test("starsByRate 边界：负 total 不崩溃（total<=0 兜底 3 星）", () => {
  assert.equal(starsByRate(5, -1), 3, "total<=0 应兜底返回 3 星");
  assert.equal(starsByRate(0, -100), 3);
});

test("starsByRate 边界：correct>total 超额不崩溃（rate>1 仍 >=阈值→3星）", () => {
  assert.equal(starsByRate(15, 10), 3, "rate=1.5 超额仍应得 3 星");
});

test("starsByTime/starsByMoves/starsByScore 阈值等于即该档", () => {
  assert.equal(starsByTime(10000, [10000, 20000]), 3, "等于 3 星上限得 3");
  assert.equal(starsByTime(10001, [10000, 20000]), 2);
  assert.equal(starsByMoves(10, [10, 20]), 3, "等于 3 星上限得 3");
  assert.equal(starsByScore(80, [80, 50]), 3, "等于 3 星下限得 3");
  assert.equal(starsByScore(79, [80, 50]), 2);
});

test("minStars 防御：含 NaN 的星数被过滤，不污染结果（修复回归）", () => {
  // 曾有 bug：minStars(NaN,2) → Math.min(NaN,2)=NaN → Math.max(0,NaN)=NaN，
  // 游戏自定义算星若算出 NaN（如 starsByRate 异常输入）会污染最终星数致结算异常。
  // 修复：过滤非有限值（Number.isFinite）。
  assert.equal(minStars(NaN, 2), 2, "NaN 应被忽略，取剩余最小 2");
  assert.equal(minStars(2, NaN), 2);
  assert.equal(minStars(3, NaN, 1), 1, "NaN 忽略后取有效值最小");
});

test("minStars 防御：全 NaN/非有限值兜底 3 星（不返回 NaN）", () => {
  assert.equal(minStars(NaN, NaN), 3, "全部无效时兜底默认 3 星");
  assert.equal(minStars(NaN), 3);
  assert.equal(minStars(Infinity, -Infinity), 3, "Infinity 非有限也兜底");
});

test("minStars 防御：负星数被 clamp 到 0（不出负星）", () => {
  assert.equal(minStars(-5, 2), 0, "负值 clamp 到 0");
  assert.equal(minStars(-1), 0);
});

test("minStars 防御：超过 3 的星数被 clamp 到 3（不超封顶）", () => {
  assert.equal(minStars(5, 2), 2, "5 被 min 取到 2");
  assert.equal(minStars(99), 3, "单值 99 clamp 到 3");
  assert.equal(minStars(4, 5, 6), 3, "全超封顶 clamp 到 3");
});

test("minStars 正常多维度：短板决定", () => {
  assert.equal(minStars(3, 1, 2), 1);
  assert.equal(minStars(2, 2, 2), 2);
  assert.equal(minStars(3, 3), 3);
});
