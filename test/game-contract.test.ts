// 游戏结构契约静态校验 —— 零依赖（纯 fs + 正则），锁定项目硬约定，防回归：
//   1. 每个 index.ts 都 export 一个 create()（懒加载入口，main.ts 经 import.meta.glob 收集）
//   2. 每个游戏类 extends BaseGame 或公共基类（StepOrderGame / CycleFlowGame）
//   3. <前缀>-style 的 style id 在所有游戏间全局唯一（项目约定：CSS 前缀全局唯一，防样式污染）
//
// 这些是纯文本静态检查，不需要 DOM/浏览器，可在 node:test 下秒级跑完，覆盖全部 575 游戏。
// 与 e2e（需浏览器、慢、受 Vite 冷启动影响）互补：这里守"结构契约"，e2e 守"运行时挂载"。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_DIR = path.join(__dirname, "..", "src", "games");

/** 扫描 src/games/ 下的游戏子目录（排除 _shared 公共基类与 registry.ts）。 */
function listGames(): { dir: string; src: string }[] {
  return fs
    .readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_shared")
    .map((d) => {
      const file = path.join(GAMES_DIR, d.name, "index.ts");
      return { dir: d.name, src: fs.readFileSync(file, "utf8") };
    })
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/** BaseGame 及其公共派生基类——extends 任一即满足"是 BaseGame 子类"契约。 */
const VALID_BASES = new Set(["BaseGame", "StepOrderGame", "CycleFlowGame"]);

test("游戏契约: 每个游戏都导出 create() 函数（懒加载入口）", () => {
  const missing = listGames()
    .filter((g) => !/export\s+function\s+create\s*\(/.test(g.src))
    .map((g) => g.dir);
  assert.deepEqual(
    missing,
    [],
    `以下游戏缺少 export function create()：${missing.join(", ")}`,
  );
});

test("游戏契约: 每个游戏类都 extends BaseGame 或公共基类", () => {
  const bad = listGames()
    .map((g) => {
      const m = g.src.match(/class\s+\w+\s+extends\s+(\w+)/);
      return { dir: g.dir, base: m ? m[1]! : null };
    })
    .filter((g) => g.base === null || !VALID_BASES.has(g.base));
  assert.deepEqual(
    bad.map((b) => `${b.dir}(extends ${b.base ?? "?"})`),
    [],
    `以下游戏未 extends BaseGame/StepOrderGame/CycleFlowGame：${bad
      .map((b) => b.dir)
      .join(", ")}`,
  );
});

test("游戏契约: style id 前缀（<prefix>-style）全局唯一，无样式污染", () => {
  const games = listGames();
  // 收集 prefix -> [games]，只认字符串字面量 "xx-style"（最可靠的 style 标签 id 声明）
  const prefixGames = new Map<string, string[]>();
  for (const g of games) {
    const ids = [...g.src.matchAll(/["'`]([a-z0-9]+)-style["'`]/g)].map(
      (m) => m[1]!,
    );
    for (const id of new Set(ids)) {
      const arr = prefixGames.get(id) ?? [];
      arr.push(g.dir);
      prefixGames.set(id, arr);
    }
  }
  const conflicts = [...prefixGames.entries()].filter(
    ([, gs]) => gs.length > 1,
  );
  assert.deepEqual(
    conflicts,
    [],
    `以下 style-id 前缀被多个游戏共用（违反 CSS 前缀全局唯一约定）：\n` +
      conflicts.map(([p, gs]) => `  ${p}-style: ${gs.join(", ")}`).join("\n"),
  );
});
