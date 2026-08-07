/* 图案设计（pattern-design）核心逻辑测试 —— 纯函数不变量校验，无 DOM。
   覆盖：SHAPES 唯一性 / isPeriodic 周期性 / blanksAreValid 不相邻+不含首尾 /
   poolIsValid 含全部正确答案+干扰项不与单元重复 / extractUnit / makePuzzle 不变量套件。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHAPES,
  blanksAreValid,
  extractUnit,
  isPeriodic,
  makePuzzle,
  poolIsValid,
} from "../src/games/pattern-design/engine.ts";

test("SHAPES: 10 个互不相同的 emoji", () => {
  assert.equal(SHAPES.length, 10);
  const set = new Set(SHAPES);
  assert.equal(set.size, 10);
});

test("isPeriodic: 由单元严格重复为 true", () => {
  // [A,B] 重复 3 次
  assert.equal(isPeriodic(["A", "B", "A", "B", "A", "B"], 2), true);
  // [A,B,C] 重复 3 次
  assert.equal(
    isPeriodic(["A", "B", "C", "A", "B", "C", "A", "B", "C"], 3),
    true,
  );
});

test("isPeriodic: 非周期或长度不整除为 false", () => {
  assert.equal(isPeriodic(["A", "B", "A", "C"], 2), false); // 第4个不符
  assert.equal(isPeriodic(["A", "B", "A"], 2), false); // 长度不整除
  assert.equal(isPeriodic(["A", "A", "B"], 1), false); // unitLen=1 要求全同
});

test("isPeriodic: 边界（空数组/非正 unitLen）", () => {
  assert.equal(isPeriodic([], 2), false);
  assert.equal(isPeriodic(["A", "B"], 0), false);
});

test("extractUnit: 取前 unitLen 个元素（保序）", () => {
  assert.deepEqual(extractUnit(["A", "B", "A", "B", "A", "B"], 2), ["A", "B"]);
  assert.deepEqual(extractUnit(["X", "Y", "Z", "X", "Y", "Z"], 3), [
    "X",
    "Y",
    "Z",
  ]);
});

test("blanksAreValid: 空缺两两不相邻 + 不含首尾", () => {
  // total=6，空缺 [1,3,5]：5 是末位（total-1）→ 不合法
  assert.equal(blanksAreValid([1, 3, 5], 6), false);
  // [1,4]：不相邻、不含首尾 → 合法
  assert.equal(blanksAreValid([1, 4], 6), true);
  // [2,3]：相邻 → 不合法
  assert.equal(blanksAreValid([2, 3], 6), false);
  // [0,4]：含首位 → 不合法
  assert.equal(blanksAreValid([0, 4], 6), false);
});

test("blanksAreValid: 单空缺不含首尾合法", () => {
  assert.equal(blanksAreValid([2], 6), true);
  assert.equal(blanksAreValid([0], 6), false); // 首位
  assert.equal(blanksAreValid([5], 6), false); // 末位
});

test("blanksAreValid: 无序输入自动排序判定", () => {
  assert.equal(blanksAreValid([4, 1], 6), true); // 等价 [1,4]
  assert.equal(blanksAreValid([3, 2], 6), false); // 等价 [2,3] 相邻
});

test("blanksAreValid: 空数组合法", () => {
  assert.equal(blanksAreValid([], 6), true);
});

test("poolIsValid: 池含全部正确答案 + 干扰项不在单元里", () => {
  const unit = ["A", "B"];
  const correct = ["A"]; // 一个空缺答案
  // 池含 A + 干扰 C（不在单元）
  assert.equal(poolIsValid(["A", "C"], correct, unit), true);
  // 干扰 B 在单元里 → 不合法
  assert.equal(poolIsValid(["A", "B"], correct, unit), false);
});

test("poolIsValid: 池缺正确答案为 false", () => {
  const unit = ["A", "B"];
  const correct = ["A", "B"];
  assert.equal(poolIsValid(["A", "C"], correct, unit), false); // 缺 B
});

test("makePuzzle: 单元长度为 2 或 3", () => {
  for (let i = 0; i < 30; i++) {
    const p = makePuzzle(1);
    assert.ok(p.unitLen === 2 || p.unitLen === 3);
  }
});

test("makePuzzle: 总长度恰为 unitLen * 3", () => {
  for (let i = 0; i < 30; i++) {
    const p = makePuzzle(1);
    assert.equal(p.full.length, p.unitLen * 3);
  }
});

test("makePuzzle: full 序列严格周期重复（可解性不变量）", () => {
  for (let i = 0; i < 30; i++) {
    const p = makePuzzle(2);
    assert.ok(isPeriodic(p.full, p.unitLen), "full 必须严格周期重复");
  }
});

test("makePuzzle: 空缺位置两两不相邻且不含首尾", () => {
  for (let i = 0; i < 30; i++) {
    const p = makePuzzle(2);
    assert.ok(blanksAreValid(p.blanks, p.full.length));
  }
});

test("makePuzzle: 候选池含全部正确答案且干扰项不与单元重复", () => {
  for (let i = 0; i < 30; i++) {
    const p = makePuzzle(2);
    const unit = extractUnit(p.full, p.unitLen);
    const correct = p.blanks.map((idx) => p.full[idx]!);
    assert.ok(poolIsValid(p.pool, correct, unit));
  }
});

test("makePuzzle: 单空缺谜题的空缺答案与 full 对应位置一致", () => {
  const p = makePuzzle(1);
  assert.equal(p.blanks.length, 1);
  const blankIdx = p.blanks[0]!;
  // 池中必含 full[blankIdx]
  assert.ok(p.pool.includes(p.full[blankIdx]!));
});

test("makePuzzle: 候选池元素全部来自 SHAPES", () => {
  const shapeSet = new Set(SHAPES as readonly string[]);
  for (let i = 0; i < 30; i++) {
    const p = makePuzzle(2);
    for (const s of p.pool) {
      assert.ok(shapeSet.has(s), `池元素 ${s} 不在 SHAPES 内`);
    }
  }
});

test("makePuzzle: 池规模 = 原始正确答案数(blanks) + 干扰项数(blanks+1)", () => {
  // makePuzzle(blanks)：correct = 每空缺答案（含重复），distract = blanks+1
  // 故 pool.length = blanks + (blanks+1) = 2*blanks+1
  for (let i = 0; i < 30; i++) {
    const p = makePuzzle(2);
    assert.equal(p.pool.length, p.blanks.length + (p.blanks.length + 1));
  }
});
