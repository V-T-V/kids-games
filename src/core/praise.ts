/**
 * 夸赞文案池 —— 致敬 dashan 的"大善"精神：无论孩子做得怎样，都被温柔托住。
 *
 * 3-6 岁心理学：具体、真诚、强调努力而非天赋。
 * 永不出现否定词；答错用鼓励，答对用惊喜，通关用盛大庆祝。
 */

/** 答对时的夸赞（随机抽取，避免重复感）。 */
const PRAISE_CORRECT: readonly string[] = [
  "太棒啦！",
  "哇，你做到了！",
  "真厉害！",
  "答对啦，真聪明！",
  "好厉害的小脑瓜！",
  "你真了不起！",
  "看你多棒呀！",
  "答对了，给你点赞！",
  "哇哦，太厉害了！",
  "你越来越棒了！",
];

/** 答错时的温柔鼓励（不给红叉，引导再试）。 */
const PRAISE_TRY_AGAIN: readonly string[] = [
  "再想想看～",
  "没关系，再来一次！",
  "差一点点哦～",
  "别急，慢慢来～",
  "试试别的吧～",
  "你一定可以的！",
  "深呼吸，再试试～",
  "没关系，慢慢想～",
];

/** 通关时的盛大庆祝。 */
const PRAISE_CLEAR: readonly string[] = [
  "全部通关啦！你是最棒的！",
  "太厉害了，全部完成！",
  "哇，你做到了全部！真了不起！",
  "完美通关！为你骄傲！",
  "了不起的小冠军，通关啦！",
];

/** 休息提示（家长护盾触发）。 */
const PRAISE_REST: readonly string[] = [
  "休息一下眼睛吧～喝口水再来！",
  "玩得真好，让小手歇一歇～",
  "你已经很棒啦，休息一会儿吧！",
  "让小脑瓜休息一下，待会儿更厉害！",
];

/** 从池中随机取一条，避免与上一条重复。 */
function pick(pool: readonly string[], last: string | undefined): string {
  if (pool.length === 0) return "";
  if (pool.length === 1) return pool[0]!;
  let s = pool[Math.floor(Math.random() * pool.length)]!;
  // 避免连续重复
  let guard = 0;
  while (s === last && guard < 5) {
    s = pool[Math.floor(Math.random() * pool.length)]!;
    guard += 1;
  }
  return s;
}

/** 单例：记住上次返回的文案，避免连续重复。 */
const lastSpoken: Record<string, string | undefined> = {};

export function praiseCorrect(): string {
  lastSpoken.correct = pick(PRAISE_CORRECT, lastSpoken.correct);
  return lastSpoken.correct;
}

export function praiseTryAgain(): string {
  lastSpoken.again = pick(PRAISE_TRY_AGAIN, lastSpoken.again);
  return lastSpoken.again;
}

export function praiseClear(): string {
  lastSpoken.clear = pick(PRAISE_CLEAR, lastSpoken.clear);
  return lastSpoken.clear;
}

export function praiseRest(): string {
  lastSpoken.rest = pick(PRAISE_REST, lastSpoken.rest);
  return lastSpoken.rest;
}
