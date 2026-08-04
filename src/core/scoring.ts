/**
 * 通用算星工具 —— 把「表现」映射到 0-3 星。
 *
 * 算星约定（避免"必 3 星"注水）：
 * - 动作/反应类（接水果、躲障碍…）：通关即 score>=need，完成度恒 100% 无区分度，
 *   故用 starsByAccuracy(this.wrongCount, [0,2]) 按本局失误数算星：
 *   0 失误→3★ / 1-2 失误→2★ / ≥3 失误→1★。
 * - 答题/选择类：starsByAccuracy 按错题数，或 starsByRate 按正确率。
 * - 计时/操作类：starsByTime / starsByMoves。
 * - 开放沙盒（涂鸦/换装等无对错）：finishClear(3) 是合理的。
 * 多维度时用 minStars 取短板。
 *
 * 全部是纯函数，便于单测。
 */

/**
 * 按「错误次数」算星（适合答题/选择类）。
 * @param wrongs 本局错误次数
 * @param thresholds [3星最多错几次, 2星最多错几次]，超过即降为 1 星
 *
 * 默认：全对/错1次 → 3★；错2-3次 → 2★；更多 → 1★
 */
export function starsByAccuracy(
  wrongs: number,
  thresholds: [number, number] = [1, 3],
): number {
  if (wrongs <= thresholds[0]) return 3;
  if (wrongs <= thresholds[1]) return 2;
  return 1;
}

/**
 * 按「正确率」算星（correct/total）。
 * 默认：≥95% → 3★；≥70% → 2★；否则 1★。
 */
export function starsByRate(
  correct: number,
  total: number,
  thresholds: [number, number] = [0.95, 0.7],
): number {
  if (total <= 0) return 3;
  const rate = correct / total;
  if (rate >= thresholds[0]) return 3;
  if (rate >= thresholds[1]) return 2;
  return 1;
}

/**
 * 按「用时」算星（毫秒）。
 * @param durationMs 本局耗时
 * @param limits [3星上限, 2星上限]，超过即降级
 */
export function starsByTime(
  durationMs: number,
  limits: [number, number],
): number {
  if (durationMs <= limits[0]) return 3;
  if (durationMs <= limits[1]) return 2;
  return 1;
}

/**
 * 按「移动/操作次数」算星（拖拽类用）。
 * @param moves 操作次数
 * @param limits [3星上限, 2星上限]
 */
export function starsByMoves(moves: number, limits: [number, number]): number {
  if (moves <= limits[0]) return 3;
  if (moves <= limits[1]) return 2;
  return 1;
}

/**
 * 按「得分」算星（打地鼠/找一找类用）。
 * @param score 得分
 * @param limits [3星下限, 2星下限]
 */
export function starsByScore(score: number, limits: [number, number]): number {
  if (score >= limits[0]) return 3;
  if (score >= limits[1]) return 2;
  return 1;
}

/**
 * 综合：把多个维度算出的星取最小值（短板决定）。
 * 例如同时看用时和准确率时用。
 */
export function minStars(...stars: number[]): number {
  if (stars.length === 0) return 3;
  return Math.max(0, Math.min(3, Math.min(...stars)));
}
