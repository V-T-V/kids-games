/**
 * 统一学习模型 —— 基于三大教育理论的学前学习框架。
 *
 * 理论基础：
 * 1. 皮亚杰认知发展：3-6 岁处于前运算阶段，从感知动作→符号表征→初步运算。
 * 2. 布鲁姆教育目标：记忆→理解→应用→创造（学前适配版）。
 * 3. 加德纳多元智能：收敛为 6 大发展领域。
 *
 * 设计：从游戏的 tag（"能力域·子类"）自动派生 SkillProfile，
 * 不硬编码 575 个游戏，不新增存储——全部从 registry tag + save.progress 派生。
 */
import { GAMES } from "../games/registry.ts";
import type { GameId, SaveData } from "../types.ts";

// ============ 类型定义 ============

/** 认知层次（皮亚杰前运算阶段 3 级细分） */
export type CognitiveTier = "perceptual" | "representational" | "operational";

/** 认知需求（布鲁姆学前 4 级） */
export type BloomLevel = "remember" | "understand" | "apply" | "create";

/** 6 大发展领域（加德纳多元智能收敛） */
export type Domain =
  | "perception"
  | "language"
  | "logic"
  | "kinesthetic"
  | "arts"
  | "social";

/** 理论标注：每个游戏的教育画像 */
export interface SkillProfile {
  domain: Domain;
  cognitiveTier: CognitiveTier;
  bloomLevel: BloomLevel;
}

/** 领域元信息（展示用） */
export interface DomainMeta {
  id: Domain;
  title: string;
  icon: string;
  color: string;
  theory: string;
}

/** 领域进度 */
export interface DomainProgress {
  domain: Domain;
  cleared: number;
  total: number;
  avgStars: number;
}

// ============ 常量 ============

export const DOMAINS: readonly DomainMeta[] = [
  {
    id: "perception",
    title: "感知认知",
    icon: "🎨",
    color: "#ff6b9d",
    theory: "颜色、形状、空间、自然观察（空间+自然观察智能）",
  },
  {
    id: "language",
    title: "语言文字",
    icon: "📖",
    color: "#4d96ff",
    theory: "听、说、读、写、词汇（语言智能）",
  },
  {
    id: "logic",
    title: "数理逻辑",
    icon: "🔢",
    color: "#6bcf7f",
    theory: "计数、运算、推理、记忆（逻辑数学智能）",
  },
  {
    id: "kinesthetic",
    title: "身体动觉",
    icon: "🤸",
    color: "#ff9f43",
    theory: "反应、精细动作、大运动（身体动觉智能）",
  },
  {
    id: "arts",
    title: "艺术创造",
    icon: "🎵",
    color: "#a55eea",
    theory: "音乐、绘画、创作、审美（音乐+空间智能）",
  },
  {
    id: "social",
    title: "社会情感",
    icon: "🤝",
    color: "#22d3ee",
    theory: "社交、生活自理、情绪管理（人际+内省智能）",
  },
];

export const COGNITIVE_TIERS: Record<
  CognitiveTier,
  { title: string; age: string; theory: string }
> = {
  perceptual: {
    title: "感知层",
    age: "3-4 岁",
    theory: "通过直接感知认识世界（颜色/形状/声音）",
  },
  representational: {
    title: "表征层",
    age: "4-5 岁",
    theory: "用符号/表象理解事物（数字/字母/语言）",
  },
  operational: {
    title: "运算层",
    age: "5-6 岁",
    theory: "初步逻辑运算与因果推理",
  },
};

export const BLOOM_LEVELS: Record<
  BloomLevel,
  { title: string; theory: string }
> = {
  remember: { title: "记忆", theory: "识别、回忆——找颜色、认形状" },
  understand: { title: "理解", theory: "归类、比较——分类、配对" },
  apply: { title: "应用", theory: "运用规则——运算、推理" },
  create: { title: "创造", theory: "自由表达——涂鸦、拼搭" },
};

// ============ tag → SkillProfile 映射 ============

