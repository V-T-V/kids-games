// 游戏注册表是内容规模的唯一事实来源，锁住产品化运营所需的基础一致性。
import { test } from "node:test";
import assert from "node:assert/strict";
import { GAMES, GAME_IDS, findGame } from "../src/games/registry.ts";

test("registry: 当前产品内容规模为 81 个游戏", () => {
  assert.equal(GAMES.length, 81);
  assert.equal(GAME_IDS.length, 81);
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
