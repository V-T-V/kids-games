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

test("游戏契约: unmount 不重复调用同一解绑语句（防 color-sort 式重复 unbind 回归）", () => {
  // 扫描每个游戏的 unmount 方法体，检查是否存在「同一句 cleanup 连续出现两次」。
  // 曾有 bug：color-sort 的 unmount 把 this.unbinds.forEach((u) => u()) 写了两遍。
  // 解绑函数虽通常幂等，但重复调用是明确代码冗余/笔误，应零容忍。
  const bad: string[] = [];
  for (const g of listGames()) {
    // 提取每个 unmount() { ... } 方法体（非贪婪到下一个 }）
    const methodMatches = [...g.src.matchAll(/unmount\s*\(\s*\)\s*:\s*void\s*\{([\s\S]*?)\n\s*\}/g)];
    for (const m of methodMatches) {
      const body = m[1] ?? "";
      const lines = body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      // 找连续相同的非空语句行
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === lines[i - 1] && !lines[i]!.startsWith("//")) {
          bad.push(`${g.dir}: unmount 重复语句「${lines[i]}」`);
        }
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `以下游戏的 unmount 存在重复解绑语句（笔误）：\n${bad.join("\n")}`,
  );
});

test("游戏契约: pipe-connect 修复回归——rotate 结算期间锁定防 roundsDone 重复累加", () => {
  // 曾有 bug：pipe-connect 的 rotate() 在全部管道连通后进入 1200ms 水流动画
  // （trackTimeout 回调里才 finishClear/startRound），但动画期间玩家可继续点击管道，
  // 若无 locked 守卫，连通状态被再次满足 → roundsDone 被重复累加 → 一轮可计多次。
  // 守护：pipe-connect 必须有 locked 字段 + rotate() 入口守卫 + 进入结算前置 true。
  const pipe = listGames().find((g) => g.dir === "pipe-connect");
  assert.ok(pipe, "pipe-connect 游戏应存在");
  const src = pipe!.src;
  assert.match(
    src,
    /private\s+locked\s*[:=]/,
    "pipe-connect 必须声明 locked 字段",
  );
  assert.match(
    src,
    /rotate\s*\([^)]*\)\s*:\s*void\s*\{[\s\S]*?if\s*\(\s*this\.locked\s*\)\s*return/,
    "pipe-connect.rotate() 必须在入口检查 this.locked 早返回",
  );
  assert.match(
    src,
    /this\.locked\s*=\s*true/,
    "pipe-connect 进入结算动画前必须置 this.locked = true",
  );
  assert.match(
    src,
    /this\.locked\s*=\s*false/,
    "pipe-connect.startRound() 必须重置 this.locked = false 以开新一轮",
  );
});

test("游戏契约: reverse-memory 修复回归——完成倒序后结算期间锁定防误触 onWrong", () => {
  // 曾有 bug：reverse-memory 的 click() 完成倒序（revStep>=seq.length）后进入 1000ms 结算
  // （trackTimeout 回调里才 finishClear/startRound），但期间 animating=false 且无 locked 守卫，
  // 玩家继续点击 → expectIdx=seq.length-1-seq.length=-1 → expected=undefined → 必进 else 分支
  // 误触 onWrong（虚增 wrongCount 压低星数）+ 可能弹休息浮层与 startRound 冲突。
  // 守护：reverse-memory 必须有 locked 字段 + click() 入口守卫 + 完成倒序前置 true + startRound 重置 false。
  const rm = listGames().find((g) => g.dir === "reverse-memory");
  assert.ok(rm, "reverse-memory 游戏应存在");
  const src = rm!.src;
  assert.match(
    src,
    /private\s+locked\s*[:=]/,
    "reverse-memory 必须声明 locked 字段",
  );
  assert.match(
    src,
    /click\s*\([^)]*\)\s*:\s*void\s*\{[\s\S]*?if\s*\(\s*this\.animating\s*\|\|\s*this\.locked\s*\)\s*return/,
    "reverse-memory.click() 必须在入口检查 this.locked 早返回",
  );
  assert.match(
    src,
    /this\.revStep\s*>=\s*this\.seq\.length[\s\S]*?this\.locked\s*=\s*true/,
    "reverse-memory 完成倒序（revStep>=seq.length）后必须置 this.locked = true",
  );
  assert.match(
    src,
    /startRound\s*\([^)]*\)\s*:\s*void\s*\{[\s\S]*?this\.locked\s*=\s*false/,
    "reverse-memory.startRound() 必须重置 this.locked = false 以开新一轮",
  );
});

