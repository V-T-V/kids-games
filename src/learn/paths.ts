/**
 * 学习路径定义 —— 把现有游戏组织成由浅入深的渐进学习序列。
 *
 * 设计：
 * - 5 条路径，按年龄/难度递进：启蒙认知（3-4）→ 文字语言（4-6）→ 数学思维（4-6）→ 科学常识（5-6）→ 综合复习（全年龄）。
 * - 每条路径是有序 game id 列表，游戏全部来自 registry（不新增游戏）。
 * - 完成度由现有 save.progress[id].cleared 派生（pathProgress），无需新存储。
 * - 路径内游戏全开放 + 按序推荐（不强锁关，3-6 岁卡关会挫败）。
 *
 * 这是学习内容编排的唯一事实源：学习中心、路径详情页、大厅入口都从 LEARN_PATHS 派生。
 */
import type { GameId, SaveData } from "../types.ts";

/** 一条学习路径。 */
export interface LearnPath {
  /** 路径 id（路由用，如 learn/cognition） */
  id: "cognition" | "literacy" | "math" | "science" | "review";
  /** 阶段顺序（1-5，学习中心按此排序） */
  stage: number;
  /** 大标题 */
  title: string;
  /** emoji 图标 */
  icon: string;
  /** 给家长的教育内核说明 */
  subtitle: string;
  /** 卡片主题色（CSS 变量键名） */
  themeVar: string;
  /** 适龄范围文案 */
  ageRange: string;
  /** 有序游戏 id（由浅入深） */
  games: GameId[];
}

/** 全部学习路径（按 stage 升序）。 */
export const LEARN_PATHS: readonly LearnPath[] = [
  {
    id: "cognition",
    stage: 1,
    title: "启蒙认知",
    icon: "🎨",
    subtitle: "颜色、形状、大小、配对——认识世界的基础",
    themeVar: "--c-pink",
    ageRange: "3-4 岁",
    games: [
      "color-find",
      "shape-find",
      "big-small",
      "size-sort",
      "color-sort",
      "ant-march",
      "laundry",
      "egg-hatch",
      "balance",
      "color-mixer",
    ],
  },
  {
    id: "literacy",
    stage: 2,
    title: "文字语言",
    icon: "📖",
    subtitle: "字母、拼音、汉字、古诗——从认字到阅读",
    themeVar: "--c-blue",
    ageRange: "4-6 岁",
    games: [
      "letter-bee",
      "upper-lower",
      "pinyin",
      "picture-word",
      "radical",
      "measure-word",
      "antonym",
      "word-chain",
      "classical-poem",
      "tang-sanbai",
    ],
  },
  {
    id: "math",
    stage: 3,
    title: "数学思维",
    icon: "🔢",
    subtitle: "计数、运算、数序、货币——建立数感与运算",
    themeVar: "--c-green",
    ageRange: "4-6 岁",
    games: [
      "count-finger",
      "number-monster",
      "knock-blocks",
      "connect-dots",
      "farm-math",
      "bubble-pop-math",
      "missing-number",
      "money",
      "grocery-store",
      "bead-abacus",
    ],
  },
  {
    id: "science",
    stage: 4,
    title: "科学常识",
    icon: "🔬",
    subtitle: "自然、天文、生物、物理——探索身边的世界",
    themeVar: "--c-purple",
    ageRange: "5-6 岁",
    games: [
      "seasons-match",
      "water-cycle",
      "bird-watch",
      "constellation",
      "moon-phase",
      "ecosystem",
      "plant-grow",
      "lever-balance",
      "ramp-roll",
      "weather-forecast",
    ],
  },
  {
    id: "review",
    stage: 5,
    title: "综合复习",
    icon: "🏆",
    subtitle: "跨领域混合挑战，巩固已学、查漏补缺",
    themeVar: "--c-orange",
    ageRange: "3-6 岁",
    games: [
      "color-mixer",
      "memory-flip",
      "letter-bee",
      "number-monster",
      "jigsaw",
      "classical-poem",
      "connect-dots",
      "water-cycle",
      "money",
      "ecosystem",
    ],
  },
];

/** 路径 id → 路径 的索引（O(1) 查找）。 */
const PATH_MAP: ReadonlyMap<string, LearnPath> = new Map(
  LEARN_PATHS.map((p) => [p.id, p]),
);

/** 按 id 查路径；不存在返回 undefined。 */
export function findPath(id: string): LearnPath | undefined {
  return PATH_MAP.get(id);
}

/** 路径完成度：已通关游戏数 / 总游戏数。 */
export function pathClearedCount(path: LearnPath, save: SaveData): number {
  return path.games.filter((id) => save.progress[id]?.cleared).length;
}

/** 路径是否全部通关。 */
export function isPathComplete(path: LearnPath, save: SaveData): boolean {
  return pathClearedCount(path, save) >= path.games.length;
}

/** 全部路径的总进度：去重后的游戏通关数 / 去重后的总游戏数。 */
export function learnOverallProgress(save: SaveData): {
  cleared: number;
  total: number;
} {
  const allIds = new Set<string>();
  for (const path of LEARN_PATHS) {
    for (const gid of path.games) allIds.add(gid as string);
  }
  let cleared = 0;
  for (const id of allIds) {
    if (save.progress[id as GameId]?.cleared) cleared += 1;
  }
  return { cleared, total: allIds.size };
}
