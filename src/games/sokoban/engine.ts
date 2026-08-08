/* sokoban/engine.ts —— 推箱子纯逻辑（与 DOM 解耦）。
   关卡用字符串数组定义：#墙 空格=地板 .目标 $箱子 *箱在目标上 @人物 +人在目标上。
   提取自 index.ts 的 parse/isWin/move 规则，便于直接单元测试。 */

/** 单元格类型：墙 / 目标点 / 地板。箱子与人物位置单独维护。 */
export type Cell = "#" | "." | " ";

/** 关卡结构化数据（parse 产物）。 */
export interface Level {
  cells: Cell[][];
  /** 玩家当前坐标。 */
  player: { x: number; y: number };
  /** boxes[y][x] = 该格是否有箱子。 */
  boxes: boolean[][];
  /** goals[y][x] = 该格是否为目标点。 */
  goals: boolean[][];
  w: number;
  h: number;
}

/** 把字符串关卡解析成结构化数据。与 index.ts 行为一致：
 *  - 行长度不齐时按最长行补地板（越界字符按空格处理）。
 *  - #墙 / .目标 / $箱 / *箱在目标 / @人 / +人在目标。 */
export function parse(raw: string[]): Level {
  const rows = raw;
  const h = rows.length;
  const w = Math.max(...rows.map((r: string) => r.length));
  const cells: Cell[][] = [];
  const boxes: boolean[][] = [];
  const goals: boolean[][] = [];
  let player = { x: 1, y: 1 };
  for (let y = 0; y < h; y++) {
    const row = rows[y]!;
    cells.push([]);
    boxes.push([]);
    goals.push([]);
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? " ";
      let cell: Cell = " ";
      let box = false;
      let goal = false;
      switch (ch) {
        case "#":
          cell = "#";
          break;
        case ".":
          cell = ".";
          goal = true;
          break;
        case "$":
          cell = " ";
          box = true;
          break;
        case "*":
          cell = ".";
          box = true;
          goal = true;
          break;
        case "@":
          cell = " ";
          player = { x, y };
          break;
        case "+":
          cell = ".";
          goal = true;
          player = { x, y };
          break;
        default:
          cell = " ";
      }
      cells[y]!.push(cell);
      boxes[y]!.push(box);
      goals[y]!.push(goal);
    }
  }
  return { cells, player, boxes, goals, w, h };
}

/** 判定是否通关：所有目标格都被箱子覆盖。 */
export function isWin(level: Level): boolean {
  const { goals, boxes, w, h } = level;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (goals[y]![x]! && !boxes[y]![x]!) return false;
    }
  }
  return true;
}

/** 尝试朝 (dx,dy) 移动一步（不修改原 level，返回新 level 与是否实际移动）。
 *  规则与 index.ts 的 move 一致：
 *  - 越界 / 撞墙 → 不动。
 *  - 目标格有箱：尝试把箱推到 (nx+dx, ny+dy)；若该格越界/是墙/已有箱 → 不动。
 *  - 否则人物移动到目标格（可能连带推箱）。
 *  返回 { level, moved }，moved=false 时 level 与入参引用相同（未克隆）。 */
export function applyMove(
  level: Level,
  dx: number,
  dy: number,
): { level: Level; moved: boolean } {
  const { w, h } = level;
  const nx = level.player.x + dx;
  const ny = level.player.y + dy;
  if (nx < 0 || ny < 0 || nx >= w || ny >= h) return { level, moved: false };
  const target = level.cells[ny]![nx]!;
  if (target === "#") return { level, moved: false };
  // 深拷贝（仅在确认会移动后才复制）
  const cells = level.cells.map((r) => r.slice());
  const boxes = level.boxes.map((r) => r.slice());
  const goals = level.goals.map((r) => r.slice());
  const player = { ...level.player };
  if (boxes[ny]![nx]!) {
    const bx = nx + dx;
    const by = ny + dy;
    if (bx < 0 || by < 0 || bx >= w || by >= h) return { level, moved: false };
    if (cells[by]![bx]! === "#") return { level, moved: false };
    if (boxes[by]![bx]!) return { level, moved: false }; // 后面也有箱子
    // 推动
    boxes[ny]![nx] = false;
    boxes[by]![bx] = true;
  }
  player.x = nx;
  player.y = ny;
  return {
    level: { cells, boxes, goals, player, w, h },
    moved: true,
  };
}

/** 是否仍有未完成的目标（用于判定关卡是否已解的反向）。 */
export function hasGoalWithoutBox(level: Level): boolean {
  const { goals, boxes, w, h } = level;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (goals[y]![x]! && !boxes[y]![x]!) return true;
    }
  }
  return false;
}
