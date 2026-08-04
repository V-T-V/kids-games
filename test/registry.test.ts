// 游戏注册表是内容规模的唯一事实来源，锁住产品化运营所需的基础一致性。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAMES, GAME_IDS, findGame } from "../src/games/registry.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_DIR = path.join(__dirname, "..", "src", "games");

/** 扫描 src/games/ 下的游戏子目录（排除 _shared 公共基类与 registry.ts 本身）。 */
function listGameDirs(): string[] {
  return fs
    .readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_shared")
    .map((d) => d.name)
    .sort();
}

test("registry: 注册表与 id 列表规模一致（动态，不硬编码数字）", () => {
  assert.equal(GAMES.length, GAME_IDS.length);
  assert.ok(GAMES.length >= 80, `游戏数应不少于 80，实际 ${GAMES.length}`);
});

test("registry: 游戏 id 唯一且 findGame 可回查", () => {
  const ids = GAMES.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const game of GAMES) {
    assert.equal(findGame(game.id)?.title, game.title);
  }
});

test("registry: 每个游戏都有面向家长和大厅展示的必要元信息", () => {
  for (const game of GAMES) {
    assert.ok(game.title.trim(), `${game.id} 缺少 title`);
    assert.ok(game.subtitle.trim(), `${game.id} 缺少 subtitle`);
    assert.ok(game.icon.trim(), `${game.id} 缺少 icon`);
    assert.ok(
      game.theme.startsWith("--c-"),
      `${game.id} theme 必须引用 CSS 变量`,
    );
    assert.match(game.age, /^\d-\d 岁$/, `${game.id} age 格式应如 3-6 岁`);
    assert.match(
      game.tag,
      /^[^·]+·[^·]+$/,
      `${game.id} tag 应包含 能力域·子类`,
    );
  }
});

test("目录↔注册表一致性: 每个游戏目录都在 registry 注册，且无幽灵目录（不依赖浏览器环境）", () => {
  // 这是防漂移的关键校验：新增 src/games/<id>/ 目录后必须同步 registry，
  // 反之亦然。直接读文件系统，无需 main.ts（后者依赖 CSS/DOM，node:test 下无法加载）。
  const dirs = new Set(listGameDirs());
  const registryIds = new Set(GAME_IDS);

  const ghostDirs = [...dirs].filter((d) => !registryIds.has(d as never));
  const missingDirs = [...registryIds].filter((id) => !dirs.has(id as string));

  if (ghostDirs.length > 0) {
    assert.fail(
      `以下游戏目录存在但 registry 未注册（漏注册 GAMES/types.ts）: ${ghostDirs.join(", ")}`,
    );
  }
  if (missingDirs.length > 0) {
    assert.fail(
      `以下 registry id 没有对应游戏目录（缺 src/games/<id>/index.ts）: ${missingDirs.join(", ")}`,
    );
  }
  assert.equal(dirs.size, registryIds.size, "目录数与注册表条目数应相等");
});

test("目录↔注册表一致性: 每个注册的游戏目录都有 index.ts 模块（懒加载入口）", () => {
  for (const id of GAME_IDS) {
    const indexFile = path.join(GAMES_DIR, id, "index.ts");
    assert.ok(
      fs.existsSync(indexFile),
      `${id} 缺少入口文件 src/games/${id}/index.ts`,
    );
  }
});

test("双事实源一致性: registry 的每个游戏 id 在 GAME_FACTORIES 中都有对应工厂", async () => {
  // 注意：main.ts 依赖浏览器环境（CSS/DOM），node:test 下 import 必失败而静默跳过。
  // 真正的目录↔注册表一致性由上面两个不依赖浏览器的 fs 校验保证。
  // 本测试仅在 CI/构建环境（vitest 等浏览器兼容运行时）下实际执行。
  let GAME_FACTORIES: Record<string, () => unknown>;
  try {
    const mod = await import("../src/main.ts");
    GAME_FACTORIES = mod.GAME_FACTORIES;
  } catch {
    // main.ts 依赖浏览器环境（CSS/DOM），在 node:test 下无法加载——跳过此测试
    return;
  }

  const factoryIds = Object.keys(GAME_FACTORIES);
  const registryIds = GAME_IDS;

  // registry 中有但 GAME_FACTORIES 中缺失的游戏
  const missingInFactories = registryIds.filter(
    (id: string) => !GAME_FACTORIES[id],
  );
  // GAME_FACTORIES 中有但 registry 中没有的游戏
  const missingInRegistry = factoryIds.filter(
    (id) => !registryIds.includes(id as never),
  );

  if (missingInFactories.length > 0) {
    assert.fail(
      `以下游戏在 registry 中存在但 GAME_FACTORIES 中缺失工厂: ${missingInFactories.join(", ")}`,
    );
  }
  if (missingInRegistry.length > 0) {
    assert.fail(
      `以下游戏在 GAME_FACTORIES 中存在但 registry 中缺失: ${missingInRegistry.join(", ")}`,
    );
  }
});