test("游戏契约: color-reaction 修复回归——结算期间防重入 startRound 防 DOM 卡住", () => {
  // 曾有 bug：color-reaction 的正确点击进入 900ms 结算（trackTimeout 回调里才
  // finishClear/startRound），但期间无锁守卫，玩家快速点击其它正确色块会再次触发
  // roundsDone += 1 并再次进入同一回调链；更糟的是回调内直接 startRound() 重建 DOM，
  // 若上一轮 DOM 尚未稳定又被重建，会导致画面卡住、按钮错位、轮次计数错乱。
  // 守护：color-reaction 必须有 roundTransitioning 字段 + startRound() 入口守卫
  // + 进入结算前置 true + 回调内 startRound 前重置 false（同款 locked 守卫模式）。
  const g = listGames().find((x) => x.dir === "color-reaction");
  assert.ok(g, "color-reaction 游戏应存在");
  const src = g!.src;
  assert.match(
    src,
    /roundTransitioning\s*[:=]/,
    "color-reaction 必须声明 roundTransitioning 字段",
  );
  assert.match(
    src,
    /startRound\s*\([^)]*\)\s*:\s*void\s*\{[\s\S]*?if\s*\(\s*this\.roundTransitioning\s*\)\s*return/,
    "color-reaction.startRound() 必须在入口检查 this.roundTransitioning 早返回",
  );
  assert.match(
    src,
    /this\.roundTransitioning\s*=\s*true/,
    "color-reaction.startRound() 进入后必须立即置 this.roundTransitioning = true",
  );
  assert.match(
    src,
    /this\.roundTransitioning\s*=\s*false/,
    "color-reaction 结算回调内 startRound 前必须重置 this.roundTransitioning = false",
  );
});

test("游戏契约: weight-sort 修复回归——按 picked 序列递增排序不依赖 w 值连续", () => {
  // 曾有 bug：weight-sort 用 expected=this.picked[0].w 初始化后每答对一个 expected += 1，
  // 但 ANIMALS 经 shuffle().slice(0, count) 后 w 值并不一定连续
  // （例：shuffle 取前 4 得 w=[1,3,5,6]，expected 走 1→2 时永远答不对第二个 w=3）。
  // 守护：weight-sort 必须用 expectedIdx 跟踪 picked 索引，按 picked[expectedIdx].w
  // 推进，而不是 expected+1。
  const g = listGames().find((x) => x.dir === "weight-sort");
  assert.ok(g, "weight-sort 游戏应存在");
  const src = g!.src;
  assert.match(
    src,
    /expectedIdx\s*[=:]?\s*0/,
    "weight-sort 必须声明 expectedIdx 字段并在 startRound 初始化为 0",
  );
  assert.match(
    src,
    /this\.expected\s*=\s*this\.picked\[this\.expectedIdx\]/,
    "weight-sort expected 必须取自 this.picked[this.expectedIdx]，不能写死 +1",
  );
  assert.match(
    src,
    /this\.expectedIdx\s*>=\s*this\.picked\.length/,
    "weight-sort 完成判定必须基于 expectedIdx 达到 picked.length，不能写死固定数",
  );
  assert.doesNotMatch(
    src,
    /this\.expected\s*\+=\s*1/,
    "weight-sort 不得再用 this.expected += 1 推进（w 值非连续会卡关）",
  );
});
