/**
 * 家长报告：把 81 个游戏的进度转成可运营、可解释的能力概览。
 */
import { GAMES, findGame } from "../games/registry.ts";
import type { GameId, SaveData } from "../types.ts";

export interface SkillReport {
  skill: string;
  games: number;
  played: number;
  cleared: number;
  playCount: number;
  totalDurationMs: number;
  averageSessionMinutes: number;
  averageStars: number;
}

export interface ParentReport {
  totalGames: number;
  playedGames: number;
  clearedGames: number;
  totalPlayCount: number;
  totalDurationMs: number;
  totalMinutes: number;
  completionRate: number;
  averageStars: number;
  averageSessionMinutes: number;
  strengths: SkillReport[];
  practice: SkillReport[];
  recommendedGames: GameId[];
}

export function buildParentReport(save: SaveData): ParentReport {
  const skills = new Map<string, SkillReport>();
  let playedGames = 0;
  let clearedGames = 0;
  let totalPlayCount = 0;
  let totalDurationMs = 0;
  let starSum = 0;

  for (const game of GAMES) {
    const skill = skillOf(game.tag);
    const p = save.progress[game.id];
    const bucket =
      skills.get(skill) ??
      ({
        skill,
        games: 0,
        played: 0,
        cleared: 0,
        playCount: 0,
        totalDurationMs: 0,
        averageSessionMinutes: 0,
        averageStars: 0,
      } satisfies SkillReport);
    bucket.games += 1;
    bucket.playCount += p.playCount;
    bucket.totalDurationMs += p.totalDurationMs;
    if (p.playCount > 0) {
      bucket.played += 1;
      playedGames += 1;
      starSum += p.bestStars;
    }
    if (p.cleared) {
      bucket.cleared += 1;
      clearedGames += 1;
    }
    skills.set(skill, bucket);
    totalPlayCount += p.playCount;
    totalDurationMs += p.totalDurationMs;
  }

  const reports = [...skills.values()].map((r) => ({
    ...r,
    averageStars:
      r.played === 0 ? 0 : round1(starsForSkill(save, r.skill) / r.played),
    averageSessionMinutes:
      r.playCount === 0
        ? 0
        : round1(msToMinutes(r.totalDurationMs) / r.playCount),
  }));

  const strengths = reports
    .filter((r) => r.played > 0)
    .sort((a, b) => b.averageStars - a.averageStars || b.cleared - a.cleared)
    .slice(0, 3);
  const practice = reports
    .filter((r) => r.played > 0 && r.cleared < r.played)
    .sort((a, b) => a.averageStars - b.averageStars || a.cleared - b.cleared)
    .slice(0, 3);

  return {
    totalGames: GAMES.length,
    playedGames,
    clearedGames,
    totalPlayCount,
    totalDurationMs,
    totalMinutes: round1(msToMinutes(totalDurationMs)),
    completionRate:
      GAMES.length === 0 ? 0 : round1((clearedGames / GAMES.length) * 100),
    averageStars: playedGames === 0 ? 0 : round1(starSum / playedGames),
    averageSessionMinutes:
      totalPlayCount === 0
        ? 0
        : round1(msToMinutes(totalDurationMs) / totalPlayCount),
    strengths,
    practice,
    recommendedGames: recommendGames(save),
  };
}

export function formatParentSummary(report: ParentReport): string {
  const time =
    report.totalMinutes > 0 ? `，累计 ${report.totalMinutes} 分钟` : "";
  const base = `已体验 ${report.playedGames}/${report.totalGames} 个游戏，通关 ${report.clearedGames} 个，平均 ${report.averageStars} 星${time}`;
  const strong = report.strengths[0]?.skill;
  const practice = report.practice[0]?.skill;
  if (!strong && !practice) return `${base}。继续从未玩过的游戏开始探索。`;
  return `${base}。优势：${strong ?? "暂无"}；建议练习：${practice ?? "继续探索新能力"}。`;
}

function skillOf(tag: string): string {
  return tag.split("·")[0]?.trim() || "综合";
}

function starsForSkill(save: SaveData, skill: string): number {
  let sum = 0;
  for (const game of GAMES) {
    if (skillOf(game.tag) === skill && save.progress[game.id].playCount > 0) {
      sum += save.progress[game.id].bestStars;
    }
  }
  return sum;
}

function recommendGames(save: SaveData): GameId[] {
  const notCleared = GAMES.filter((g) => !save.progress[g.id].cleared);
  const unplayed = notCleared.filter(
    (g) => save.progress[g.id].playCount === 0,
  );
  return [...unplayed, ...notCleared]
    .filter((g, i, arr) => arr.findIndex((x) => x.id === g.id) === i)
    .slice(0, 5)
    .map((g) => findGame(g.id)?.id ?? g.id);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function msToMinutes(ms: number): number {
  return ms / 60000;
}
