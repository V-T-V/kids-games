/**
 * 成就系统 —— 分层成就体系（30 个成就，4 大类）。
 *
 * 设计：
 * - 【里程碑】通关数累计（1/5/10/20/40/全部 个游戏）
 * - 【品类】按游戏类型集齐（认知/数学/语言/科学/动作各通关 5 个）
 * - 【技能】特定高难表现（满星、困难通关、零失误等）
 * - 【隐藏】特殊条件触发的彩蛋成就
 *
 * 累计型成就由 checkMilestoneAchievements(save) 统一检测，
 * 在每次通关结算后调用，无需各游戏手动解锁。
 */

import type { SaveData } from "../types.ts";
import { ALL_GAME_IDS } from "./storage.ts";
import { LEARN_PATHS, isPathComplete } from "../learn/paths.ts";

export interface AchievementMeta {
  id: string;
  name: string;
  icon: string;
  /** 一句话描述如何解锁（家长面板/详情用）。 */
  hint: string;
  /** 成就分类（用于家长面板分组展示）。 */
  category: "milestone" | "category" | "skill" | "hidden";
  /** 是否为隐藏成就（隐藏的不在面板显示 hint，只显示 ???）。 */
  hidden?: boolean;
}

/** 全部成就。 */
export const ACHIEVEMENTS: readonly AchievementMeta[] = [
  // ===== 里程碑（通关数累计） =====
  {
    id: "first-clear",
    name: "初次通关",
    icon: "🌱",
    hint: "第一次完成任意一个游戏",
    category: "milestone",
  },
  {
    id: "cleared-5",
    name: "小试身手",
    icon: "🍃",
    hint: "通关 5 个不同的游戏",
    category: "milestone",
  },
  {
    id: "cleared-10",
    name: "渐入佳境",
    icon: "🌿",
    hint: "通关 10 个不同的游戏",
    category: "milestone",
  },
  {
    id: "cleared-20",
    name: "游戏达人",
    icon: "🌳",
    hint: "通关 20 个不同的游戏",
    category: "milestone",
  },
  {
    id: "cleared-40",
    name: "游戏专家",
    icon: "🏔️",
    hint: "通关 40 个不同的游戏",
    category: "milestone",
  },
  {
    id: "all-clear",
    name: "全勤小达人",
    icon: "🏆",
    hint: `通关全部 ${ALL_GAME_IDS.length} 个游戏`,
    category: "milestone",
  },

  // ===== 品类（按游戏类型集齐） =====
  {
    id: "cat-cognition",
    name: "认知小博士",
    icon: "🎓",
    hint: "通关 5 个「认知」类游戏",
    category: "category",
  },
  {
    id: "cat-math",
    name: "数学小天才",
    icon: "🔢",
    hint: "通关 5 个「数学」类游戏",
    category: "category",
  },
  {
    id: "cat-language",
    name: "语言小能手",
    icon: "📖",
    hint: "通关 5 个「语言」类游戏",
    category: "category",
  },
  {
    id: "cat-science",
    name: "科学小探索",
    icon: "🔬",
    hint: "通关 5 个「科学」类游戏",
    category: "category",
  },
  {
    id: "cat-action",
    name: "动作小健将",
    icon: "⚡",
    hint: "通关 5 个「动作/反应」类游戏",
    category: "category",
  },
  {
    id: "cat-social",
    name: "社交小达人",
    icon: "🤝",
    hint: "通关 5 个「社交」类游戏",
    category: "category",
  },
  {
    id: "cat-art",
    name: "艺术小明星",
    icon: "🎭",
    hint: "通关 5 个「艺术」类游戏",
    category: "category",
  },
  {
    id: "cat-life",
    name: "生活小能手",
    icon: "🏠",
    hint: "通关 5 个「生活」类游戏",
    category: "category",
  },

  // ===== 技能（特定高难表现） =====
  {
    id: "perfect-memory",
    name: "记忆大师",
    icon: "🧠",
    hint: "记忆翻翻乐·困难·零失误通关",
    category: "skill",
  },
  {
    id: "color-artist",
    name: "色彩艺术家",
    icon: "🎨",
    hint: "色彩调配师拿到 3 星",
    category: "skill",
  },
  {
    id: "star-collector",
    name: "星星收集控",
    icon: "⭐",
    hint: "走迷宫一次收集 8 颗星",
    category: "skill",
  },
  {
    id: "musician",
    name: "小小音乐家",
    icon: "🎵",
    hint: "完整弹出一首旋律",
    category: "skill",
  },
  {
    id: "three-star-5",
    name: "满星高手",
    icon: "✨",
    hint: "在 5 个游戏里都拿到 3 星",
    category: "skill",
  },
  {
    id: "three-star-15",
    name: "满星大师",
    icon: "🌟",
    hint: "在 15 个游戏里都拿到 3 星",
    category: "skill",
  },
  {
    id: "hard-clearer",
    name: "挑战自我",
    icon: "🔥",
    hint: "在困难难度下通关任意游戏",
    category: "skill",
  },
  {
    id: "hard-master",
    name: "困难征服者",
    icon: "💪",
    hint: "在困难难度下通关 10 个游戏",
    category: "skill",
  },
  {
    id: "no-mistake",
    name: "零失误",
    icon: "🎯",
    hint: "一局游戏里没有任何答错就通关",
    category: "skill",
  },

  // ===== 隐藏成就（彩蛋） =====
  {
    id: "explorer",
    name: "好奇心满满",
    icon: "🧭",
    hint: "通关 20 个不同的游戏",
    category: "hidden",
    hidden: true,
  },
  {
    id: "persistent",
    name: "坚持不懈",
    icon: "💧",
    hint: "同一个游戏通关 5 次",
    category: "hidden",
    hidden: true,
  },
  {
    id: "night-owl",
    name: "夜猫子",
    icon: "🌙",
    hint: "在晚上 9 点后玩游戏",
    category: "hidden",
    hidden: true,
  },
  {
    id: "early-bird",
    name: "早起鸟",
    icon: "🌅",
    hint: "在早上 7 点前玩游戏",
    category: "hidden",
    hidden: true,
  },
  {
    id: "speed-run",
    name: "风驰电掣",
    icon: "⚡",
    hint: "30 秒内通关一个游戏",
    category: "hidden",
    hidden: true,
  },
  {
    id: "comeback",
    name: "逆风翻盘",
    icon: "🔄",
    hint: "答错 3 次后成功通关",
    category: "hidden",
    hidden: true,
  },
  {
    id: "jack-of-all",
    name: "博学多才",
    icon: "🦉",
    hint: "在 4 个不同类别的游戏里都通关过",
    category: "hidden",
    hidden: true,
  },
  {
    id: "collector",
    name: "收藏家",
    icon: "📦",
    hint: "累计获得 50 颗星星",
    category: "hidden",
    hidden: true,
  },
  {
    id: "centurion",
    name: "百战不殆",
    icon: "💯",
    hint: "累计游玩 100 局",
    category: "hidden",
    hidden: true,
  },

  // ===== 学习路径（学完全部 5 条路径里的 N 条）=====
  {
    id: "path-cognition",
    name: "启蒙小学者",
    icon: "🎨",
    hint: "学完「启蒙认知」学习路径",
    category: "skill",
  },
  {
    id: "path-literacy",
    name: "识字小能手",
    icon: "📖",
    hint: "学完「文字语言」学习路径",
    category: "skill",
  },
  {
    id: "path-math",
    name: "数学小天才",
    icon: "🔢",
    hint: "学完「数学思维」学习路径",
    category: "skill",
  },
  {
    id: "path-science",
    name: "科学小探索",
    icon: "🔬",
    hint: "学完「科学常识」学习路径",
    category: "skill",
  },
  {
    id: "path-review",
    name: "复习小达人",
    icon: "🏆",
    hint: "学完「综合复习」学习路径",
    category: "skill",
  },
  {
    id: "path-all",
    name: "全科小学霸",
    icon: "🎓",
    hint: "学完全部 5 条学习路径",
    category: "milestone",
  },
] as const;

