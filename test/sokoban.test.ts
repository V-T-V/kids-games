/* sokoban 纯逻辑测试——parse 字符串关卡解析 / isWin 全目标盖箱 / applyMove 推箱规则。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, isWin, applyMove, hasGoalWithoutBox } from "../src/games/sokoban/engine.ts";

// 关卡 1：####### / #     # / # @$. # / #     # / #######
const LVL1 = ["#######", "#     #", "# @$. #", "#     #", "#######"];
// 关卡含 *（箱在目标）与 +（人在目标）
const LVL_STAR = ["#####", "# * #", "# + #", "#####"];

test("parse: 关卡尺寸 w×h 取最长行", () => {
  const lv = parse(LVL1);
  assert.equal(lv.w, 7);
  assert.equal(lv.h, 5);
});

test("parse: 行长不齐时按最长行补地板（越界字符=空格）", () => {
  const raw = ["###", "# @$.", "###"]; // 第二行 5 字符
  const lv = parse(raw);
  assert.equal(lv.w, 5);
  assert.equal(lv.h, 3);
  assert.equal(lv.cells[1]![4], "."); // 目标
  assert.equal(lv.cells[0]![3], " "); // 第一行补地板
});

test("parse: # 解析为墙", () => {
  const lv = parse(LVL1);
  assert.equal(lv.cells[0]![0], "#");
  assert.equal(lv.cells[0]![6], "#");
  assert.equal(lv.cells[2]![3], " "); // 中间地板
});

test("parse: . 解析为目标点", () => {
  const lv = parse(LVL1);
  assert.equal(lv.cells[2]![4], ".");
  assert.ok(lv.goals[2]![4]);
  assert.ok(!lv.boxes[2]![4]);
});

test("parse: $ 解析为地板+箱子", () => {
  const lv = parse(LVL1);
  assert.equal(lv.cells[2]![3], " ");
  assert.ok(lv.boxes[2]![3]);
  assert.ok(!lv.goals[2]![3]);
});

test("parse: * 解析为目标+箱子（已就位）", () => {
  const lv = parse(LVL_STAR);
  assert.equal(lv.cells[1]![2], ".");
  assert.ok(lv.goals[1]![2]);
  assert.ok(lv.boxes[1]![2]);
});

test("parse: @ 解析为地板+人物位置", () => {
  const lv = parse(LVL1);
  assert.equal(lv.player.x, 2);
  assert.equal(lv.player.y, 2);
  assert.equal(lv.cells[2]![2], " ");
});

test("parse: + 解析为目标+人物位置", () => {
  const lv = parse(LVL_STAR);
  assert.equal(lv.player.x, 2);
  assert.equal(lv.player.y, 2);
  assert.ok(lv.goals[2]![2]);
});

test("parse: 空格/未知字符解析为地板", () => {
  const lv = parse(["#?#"]);
  assert.equal(lv.cells[0]![1], " ");
  assert.ok(!lv.boxes[0]![1]);
  assert.ok(!lv.goals[0]![1]);
});

test("isWin: 所有目标被箱覆盖 → true", () => {
  const lv = parse(["#####", "#*$ #", "#####"]); // $ 在目标上
  // 目标 (1,1) 有箱 → win
  assert.ok(isWin(lv));
});

test("isWin: 有目标未被覆盖 → false", () => {
  const lv = parse(LVL1); // 目标 (4,2) 无箱
  assert.ok(!isWin(lv));
});

test("isWin: 无目标关卡恒为 true", () => {
  const lv = parse(["#####", "#   #", "#####"]);
  assert.ok(isWin(lv));
});

test("hasGoalWithoutBox: 有未盖目标 → true", () => {
  const lv = parse(LVL1);
  assert.ok(hasGoalWithoutBox(lv));
});

test("hasGoalWithoutBox: 全盖 → false", () => {
  const lv = parse(["#####", "#*$ #", "#####"]);
  assert.ok(!hasGoalWithoutBox(lv));
});

test("applyMove: 向空地板移动 → 人物移动，moved=true", () => {
  const lv = parse(LVL1);
  const { level, moved } = applyMove(lv, 0, 1); // 下
  assert.ok(moved);
  assert.equal(level.player.x, 2);
  assert.equal(level.player.y, 3);
});

test("applyMove: 撞墙 → moved=false 不动", () => {
  const lv = parse(["#@#", "# #", "###"]); // 玩家(1,0)，上方越界/下方地板，左墙右墙
  const { level, moved } = applyMove(lv, 1, 0); // 右撞墙
  assert.ok(!moved);
  assert.equal(level, lv); // 同引用（未克隆）
  assert.equal(level.player.x, 1);
});

test("applyMove: 越界 → moved=false", () => {
  const lv = parse(["#@", "##"]); // 玩家在 (1,0)，右侧越界
  const { moved } = applyMove(lv, 1, 0);
  assert.ok(!moved);
});

test("applyMove: 推箱到空地板 → 箱移动+人移动", () => {
  const lv = parse(LVL1); // 人(2,2) 箱(3,2) 右侧(4,2)=目标
  const { level, moved } = applyMove(lv, 1, 0); // 右推
  assert.ok(moved);
  assert.ok(!level.boxes[2]![3]); // 原箱位空
  assert.ok(level.boxes[2]![4]); // 箱推到目标
  assert.equal(level.player.x, 3);
  assert.equal(level.player.y, 2);
});

test("applyMove: 推箱上箱后箱 → moved=false 不动", () => {
  // 人(1,1) 箱(2,1) 箱(3,1) 同行相邻；向右推 → (3,1) 有箱 → 不动
  const raw = ["#######", "#@$$ #", "#######"];
  const lv = parse(raw);
  const { moved } = applyMove(lv, 1, 0);
  assert.ok(!moved);
});

test("applyMove: 推箱到墙 → moved=false", () => {
  const raw = ["#####", "#$@ #", "#####"]; // 箱(1,1) 人(2,1)，向左推 → (0,1) 是墙
  const lv = parse(raw);
  const { moved } = applyMove(lv, -1, 0);
  assert.ok(!moved);
});

test("applyMove: 推箱越界 → moved=false", () => {
  const raw = ["##", "#$", " #"]; // 箱(1,1) 下方越界
  const lv = parse(raw);
  const { moved } = applyMove(lv, 0, 1);
  assert.ok(!moved);
});

test("applyMove: 不修改原 level（纯函数不可变）", () => {
  const lv = parse(LVL1);
  const origPx = lv.player.x;
  applyMove(lv, 1, 0); // 推箱
  assert.equal(lv.player.x, origPx); // 原 level 不变
  assert.ok(lv.boxes[2]![3]); // 原箱仍在
});

test("applyMove: 推箱就位后 isWin=true（端到端）", () => {
  const lv = parse(LVL1);
  const next = applyMove(lv, 1, 0).level; // 推箱到目标
  assert.ok(isWin(next));
});

test("applyMove: 连续移动保可解性（推箱通关路径）", () => {
  // 关卡 1：人(2,2) 右推箱到目标(4,2) 即通关
  let lv = parse(LVL1);
  lv = applyMove(lv, 1, 0).level;
  assert.ok(isWin(lv));
});
