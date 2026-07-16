import { test } from "node:test";
import assert from "node:assert/strict";
import { GAMES } from "../src/games/registry.ts";
import {
  discoveryMeta,
  filterGames,
  parseAgeRange,
  type LobbyFilters,
} from "../src/lobby/contentFilters.ts";

const baseProgress = Object.fromEntries(
  GAMES.map((game) => [game.id, { cleared: false }]),
) as Record<string, { cleared: boolean }>;

function filters(overrides: Partial<LobbyFilters> = {}): LobbyFilters {
  return {
    category: "全部",
    completion: "all",
    age: "all",
    duration: "all",
    searchTerm: "",
    ...overrides,
  };
}

test("lobby filters: 解析年龄段并容错", () => {
  assert.deepEqual(parseAgeRange("3-6 岁"), [3, 6]);
  assert.deepEqual(parseAgeRange("bad"), [3, 6]);
});

test("lobby filters: 年龄筛选只返回覆盖该年龄的游戏", () => {
  const shown = filterGames(GAMES, baseProgress, filters({ age: "3" }));

  assert.ok(shown.length > 0);
  assert.ok(
    shown.every((game) => {
      const meta = discoveryMeta(game);
      return meta.ageMin <= 3 && meta.ageMax >= 3;
    }),
  );
  assert.ok(shown.every((game) => !game.age.startsWith("5-")));
});

test("lobby filters: 时长筛选按运营估算区间生效", () => {
  const shortGames = filterGames(
    GAMES,
    baseProgress,
    filters({ duration: "short" }),
  );
  const longGames = filterGames(
    GAMES,
    baseProgress,
    filters({ duration: "long" }),
  );

  assert.ok(shortGames.length > 0);
  assert.ok(longGames.length > 0);
  assert.ok(
    shortGames.every((game) => discoveryMeta(game).estimatedMinutes <= 5),
  );
  assert.ok(
    longGames.every((game) => discoveryMeta(game).estimatedMinutes > 8),
  );
});

test("lobby filters: 能力域、状态和搜索条件可以组合", () => {
  const progress = {
    ...baseProgress,
    [GAMES[0]!.id]: { cleared: true },
  };

  assert.deepEqual(
    filterGames(
      GAMES,
      progress,
      filters({ category: "认知", completion: "cleared", searchTerm: "3-6" }),
    ).map((game) => game.id),
    [GAMES[0]!.id],
  );
});