/** top-level tag → domain 基础映射 */
const TAG_DOMAIN: Record<string, Domain> = {
  认知: "perception",
  科学: "perception",
  物理: "perception",
  观察: "perception",
  语言: "language",
  数学: "logic",
  逻辑: "logic",
  记忆: "logic",
  专注: "logic",
  反应: "kinesthetic",
  精细: "kinesthetic",
  健康: "kinesthetic",
  控制: "kinesthetic",
  瞄准: "kinesthetic",
  艺术: "arts",
  创造: "arts",
  社交: "social",
  生活: "social",
  概率: "logic",
  策略: "logic",
};

/** top-level tag → cognitiveTier 基础映射 */
const TAG_TIER: Record<string, CognitiveTier> = {
  认知: "perceptual",
  科学: "operational",
  物理: "operational",
  观察: "perceptual",
  语言: "representational",
  数学: "operational",
  逻辑: "operational",
  记忆: "representational",
  专注: "representational",
  反应: "perceptual",
  精细: "perceptual",
  健康: "perceptual",
  控制: "perceptual",
  瞄准: "perceptual",
  艺术: "perceptual",
  创造: "perceptual",
  社交: "representational",
  生活: "representational",
  概率: "operational",
  策略: "operational",
};

/** top-level tag → bloomLevel 基础映射 */
const TAG_BLOOM: Record<string, BloomLevel> = {
  认知: "remember",
  科学: "understand",
  物理: "apply",
  观察: "remember",
  语言: "understand",
  数学: "apply",
  逻辑: "understand",
  记忆: "remember",
  专注: "remember",
  反应: "apply",
  精细: "apply",
  健康: "apply",
  控制: "apply",
  瞄准: "apply",
  艺术: "create",
  创造: "create",
  社交: "understand",
  生活: "understand",
  概率: "understand",
  策略: "apply",
};

/** 子类关键词 → bloomLevel 覆写（更精细） */
const SUBTAG_BLOOM_OVERRIDE: Array<[RegExp, BloomLevel]> = [
  [/运算|加法|除法|分数|货币/, "apply"],
  [/创作|涂色|涂鸦|拼搭|自由/, "create"],
  [/识别|认|记忆|回忆/, "remember"],
  [/分类|排序|配对|比较|归类/, "understand"],
  [/推理|因果|策略|规划/, "apply"],
];

/**
 * 从 game tag 派生 SkillProfile。
 * tag 格式："能力域·子类"（如"认知·颜色"、"数学·运算"）。
 */
export function deriveSkillProfile(tag: string): SkillProfile {
  const top = tag.split("·")[0] ?? "认知";
  const sub = tag.split("·")[1] ?? "";

  const domain = TAG_DOMAIN[top] ?? "perception";
  const cognitiveTier = TAG_TIER[top] ?? "perceptual";
  let bloomLevel = TAG_BLOOM[top] ?? "remember";

  // 子类微调 bloomLevel
  for (const [re, level] of SUBTAG_BLOOM_OVERRIDE) {
    if (re.test(sub)) {
      bloomLevel = level;
      break;
    }
  }

  return { domain, cognitiveTier, bloomLevel };
}

// ============ 工具函数 ============

/** gameId → tag 的 O(1) 索引（避免 getSkillProfile 里 GAMES.find 线性搜索 575 项）。 */
const TAG_BY_ID: ReadonlyMap<string, string> = new Map(
  GAMES.map((g) => [g.id, g.tag]),
);

/** 缓存：gameId → SkillProfile（避免重复计算） */
const PROFILE_CACHE = new Map<string, SkillProfile>();

/** 获取游戏的理论画像（从 tag 派生，带缓存）。 */
export function getSkillProfile(gameId: string): SkillProfile {
  const cached = PROFILE_CACHE.get(gameId);
  if (cached) return cached;
  const tag = TAG_BY_ID.get(gameId) ?? "认知·其他";
  const profile = deriveSkillProfile(tag);
  PROFILE_CACHE.set(gameId, profile);
  return profile;
}

