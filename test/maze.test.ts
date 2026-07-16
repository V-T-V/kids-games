/**
 * 迷宫生成测试。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateMaze,
  scatterStars,
} from "../src/games/maze-adventure/maze.ts";

test("generateMaze: 尺寸正确", () => {
  const g = generateMaze(5, 5);
  assert.equal(g.length, 5);
  assert.equal(g[0]!.length, 5);
});

test("generateMaze: 边界墙完整（外墙都在）", () => {
  const g = generateMaze(4, 4);
  // 顶行格子都有 top 墙
  for (const cell of g[0]!) assert.ok(cell.top, "顶行应有上墙");
  // 底行格子都有 bottom 墙
  for (const cell of g[g.length - 1]!) assert.ok(cell.bottom, "底行应有下墙");
  // 最左列都有 left 墙
  for (const row of g) assert.ok(row[0]!.left, "左列应有左墙");
  // 最右列都有 right 墙
  for (const row of g) assert.ok(row[row.length - 1]!.right, "右列应有右墙");
});

test("generateMaze: 所有格子都被访问过", () => {
  const g = generateMaze(6, 4);
  for (const row of g) {
    for (const cell of row) {
      assert.ok(cell.visited, `(${cell.x},${cell.y}) 应被访问`);
    }
  }
});

test("generateMaze: 从起点可连通到终点（墙的对偶性）", () => {
  const cols = 5,
    rows = 5;
  const g = generateMaze(cols, rows);
  // BFS：相邻且无墙则连通
  const visited = new Set<string>();
  const queue = [{ x: 0, y: 0 }];
  visited.add("0,0");
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    const c = g[y]![x]!;
    const neighbors: { x: number; y: number; wall: boolean }[] = [
      { x, y: y - 1, wall: c.top },
      { x: x + 1, y, wall: c.right },
      { x, y: y + 1, wall: c.bottom },
      { x: x - 1, y, wall: c.left },
    ];
    for (const n of neighbors) {
      if (n.wall) continue;
      if (n.x < 0 || n.x >= cols || n.y < 0 || n.y >= rows) continue;
      const key = `${n.x},${n.y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: n.x, y: n.y });
    }
  }
  assert.ok(visited.has(`${cols - 1},${rows - 1}`), "起点应能连通到终点");
});

test("scatterStars: 数量不超过请求值且不落在起点终点", () => {
  const g = generateMaze(6, 6);
  const stars = scatterStars(g, 6, 6, 5);
  assert.ok(stars.length <= 5);
  for (const s of stars) {
    assert.ok(!(s.x === 0 && s.y === 0), "不应在起点");
    assert.ok(!(s.x === 5 && s.y === 5), "不应在终点");
  }
});

test("scatterStars: 坐标不重复", () => {
  const g = generateMaze(8, 8);
  const stars = scatterStars(g, 8, 8, 10);
  const set = new Set(stars.map((s) => `${s.x},${s.y}`));
  assert.equal(set.size, stars.length);
});
