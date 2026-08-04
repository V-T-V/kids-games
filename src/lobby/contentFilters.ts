import type { GameMeta } from "../types.ts";

export type CompletionFilter = "all" | "uncleared" | "cleared";
export type AgeFilter = "all" | "3" | "4" | "5" | "6";
export type DurationFilter = "all" | "short" | "medium" | "long";

export interface LobbyFilters {
  category: string;
  completion: CompletionFilter;
  age: AgeFilter;
  duration: DurationFilter;
  searchTerm: string;
}

export interface GameProgressSnapshot {
  cleared: boolean;
}

export interface GameDiscoveryMeta {
  category: string;
  ageMin: number;
  ageMax: number;
  estimatedMinutes: number;
}

export function categoryOf(tag: string): string {
  return tag.split("·")[0] ?? "其他";
}

export function discoveryMeta(game: GameMeta): GameDiscoveryMeta {
  const [ageMin, ageMax] = parseAgeRange(game.age);
  return {
    category: categoryOf(game.tag),
    ageMin,
    ageMax,
    estimatedMinutes: estimateMinutes(game),
  };
}

export function filterGames(
  games: readonly GameMeta[],
  progress: Record<string, GameProgressSnapshot>,
  filters: LobbyFilters,
): GameMeta[] {
  const term = filters.searchTerm.trim().toLowerCase();
  return games.filter((game) => {
    const meta = discoveryMeta(game);
    if (filters.category !== "全部" && meta.category !== filters.category) {
      return false;
    }
    if (filters.age !== "all" && !ageMatches(meta, Number(filters.age))) {
      return false;
    }
    if (
      filters.duration !== "all" &&
      !durationMatches(meta.estimatedMinutes, filters.duration)
    ) {
      return false;
    }
    const state = progress[game.id];
    if (filters.completion === "uncleared" && state?.cleared) return false;
    if (filters.completion === "cleared" && !state?.cleared) return false;
    if (term && !matchesSearch(game, term, meta)) return false;
    return true;
  });
}

export function parseAgeRange(age: string): [number, number] {
  const match = /^(\d)-(\d) 岁$/.exec(age.trim());
  if (!match) return [3, 6];
  return [Number(match[1]), Number(match[2])];
}

function ageMatches(meta: GameDiscoveryMeta, age: number): boolean {
  return age >= meta.ageMin && age <= meta.ageMax;
}

function durationMatches(
  minutes: number,
  filter: Exclude<DurationFilter, "all">,
): boolean {
  if (filter === "short") return minutes <= 5;
  if (filter === "medium") return minutes > 5 && minutes <= 8;
  return minutes > 8;
}

/** 简易中文→拼音首字母映射（覆盖常见字，不全但够用）。 */
const PINYIN_INITIALS: Record<string, string> = {
  色:"se",形:"xing",数:"shu",字:"zi",记:"ji",音:"yin",蜜:"mi",走:"zou",找:"zhao",大:"da",小:"xiao",认:"ren",
  加:"jia",减:"jian",乘:"cheng",除:"chu",算:"suan",分:"fen",钱:"qian",时:"shi",钟:"zhong",重:"zhong",长:"chang",短:"duan",
  高:"gao",矮:"ai",多:"duo",少:"shao",排:"pai",队:"dui",连:"lian",配:"pei",画:"hua",涂:"tu",折:"zhe",剪:"jian",
  拼:"pin",搭:"da",建:"jian",堆:"dui",反:"fan",正:"zheng",同:"tong",异:"yi",成:"cheng",语:"yu",诗:"shi",词:"ci",
  说:"shuo",读:"du",写:"xie",看:"kan",听:"ting",猜:"cai",选:"xuan",点:"dian",拖:"tuo",飞:"fei",跳:"tiao",
  跑:"pao",接:"jie",投:"tou",踢:"ti",拍:"pai",打:"da",抓:"zhua",喂:"wei",种:"zhong",浇:"jiao",洗:"xi",刷:"shua",
  穿:"chuan",戴:"dai",系:"ji",拉:"la",按:"an",转:"zhuan",摇:"yao",吹:"chui",弹:"tan",敲:"qiao",模:"mo",仿:"fang",
  动:"dong",物:"wu",植:"zhi",天:"tian",地:"di",水:"shui",火:"huo",风:"feng",雨:"yu",雪:"xue",云:"yun",星:"xing",
  月:"yue",日:"ri",光:"guang",影:"ying",山:"shan",河:"he",海:"hai",树:"shu",花:"hua",草:"cao",鱼:"yu",鸟:"niao",
  虫:"chong",车:"che",船:"chuan",房:"fang",家:"jia",城:"cheng",路:"lu",桥:"qiao",塔:"ta",门:"men",窗:"chuang",
  球:"qiu",铃:"ling",鼓:"gu",琴:"qin",旗:"qi",灯:"deng",伞:"san",帽:"mao",鞋:"xie",衣:"yi",食:"shi",饭:"fan",
  果:"guo",菜:"cai",糖:"tang",蛋:"dan",奶:"nai",茶:"cha",杯:"bei",碗:"wan",筷:"kuai",刀:"dao",锅:"guo",
};

/** 获取一段中文文本的拼音首字母索引（粗略，用于搜索）。 */
function pinyinIndex(text: string): string {
  let result = "";
  for (const ch of text) {
    result += PINYIN_INITIALS[ch] ?? ch.toLowerCase();
  }
  return result;
}

function matchesSearch(
  game: GameMeta,
  term: string,
  meta: GameDiscoveryMeta,
): boolean {
  const t = term.toLowerCase();
  // 文本匹配：标题、副标题、标签、年龄、时长
  if (
    game.title.toLowerCase().includes(t) ||
    game.subtitle.toLowerCase().includes(t) ||
    game.tag.includes(t) ||
    game.age.includes(t) ||
    `${meta.estimatedMinutes}分钟`.includes(t)
  ) {
    return true;
  }
  // 拼音首字母匹配（如 "se" 匹配 "色彩调配师"，"sx" 匹配 "数学"）
  if (pinyinIndex(game.title).includes(t) || pinyinIndex(game.subtitle).includes(t)) {
    return true;
  }
  // icon emoji 匹配
  if (game.icon === term) return true;
  return false;
}

function estimateMinutes(game: GameMeta): number {
  const tag = game.tag;
  const category = categoryOf(tag);
  if (game.age.startsWith("3-5")) return 4;
  if (category === "语言" || category === "数学" || category === "科学") {
    return 8;
  }
  if (category === "逻辑" || tag.includes("策略") || tag.includes("编程")) {
    return 10;
  }
  if (tag.includes("反应") || tag.includes("协调")) return 5;
  if (tag.includes("艺术") || tag.includes("创造")) return 7;
  return 6;
}