/** 按领域统计进度 */
export function domainProgress(domain: Domain, save: SaveData): DomainProgress {
  const games = GAMES.filter((g) => getSkillProfile(g.id).domain === domain);
  let cleared = 0;
  let starSum = 0;
  let played = 0;
  for (const g of games) {
    const p = save.progress[g.id];
    if (p?.cleared) cleared++;
    if (p && p.playCount > 0) {
      played++;
      starSum += p.bestStars;
    }
  }
  return {
    domain,
    cleared,
    total: games.length,
    avgStars: played > 0 ? Math.round((starSum / played) * 10) / 10 : 0,
  };
}

/** 全部 6 领域进度 */
export function allDomainProgress(save: SaveData): DomainProgress[] {
  return DOMAINS.map((d) => domainProgress(d.id, save));
}

/** 按认知层次统计进度 */
export function cognitiveTierProgress(
  tier: CognitiveTier,
  save: SaveData,
): { cleared: number; total: number } {
  let cleared = 0;
  let total = 0;
  for (const g of GAMES) {
    if (getSkillProfile(g.id).cognitiveTier === tier) {
      total++;
      if (save.progress[g.id]?.cleared) cleared++;
    }
  }
  return { cleared, total };
}

/** 布鲁姆认知需求分布 */
export function bloomDistribution(
  save: SaveData,
): Record<BloomLevel, { cleared: number; total: number }> {
  const result: Record<BloomLevel, { cleared: number; total: number }> = {
    remember: { cleared: 0, total: 0 },
    understand: { cleared: 0, total: 0 },
    apply: { cleared: 0, total: 0 },
    create: { cleared: 0, total: 0 },
  };
  for (const g of GAMES) {
    const level = getSkillProfile(g.id).bloomLevel;
    result[level].total++;
    if (save.progress[g.id]?.cleared) result[level].cleared++;
  }
  return result;
}

/**
 * 基于理论的智能推荐：
 * 1. 找最薄弱的领域（通关率最低但玩过的）
 * 2. 在该领域找未通关的游戏
 * 3. 优先认知层次匹配孩子当前水平的（大部分 cleared 在哪个 tier）
 */
export function recommendNextGame(save: SaveData): GameId | null {
  // 1. 找孩子的"当前认知层次"（通关最多的 tier）
  const tiers: CognitiveTier[] = [
    "perceptual",
    "representational",
    "operational",
  ];
  let currentTier: CognitiveTier = "perceptual";
  let maxCleared = -1;
  for (const t of tiers) {
    const { cleared } = cognitiveTierProgress(t, save);
    if (cleared > maxCleared) {
      maxCleared = cleared;
      currentTier = t;
    }
  }

  // 2. 找最薄弱领域（玩过但通关率最低）
  const domains = allDomainProgress(save);
  const played = domains.filter((d) => d.total > 0);
  played.sort((a, b) => {
    const rateA = a.total > 0 ? a.cleared / a.total : 1;
    const rateB = b.total > 0 ? b.cleared / b.total : 1;
    return rateA - rateB; // 通关率低的优先
  });

  // 3. 在薄弱领域找未通关的、认知层次匹配的游戏
  for (const d of played) {
    const candidates = GAMES.filter((g) => {
      const profile = getSkillProfile(g.id);
      return (
        profile.domain === d.domain &&
        !save.progress[g.id]?.cleared &&
        save.progress[g.id]?.playCount !== undefined // 排除完全不玩的
      );
    });
    // 优先当前认知层次
    const tierMatch = candidates.filter(
      (g) => getSkillProfile(g.id).cognitiveTier === currentTier,
    );
    if (tierMatch.length > 0) return tierMatch[0]!.id as GameId;
    if (candidates.length > 0) return candidates[0]!.id as GameId;
  }

  // 4. fallback：任何未通关游戏
  const unplayed = GAMES.filter((g) => !save.progress[g.id]?.cleared);
  return unplayed.length > 0 ? (unplayed[0]!.id as GameId) : null;
}