const META_MAP: Record<string, AchievementMeta> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** 按 id 查成就元数据；未登记的返回一个通用占位。 */
export function getAchievementMeta(id: string): AchievementMeta {
  return (
    META_MAP[id] ?? {
      id,
      name: "隐藏成就",
      icon: "🎁",
      hint: "神秘成就",
      category: "hidden" as const,
    }
  );
}

/**
 * 游戏 tag → 成就分类的映射。
 * registry 里 tag 形如「认知·颜色」「数学·运算」「语言·词汇」等，
 * 取「·」前的部分作为大类。
 */
function tagToCategory(tag: string): string {
  return tag.split("·")[0] ?? tag;
}

/**
 * 检查并解锁所有「累计型」成就。
 * 在每次通关结算后由 main.ts 调用。
 *
 * 注意：品类成就需要 gameId→tag 映射，由调用方传入。
 * @param gameTags 一个函数：gameId → tag 字符串
 * @returns 新解锁的成就 id 列表
 */
export function checkMilestoneAchievements(
  save: SaveData,
  gameTags: (id: string) => string,
): string[] {
  const newly: string[] = [];
  const tryUnlock = (id: string): void => {
    if (!save.achievements.includes(id)) {
      save.achievements.push(id);
      newly.push(id);
    }
  };

  // 通关数统计
  const cleared = ALL_GAME_IDS.filter((id) => save.progress[id].cleared);
  const clearedCount = cleared.length;
  if (clearedCount >= 1) tryUnlock("first-clear");
  if (clearedCount >= 5) tryUnlock("cleared-5");
  if (clearedCount >= 10) tryUnlock("cleared-10");
  if (clearedCount >= 20) tryUnlock("cleared-20");
  if (clearedCount >= 40) tryUnlock("cleared-40");
  if (clearedCount >= ALL_GAME_IDS.length) tryUnlock("all-clear");

  // 3 星数
  const threeStarCount = ALL_GAME_IDS.filter(
    (id) => save.progress[id].bestStars >= 3,
  ).length;
  if (threeStarCount >= 5) tryUnlock("three-star-5");
  if (threeStarCount >= 15) tryUnlock("three-star-15");

  // 困难通关数
  const hardCount = ALL_GAME_IDS.filter(
    (id) => save.progress[id].bestDifficulty === "hard",
  ).length;
  if (hardCount >= 1) tryUnlock("hard-clearer");
  if (hardCount >= 10) tryUnlock("hard-master");

  // 累计星星
  const totalStars = ALL_GAME_IDS.reduce(
    (s, id) => s + save.progress[id].bestStars,
    0,
  );
  if (totalStars >= 50) tryUnlock("collector");

  // 累计游玩局数
  const totalPlays = ALL_GAME_IDS.reduce(
    (s, id) => s + save.progress[id].playCount,
    0,
  );
  if (totalPlays >= 100) tryUnlock("centurion");

  // 打开过的游戏数（playCount > 0）
  const openedCount = ALL_GAME_IDS.filter(
    (id) => save.progress[id].playCount > 0,
  ).length;
  if (openedCount >= 20) tryUnlock("explorer");

  // 同一游戏玩满 5 次
  if (ALL_GAME_IDS.some((id) => save.progress[id].playCount >= 5)) {
    tryUnlock("persistent");
  }

  // 学习路径成就：每条路径全通关解锁对应成就；5 条全通关解锁 path-all
  const PATH_ACH: Record<string, string> = {
    cognition: "path-cognition",
    literacy: "path-literacy",
    math: "path-math",
    science: "path-science",
    review: "path-review",
  };
  let pathsDone = 0;
  for (const path of LEARN_PATHS) {
    if (isPathComplete(path, save)) {
      pathsDone += 1;
      const achId = PATH_ACH[path.id];
      if (achId) tryUnlock(achId);
    }
  }
  if (pathsDone >= LEARN_PATHS.length) tryUnlock("path-all");

  // 品类成就：每类通关 5 个
  const catCounts: Record<string, number> = {};
  for (const id of cleared) {
    const cat = tagToCategory(gameTags(id));
    catCounts[cat] = (catCounts[cat] ?? 0) + 1;
  }
  const CAT_MAP: Record<string, string> = {
    认知: "cat-cognition",
    数学: "cat-math",
    语言: "cat-language",
    科学: "cat-science",
    反应: "cat-action",
    逻辑: "cat-action",
    创造: "cat-action",
    记忆: "cat-action",
    艺术: "cat-art",
    社交: "cat-social",
    生活: "cat-life",
    精细: "cat-life",
    健康: "cat-life",
    专注: "cat-cognition",
    概率: "cat-action",
    物理: "cat-science",
    控制: "cat-action",
    瞄准: "cat-action",
    策略: "cat-action",
    观察: "cat-cognition",
  };
  for (const [cat, count] of Object.entries(catCounts)) {
    const achId = CAT_MAP[cat];
    if (achId && count >= 5) tryUnlock(achId);
  }

  // 博学多才：每个出现的类别都至少通关 1 个（至少 4 类）
  if (Object.values(catCounts).filter((c) => c >= 1).length >= 4) {
    tryUnlock("jack-of-all");
  }

  return newly;
}
