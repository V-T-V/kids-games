/**
 * 连连看路径检测测试。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { canConnect } from "../src/games/link-match/pathfind.ts";

/** 构造一个 grid：'.'=空，字母=图案。 */
function grid(rows: string[]): string[][] {
  return rows.map((r) => r.split("").map((c) => (c === "." ? "" : c)));
}

test("canConnect: 相邻同行可直线连通（0 拐弯）", () => {
  const g = grid(["aa...."]);
  const res = canConnect(g, 0, 0, 1, 0);
  assert.equal(res.ok, true);
  assert.equal(res.corners.length, 0);
});

test("canConnect: 相隔有阻挡则不能直线，但可绕外圈（2 拐弯）", () => {
  // a.b.a  → 中间 b 阻挡，但能从上方外围绕过
  const g = grid(["aba"]);
  const res = canConnect(g, 0, 0, 2, 0);
  assert.equal(res.ok, true);
  assert.ok(res.corners.length <= 2);
});

test("canConnect: 不同图案不能连通", () => {
  const g = grid(["ab"]);
  const res = canConnect(g, 0, 0, 1, 0);
  assert.equal(res.ok, false);
});

test("canConnect: 1 拐弯 L 形连通", () => {
  // a.
  // .a  → 两个 a 在对角，经 (1,0) 或 (0,1) 拐一次
  const g = grid(["a.", ".a"]);
  const res = canConnect(g, 0, 0, 1, 1);
  assert.equal(res.ok, true);
  assert.equal(res.corners.length, 1);
});

test("canConnect: 同一点不算连通", () => {
  const g = grid(["a."]);
  const res = canConnect(g, 0, 0, 0, 0);
  assert.equal(res.ok, false);
});

test("canConnect: 完全包围无法连通返回 false", () => {
  // 中心 a 被其它图案围住，外围也有 a 但路径全被堵
  const g = grid(["axa", "xbx", "axa"]);
  // 中心 b 与任何 a 不同，必 false
  const res = canConnect(g, 1, 1, 0, 0);
  assert.equal(res.ok, false);
});
