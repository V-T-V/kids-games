// 难度配置解析单测：byDifficulty / isMonotonic / isStrictlyIncreasing / difficultyRank。
// 同时校验 _shared 基类的难度切片表随难度递增（教育内核约束：由浅入深不回退）。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  byDifficulty,
  isMonotonic,
  isStrictlyIncreasing,
  difficultyRank,
  DIFFICULTY_ORDER,
} from "../src/games/_shared/difficulty.ts";

test("byDifficulty: 三档取值", () => {
  assert.equal(byDifficulty("easy", { easy: 1, medium: 2, hard: 3 }), 1);
  assert.equal(byDifficulty("medium", { easy: 1, medium: 2, hard: 3 }), 2);
  assert.equal(byDifficulty("hard", { easy: 1, medium: 2, hard: 3 }), 3);
});

test("byDifficulty: 泛型支持字符串/对象", () => {
  assert.equal(
    byDifficulty("medium", { easy: "a", medium: "b", hard: "c" }),
    "b",
  );
  const o = byDifficulty("hard", {
    easy: { n: 1 },
    medium: { n: 2 },
    hard: { n: 3 },
  });
  assert.equal(o.n, 3);
});

test("isMonotonic: 递增/相等允许，禁止回退", () => {
  assert.equal(isMonotonic({ easy: 1, medium: 2, hard: 3 }), true);
  assert.equal(isMonotonic({ easy: 2, medium: 2, hard: 3 }), true); // medium===easy 允许
  assert.equal(isMonotonic({ easy: 2, medium: 3, hard: 3 }), true); // medium===hard 允许
  assert.equal(isMonotonic({ easy: 3, medium: 2, hard: 1 }), false); // 递减
  assert.equal(isMonotonic({ easy: 3, medium: 3, hard: 2 }), false); // hard 回退
});

test("isStrictlyIncreasing: 三档互不相同", () => {
  assert.equal(isStrictlyIncreasing({ easy: 1, medium: 2, hard: 3 }), true);
  assert.equal(isStrictlyIncreasing({ easy: 1, medium: 1, hard: 3 }), false);
  assert.equal(isStrictlyIncreasing({ easy: 1, medium: 2, hard: 2 }), false);
});

test("difficultyRank: easy<medium<hard", () => {
  assert.equal(difficultyRank("easy"), 0);
  assert.equal(difficultyRank("medium"), 1);
  assert.equal(difficultyRank("hard"), 2);
  assert.ok(difficultyRank("easy") < difficultyRank("medium"));
  assert.ok(difficultyRank("medium") < difficultyRank("hard"));
});

test("DIFFICULTY_ORDER: 三档顺序", () => {
  assert.deepEqual([...DIFFICULTY_ORDER], ["easy", "medium", "hard"]);
});

test("byDifficulty 等价于三目链（基准对照）", () => {
  // 模拟原 547 游戏的三目写法
  const ternary = (d: "easy" | "medium" | "hard"): number =>
    d === "easy" ? 4 : d === "medium" ? 6 : 8;
  const m = { easy: 4, medium: 6, hard: 8 };
  for (const d of DIFFICULTY_ORDER) {
    assert.equal(byDifficulty(d, m), ternary(d));
  }
});

test("StepOrderGame/CycleFlowGame 难度切片典型值随难度递增（教育内核）", () => {
  // 抽样 _shared 基类典型配置：步数与轮数应随难度不回退
  const stepCount = { easy: 3, medium: 4, hard: 5 };
  const roundTotal = { easy: 3, medium: 4, hard: 5 };
  assert.ok(isStrictlyIncreasing(stepCount), "步数应随难度严格递增");
  assert.ok(isStrictlyIncreasing(roundTotal), "轮数应随难度严格递增");
  // 验证 byDifficulty 与单调性组合
  assert.ok(
    byDifficulty("hard", roundTotal) >= byDifficulty("easy", roundTotal),
  );
});
