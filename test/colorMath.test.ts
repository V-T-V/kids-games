/**
 * 颜色混合算法测试。
 * 用 node --test 运行：`npm test`。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mix,
  toHex,
  fromHex,
  isMatch,
  nameOf,
  PRIMARY_COLORS,
} from "../src/games/color-mixer/colorMath.ts";

test("mix: 红+黄 = 橙色（颜料混合，非光的加色）", () => {
  const result = mix([
    { color: PRIMARY_COLORS["红"]! },
    { color: PRIMARY_COLORS["黄"]! },
  ]);
  // 橙色：R 偏高，G 中等，B 低
  assert.ok(result.r > 200, `R 应偏高，实际 ${result.r}`);
  assert.ok(result.g > 100 && result.g < 230, `G 应中等，实际 ${result.g}`);
  assert.ok(result.b < 80, `B 应偏低，实际 ${result.b}`);
});

test("mix: 蓝+黄 = 绿色（经典颜料混合）", () => {
  const result = mix([
    { color: PRIMARY_COLORS["蓝"]! },
    { color: PRIMARY_COLORS["黄"]! },
  ]);
  // 蓝(40,110,220)+黄(245,210,30) → 约(142,160,125)，偏青绿
  // G 应是三通道里最高的（绿色调主导）
  assert.ok(
    result.g >= result.r,
    `G 应 >= R（绿调主导），G=${result.g} R=${result.r}`,
  );
  assert.ok(result.g >= result.b, `G 应 >= B，G=${result.g} B=${result.b}`);
});

test("mix: 红+蓝 = 紫色", () => {
  const result = mix([
    { color: PRIMARY_COLORS["红"]! },
    { color: PRIMARY_COLORS["蓝"]! },
  ]);
  // 紫色：R 和 B 都较高
  assert.ok(result.r > 100, `R 应偏高，实际 ${result.r}`);
  assert.ok(result.b > 100, `B 应偏高，实际 ${result.b}`);
});

test("mix: 空数组返回白色", () => {
  assert.deepEqual(mix([]), { r: 255, g: 255, b: 255 });
});

test("mix: 滴数权重生效（多滴红压过一滴黄）", () => {
  const result = mix([
    { color: PRIMARY_COLORS["红"]!, amount: 3 },
    { color: PRIMARY_COLORS["黄"]!, amount: 1 },
  ]);
  assert.ok(result.r > result.g, "多滴红应让结果更偏红");
});

test("toHex / fromHex 互逆", () => {
  const hex = toHex({ r: 255, g: 128, b: 0 });
  assert.equal(hex, "#ff8000");
  assert.deepEqual(fromHex(hex), { r: 255, g: 128, b: 0 });
});

test("isMatch: 相同颜色匹配", () => {
  const c = { r: 200, g: 100, b: 50 };
  assert.ok(isMatch(c, c));
});

test("isMatch: 接近颜色在容差内匹配", () => {
  const a = { r: 200, g: 100, b: 50 };
  const b = { r: 205, g: 95, b: 55 };
  assert.ok(isMatch(a, b, 20));
});

test("isMatch: 差异大的颜色不匹配", () => {
  const a = { r: 255, g: 0, b: 0 };
  const b = { r: 0, g: 0, b: 255 };
  assert.ok(!isMatch(a, b, 36));
});

test("nameOf: 基本色识别", () => {
  assert.equal(nameOf({ r: 230, g: 40, b: 60 }), "红色");
  assert.equal(nameOf({ r: 40, g: 110, b: 220 }), "蓝色");
  assert.equal(nameOf({ r: 245, g: 210, b: 30 }), "黄色");
  assert.equal(nameOf({ r: 20, g: 20, b: 20 }), "黑色");
  assert.equal(nameOf({ r: 250, g: 250, b: 250 }), "白色");
});
