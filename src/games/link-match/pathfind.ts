/**
 * 连连看路径检测 —— 两点是否可经「最多 2 个拐弯」连通。
 *
 * 经典连连看规则：路径只能水平/垂直走，且最多 2 次 90° 转弯。
 * grid 外围视为空通道（绕外圈也算合法路径）。
 * 纯函数，便于单元测试。
 */

export type Cell = string; // '' 空，其它=图案 id

/** 网格尺寸（行 x 列），grid[y][x]。 */
export function canConnect(
  grid: Cell[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { ok: boolean; corners: [number, number][] } {
  if (x1 === x2 && y1 === y2) return { ok: false, corners: [] };
  if (grid[y1]![x1] !== grid[y2]![x2]) return { ok: false, corners: [] };
  const rows = grid.length;
  const cols = grid[0]!.length;

  // 起终点本身视为「可通行」（不阻挡自己）
  const start = grid[y1]![x1]!;
  const end = grid[y2]![x2]!;
  grid[y1]![x1] = "";
  grid[y2]![x2] = "";

  // 判断两点之间能否直线连通（无阻挡，含外围一圈）
  // 我们把坐标扩展：允许 x∈[-1,cols], y∈[-1,rows]
  const clear = (x: number, y: number): boolean => {
    if (x < -1 || x > cols || y < -1 || y > rows) return false;
    if (x === -1 || x === cols || y === -1 || y === rows) return true; // 外围通道
    return grid[y]![x] === "";
  };

  // 直线
  const lineClear = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): boolean => {
    if (ax === bx) {
      const lo = Math.min(ay, by),
        hi = Math.max(ay, by);
      for (let y = lo + 1; y < hi; y++) if (!clear(ax, y)) return false;
      return true;
    }
    if (ay === by) {
      const lo = Math.min(ax, bx),
        hi = Math.max(ax, bx);
      for (let x = lo + 1; x < hi; x++) if (!clear(x, ay)) return false;
      return true;
    }
    return false;
  };

  // 0 拐弯
  if ((x1 === x2 || y1 === y2) && lineClear(x1, y1, x2, y2)) {
    grid[y1]![x1] = start;
    grid[y2]![x2] = end;
    return { ok: true, corners: [] };
  }
  // 1 拐弯：两个 L 形拐点
  const corners1: [number, number][] = [
    [x2, y1],
    [x1, y2],
  ];
  for (const [cx, cy] of corners1) {
    if (
      clear(cx, cy) &&
      lineClear(x1, y1, cx, cy) &&
      lineClear(cx, cy, x2, y2)
    ) {
      grid[y1]![x1] = start;
      grid[y2]![x2] = end;
      return { ok: true, corners: [[cx, cy]] };
    }
  }
  // 2 拐弯：在某个 x 列或某行做桥
  // 沿 x 方向找桥列
  for (let bx = -1; bx <= cols; bx++) {
    if (bx === x1 || bx === x2) continue;
    // 拐点 (bx,y1) 和 (bx,y2)
    if (
      clear(bx, y1) &&
      clear(bx, y2) &&
      lineClear(x1, y1, bx, y1) &&
      lineClear(bx, y1, bx, y2) &&
      lineClear(bx, y2, x2, y2)
    ) {
      grid[y1]![x1] = start;
      grid[y2]![x2] = end;
      return {
        ok: true,
        corners: [
          [bx, y1],
          [bx, y2],
        ],
      };
    }
  }
  // 沿 y 方向找桥行
  for (let by = -1; by <= rows; by++) {
    if (by === y1 || by === y2) continue;
    if (
      clear(x1, by) &&
      clear(x2, by) &&
      lineClear(x1, y1, x1, by) &&
      lineClear(x1, by, x2, by) &&
      lineClear(x2, by, x2, y2)
    ) {
      grid[y1]![x1] = start;
      grid[y2]![x2] = end;
      return {
        ok: true,
        corners: [
          [x1, by],
          [x2, by],
        ],
      };
    }
  }

  grid[y1]![x1] = start;
  grid[y2]![x2] = end;
  return { ok: false, corners: [] };
}
