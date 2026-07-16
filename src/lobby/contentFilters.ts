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

function matchesSearch(
  game: GameMeta,
  term: string,
  meta: GameDiscoveryMeta,
): boolean {
  return (
    game.title.toLowerCase().includes(term) ||
    game.subtitle.toLowerCase().includes(term) ||
    game.tag.includes(term) ||
    game.age.includes(term) ||
    `${meta.estimatedMinutes}分钟`.includes(term)
  );
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
